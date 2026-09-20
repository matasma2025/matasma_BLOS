import { db } from "../../db";
import { storage } from "../../storage";
import {
  boardAnalysisConfigs,
  boardAnalysisRuns,
  boardReports,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { getCubeVersions, runBoardAnalysis, type AnalysisRequest } from "../boardAnalysisService";
import { resolveDomainAiConfigForUser } from "../domainAiConfigService";
import { assertBoardSourceAccess, type BoardSourceSelection, getAuthorizedBoardSource, getAuthorizedVaultVersion } from "../boardSourceService";
import { parseBoardAnalysisResult } from "./boardResultSchema";
import {
  BOARD_FORMULA_ENGINE_VERSION,
  BOARD_RESULT_SCHEMA_VERSION,
} from "@shared/boards/boardRun";
import { prepareEnterpriseBoardSource } from "./sources/enterpriseSourceLoader";
import { createLegacyBoardAnalysisRequest } from "./legacyBoardAnalysisAdapter";
import { executeEnterpriseDeterministicAnalysis } from "./sources/enterpriseDeterministicExecutor";
import { deterministicAnalysisResultSchema } from "@shared/boards/deterministicAnalysis";
import { runKpiReport, validateKpiReportRequest } from "../kpiReportService";

export interface BoardAnalysisRequest {
  year?: number;
  months?: number[];
  dimensions?: string[];
  keyColumns?: Array<{
    column: string;
    label: string;
    aggregation?: "sum" | "last" | "latest" | "average" | "min" | "max" | "count" | "ratio";
    valueType?: "currency" | "percentage" | "count" | "ratio" | "number";
    favorability?: "higher-is-favorable" | "lower-is-favorable" | "neutral";
    numerator?: string;
    denominator?: string;
    dimension?: string | null;
    dimensionValues?: string[];
  }>;
  scopeMode?: "all" | "selected" | "exclude" | "all-except";
  excludedColumns?: string[];
  sourceSelection?: BoardSourceSelection;
  extraContext?: string;
  userPromptTemplate?: string;
  comparison?: { year: number; months: number[]; label?: string };
}

function sourceId(selection: BoardSourceSelection) {
  return selection.sourceType === "enterprise" ? selection.cubeId : selection.documentId;
}

export function normalizeBoardRunRequest(
  request: BoardAnalysisRequest,
  now = new Date(),
): BoardAnalysisRequest {
  return {
    ...request,
    year: Number(request.year ?? now.getFullYear()),
    months: (request.months?.length ? request.months : [now.getMonth() + 1]).map(Number),
  };
}

export function decideBoardRunClaim(status: string): "claim" | "complete" | "refuse" {
  if (status === "queued") return "claim";
  if (status === "complete") return "complete";
  return "refuse";
}

export async function getOrCreateBoardAnalysisConfig(boardId: string) {
  const existing = await db.select().from(boardAnalysisConfigs).where(eq(boardAnalysisConfigs.boardId, boardId)).limit(1);
  return existing[0];
}

export async function saveBoardAnalysisConfig(boardId: string, input: {
  templateKey: string;
  analysisPrompt?: string | null;
  sourceType: "enterprise" | "vault";
  sourceSelection: BoardSourceSelection;
  scopeMode?: string;
  keyColumns?: unknown[];
  excludedColumns?: string[];
  timeGranularity?: string;
  comparisonBasis?: unknown;
}) {
  const values = {
    boardId,
    templateKey: input.templateKey,
    analysisPrompt: input.analysisPrompt ?? null,
    sourceType: input.sourceType,
    sourceConfig: input.sourceSelection,
    scopeMode: input.scopeMode ?? "all",
    keyColumns: input.keyColumns ?? [],
    excludedColumns: input.excludedColumns ?? [],
    timeGranularity: input.timeGranularity ?? "auto",
    comparisonBasis: input.comparisonBasis ?? {},
    updatedAt: new Date(),
  };
  const existing = await getOrCreateBoardAnalysisConfig(boardId);
  if (existing) {
    const updated = await db.update(boardAnalysisConfigs).set(values)
      .where(eq(boardAnalysisConfigs.boardId, boardId)).returning();
    return updated[0];
  }
  const created = await db.insert(boardAnalysisConfigs).values(values).returning();
  return created[0];
}

export async function createBoardAnalysisRun(params: {
  boardId: string;
  userId: string;
  request: BoardAnalysisRequest;
  trigger?: string;
  idempotencyKey?: string;
}) {
  const board = await storage.getBoard(params.boardId);
  if (!board || board.userId !== params.userId) throw new Error("Board not found");
  const config = await getOrCreateBoardAnalysisConfig(params.boardId);
  const boardSettings = (board.settings as any) ?? {};
  const selection = params.request.sourceSelection
    ?? (config?.sourceConfig as BoardSourceSelection | undefined)
    ?? (boardSettings.cubeId ? { sourceType: "enterprise", cubeId: boardSettings.cubeId } : undefined);
  if (!selection) throw new Error("Select an authorized source before starting an analysis");
  await assertBoardSourceAccess(params.userId, selection);
  const source = await getAuthorizedBoardSource(params.userId, selection);
  const vaultVersion = selection.sourceType === "vault" ? await getAuthorizedVaultVersion(params.userId, selection.documentId) : undefined;
  const normalizedRequest = normalizeBoardRunRequest(params.request);
  const templateKey = boardSettings.templateKey ?? config?.templateKey ?? "variance-analysis";
  const effectiveConfigSnapshot = {
    config: config ?? null,
    boardSettings,
    request: normalizedRequest,
    sourceSelection: selection,
  };
  const created = await db.insert(boardAnalysisRuns).values({
    boardId: params.boardId,
    requestedBy: params.userId,
    trigger: params.trigger ?? "manual",
    idempotencyKey: params.idempotencyKey ?? null,
    templateKey,
    requestConfig: normalizedRequest,
    sourceSnapshot: { id: source.id, name: source.name, sourceType: source.sourceType, ...(vaultVersion ? { version: vaultVersion } : {}) },
    configSnapshot: effectiveConfigSnapshot,
    resultSchemaVersion: BOARD_RESULT_SCHEMA_VERSION,
    formulaEngineVersion: BOARD_FORMULA_ENGINE_VERSION,
    promptVersion: "legacy-board-prompt-v1",
    status: "queued",
    progressPercent: 0,
    progressStage: "Queued",
  }).onConflictDoNothing({ target: boardAnalysisRuns.idempotencyKey }).returning();
  if (created[0]) return created[0];
  if (params.idempotencyKey) {
    const existing = await db.select().from(boardAnalysisRuns)
      .where(eq(boardAnalysisRuns.idempotencyKey, params.idempotencyKey)).limit(1);
    if (existing[0]) return existing[0];
  }
  throw new Error("Unable to create Board analysis run");
}

export async function executeBoardAnalysis(runId: string) {
  const rows = await db.select().from(boardAnalysisRuns).where(eq(boardAnalysisRuns.id, runId)).limit(1);
  const run = rows[0];
  if (!run) throw new Error("Analysis run not found");
  const queuedSnapshot = (run.configSnapshot ?? {}) as { sourceSelection?: BoardSourceSelection };
  if (queuedSnapshot.sourceSelection) {
    await assertBoardSourceAccess(run.requestedBy, queuedSnapshot.sourceSelection);
    if (queuedSnapshot.sourceSelection.sourceType === "vault") {
      const expected = (run.sourceSnapshot as any)?.version;
      const current = await getAuthorizedVaultVersion(run.requestedBy, queuedSnapshot.sourceSelection.documentId);
      if (!expected || expected.documentId !== current.documentId || expected.contentHash !== current.contentHash) {
        throw new Error("Vault document changed since this Board run was queued");
      }
    }
  }
  const claim = await db.update(boardAnalysisRuns).set({
    status: "running", progressPercent: 15, progressStage: "Authorizing source", startedAt: new Date(),
  }).where(and(eq(boardAnalysisRuns.id, runId), eq(boardAnalysisRuns.status, "queued"))).returning();
  if (!claim[0]) {
    if (decideBoardRunClaim(String(run.status)) === "complete") {
      const existingReport = await db.select().from(boardReports).where(eq(boardReports.runId, runId)).limit(1);
      return { run, report: existingReport[0], legacyReport: undefined };
    }
    throw new Error(`Analysis run is not executable from status ${run.status}`);
  }
  const board = await storage.getBoard(run.boardId);
  if (!board || board.userId !== run.requestedBy) throw new Error("Board not found");
  const effectiveSnapshot = (run.configSnapshot ?? {}) as {
    config?: Record<string, unknown> | null;
    boardSettings?: Record<string, unknown>;
    request?: BoardAnalysisRequest;
    sourceSelection?: BoardSourceSelection;
  };
  const request = effectiveSnapshot.request ?? (run.requestConfig ?? {}) as BoardAnalysisRequest;
  const selection = (run.sourceSnapshot ?? {}) as { sourceType?: "enterprise" | "vault"; id?: string };
  const started = Date.now();
  try {
    if (!selection.id) throw new Error("Board source snapshot is incomplete");
    const sourceSelection = effectiveSnapshot.sourceSelection ?? (selection.sourceType === "vault"
      ? { sourceType: "vault" as const, documentId: selection.id }
      : { sourceType: "enterprise" as const, cubeId: selection.id });
    if (effectiveSnapshot.sourceSelection) {
      const snapshottedSourceId = sourceId(effectiveSnapshot.sourceSelection);
      if (effectiveSnapshot.sourceSelection.sourceType !== selection.sourceType || snapshottedSourceId !== selection.id) {
        throw new Error("Board run source snapshot does not match the queued configuration");
      }
    }
    const settings = (effectiveSnapshot.boardSettings ?? board.settings ?? {}) as any;
    const mapping = settings.columnMapping ?? {};
    const standaloneTemplate = String(run.templateKey) !== "variance-analysis" || !mapping.actuals || !mapping.budget;
    const configuredVersion = settings.boardFlow?.scope?.version || mapping.actuals || mapping.forecast;
    let standaloneVersion = configuredVersion ? String(configuredVersion) : undefined;
    if (standaloneTemplate && sourceSelection.sourceType === "enterprise" && !standaloneVersion) {
      standaloneVersion = (await getCubeVersions(sourceSelection.cubeId))[0];
      if (!standaloneVersion) throw new Error("The selected Enterprise source has no available data versions");
    }
    if (!standaloneTemplate && (!mapping.actuals || !mapping.budget)) {
      throw new Error("Configure actuals and budget versions on the Board before running an Enterprise Data analysis.");
    }
    // New runs already contain queue-time normalized periods. This fallback is
    // retained only for immutable snapshots created before Phase 2.
    const normalizedRequest = normalizeBoardRunRequest(request);
    await db.update(boardAnalysisRuns).set({ progressPercent: 35, progressStage: "Computing deterministic metrics" })
      .where(eq(boardAnalysisRuns.id, runId));
    let preparedSource: any;
    let deterministic;
    let governedKpiReport: Awaited<ReturnType<typeof runKpiReport>> | undefined;
    if (sourceSelection.sourceType === "vault") {
      const { loadVaultBoardDataset, runVaultDeterministicAnalysis, assertVaultIdentity } = await import("./phase4Service");
      const dataset = await loadVaultBoardDataset(run.requestedBy, sourceSelection.documentId);
      assertVaultIdentity((run.sourceSnapshot as any).version, { documentId: dataset.documentId, contentHash: dataset.contentHash });
      deterministic = runVaultDeterministicAnalysis(dataset, { request: normalizedRequest, settings });
      preparedSource = { source: { id: dataset.documentId, name: dataset.name, sourceType: "vault" }, plan: { year: normalizedRequest.year, measures: (normalizedRequest.keyColumns ?? []).map((key) => ({ column: key.column, label: key.label, aggregation: key.aggregation ?? "sum", valueType: key.valueType ?? "number", filters: [] })) } };
    } else {
      if (run.templateKey === "kpi-metrics") {
        const scope = settings.boardFlow?.scope ?? {};
        governedKpiReport = await runKpiReport(validateKpiReportRequest({
          cubeId: sourceSelection.cubeId,
          year: normalizedRequest.year,
          month: normalizedRequest.months[0],
          entity: scope.entity,
          forecastScenario: scope.forecastScenario ?? "YTD Forecast",
        }));
        preparedSource = {
          source: { id: sourceSelection.cubeId, name: source.name, sourceType: "enterprise" },
          plan: {
            year: normalizedRequest.year,
            measures: governedKpiReport.metrics.map((metric) => ({
              column: metric.id,
              label: metric.label,
              aggregation: "sum",
              valueType: metric.unit === "percent" ? "percentage" : metric.unit === "capacity" ? "count" : "currency",
              filters: [],
            })),
          },
        };
        deterministic = {
          measures: governedKpiReport.metrics.map((metric) => ({
            measureId: metric.id,
            actual: metric.actual ?? 0,
            budget: metric.forecast ?? 0,
            variance: metric.variance ?? 0,
            variancePct: metric.variancePercent === null || metric.variancePercent === undefined
              ? null
              : metric.variancePercent * 100,
            favorable: null,
            contribution: null,
          })),
          contributors: [],
          evidence: [{
            sourceId: sourceSelection.cubeId,
            sourceType: "enterprise",
            queryFingerprint: "governed-kpi-v1",
            period: governedKpiReport.periodLabel,
            rowCount: governedKpiReport.metrics.reduce(
              (count, metric) => count + metric.actualSourceRows,
              0,
            ),
          }],
        };
      } else {
        preparedSource = await prepareEnterpriseBoardSource({
          userId: run.requestedBy, selection: sourceSelection, config: effectiveSnapshot.config,
          boardSettings: settings, request: normalizedRequest,
        });
        deterministic = deterministicAnalysisResultSchema.parse(await executeEnterpriseDeterministicAnalysis({
          cubeId: preparedSource.source.id,
          actualVersion: standaloneTemplate ? standaloneVersion : mapping.actuals,
          budgetVersion: standaloneTemplate ? standaloneVersion : mapping.budget,
          plan: preparedSource.plan, sourceName: preparedSource.source.name,
        }));
      }
    }
    const primaryMeasure = preparedSource.plan.measures[0];
    const legacyCompatible = !standaloneTemplate && !!mapping.actuals && !!mapping.budget && primaryMeasure?.column === "amount_usd"
      && primaryMeasure.aggregation === "sum"
      && primaryMeasure.valueType === "currency"
      && preparedSource.plan.measures.length === 1
      && primaryMeasure.filters.length === 0;
    let legacyReport: Awaited<ReturnType<typeof runBoardAnalysis>> | undefined;
    if (legacyCompatible && sourceSelection.sourceType === "enterprise") {
      const legacyRequest: AnalysisRequest = createLegacyBoardAnalysisRequest({
        boardId: board.id,
        cubeId: preparedSource.source.id,
        mapping,
        settings,
        request: normalizedRequest,
        plan: preparedSource.plan,
        domainAiConfig: await resolveDomainAiConfigForUser(run.requestedBy),
      });
      legacyReport = await runBoardAnalysis(legacyRequest);
    }
    const currentRun = await db.select({ cancelRequested: boardAnalysisRuns.cancelRequested })
      .from(boardAnalysisRuns).where(eq(boardAnalysisRuns.id, runId)).limit(1);
    if (currentRun[0]?.cancelRequested === 1) {
      await db.update(boardAnalysisRuns).set({
        status: "cancelled", progressStage: "Cancelled", completedAt: new Date(), durationMs: Date.now() - started,
      }).where(eq(boardAnalysisRuns.id, runId));
      return { run: { ...run, status: "cancelled" }, report: undefined, legacyReport: undefined };
    }
    await db.update(boardAnalysisRuns).set({ progressPercent: 85, progressStage: "Persisting report" })
      .where(eq(boardAnalysisRuns.id, runId));
    const result = parseBoardAnalysisResult(standaloneTemplate ? {
      summary: `Standalone ${run.templateKey} analysis for ${preparedSource.plan.year}.`,
      kpis: deterministic.measures.map((measure) => ({
        label: measure.measureId,
        value: String(measure.actual),
      })),
      tables: [{
        title: "Board metrics",
        columns: ["Metric", "Value"],
        rows: deterministic.measures.map((measure) => [measure.measureId, measure.actual]),
      }],
      kpiReport: governedKpiReport ? {
        scope: `${preparedSource.source.name} · ${governedKpiReport.entityLabel} · ${governedKpiReport.periodLabel}`,
        metrics: governedKpiReport.metrics.map((metric) => ({
          label: metric.label,
          actual: metric.actual,
          forecast: metric.forecast,
          variance: metric.variance,
          variancePercent: metric.variancePercent,
        })),
        warnings: governedKpiReport.warnings,
      } : {
        scope: `${preparedSource.source.name} · ${standaloneVersion ?? "available source data"} · ${preparedSource.plan.year}`,
        metrics: deterministic.measures.map((measure) => ({
          label: measure.measureId,
          actual: measure.actual,
          forecast: null,
          variance: null,
          variancePercent: null,
        })),
        warnings: standaloneVersion ? [] : ["No explicit data version was selected; the first available source version was used."],
      },
    } : {
      summary: legacyReport?.rawAnalysis?.slice(0, 4_000)
        || `Deterministic analysis for ${preparedSource.plan.measures.map((measure: { label: string }) => measure.label).join(", ")}.`,
      kpis: deterministic.measures.map((measure) => ({
        label: measure.measureId,
        value: String(measure.actual),
        change: String(measure.variance),
        direction: measure.variance === 0 ? "flat" : measure.variance > 0 ? "up" : "down",
      })),
      tables: [{
        title: "Deterministic totals",
        columns: ["Measure", "Actual", "Budget", "Variance", "Variance %"],
        rows: deterministic.measures.map((measure) => [measure.measureId, measure.actual, measure.budget, measure.variance, measure.variancePct]),
      }],
    });
    const created = await db.insert(boardReports).values({
      boardId: board.id,
      runId: run.id,
      templateKey: run.templateKey,
      title: legacyReport?.title ?? `${preparedSource.plan.year} — Deterministic Analysis`,
      periodLabel: legacyReport?.periodLabel ?? `${preparedSource.plan.year}`,
      result,
      schemaVersion: BOARD_RESULT_SCHEMA_VERSION,
      deterministicMetrics: deterministic,
      sourceSnapshot: run.sourceSnapshot,
      configSnapshot: run.configSnapshot,
      evidenceManifest: {
        sourceType: preparedSource.source.sourceType,
        sourceIds: [preparedSource.source.id],
        generatedAt: new Date().toISOString(),
      },
      formulaEngineVersion: run.formulaEngineVersion ?? BOARD_FORMULA_ENGINE_VERSION,
      promptVersion: run.promptVersion ?? "legacy-board-prompt-v1",
      modelMetadata: {},
      rawModelOutput: legacyReport?.rawAnalysis ?? null,
      status: "complete",
    }).onConflictDoNothing({ target: boardReports.runId }).returning();
    const persistedReport = created[0] ?? (await db.select().from(boardReports).where(eq(boardReports.runId, runId)).limit(1))[0];
    const finalized = await db.update(boardAnalysisRuns).set({
      status: "complete", progressPercent: 100, progressStage: "Complete",
      completedAt: new Date(), durationMs: Date.now() - started,
    }).where(and(eq(boardAnalysisRuns.id, runId), eq(boardAnalysisRuns.status, "running"), eq(boardAnalysisRuns.cancelRequested, 0))).returning();
    if (!finalized[0]) {
      await db.delete(boardReports).where(eq(boardReports.runId, runId));
      await db.update(boardAnalysisRuns).set({
        status: "cancelled", progressStage: "Cancelled", completedAt: new Date(), durationMs: Date.now() - started,
      }).where(and(eq(boardAnalysisRuns.id, runId), eq(boardAnalysisRuns.status, "running")));
      return { run: { ...run, status: "cancelled" }, report: persistedReport, legacyReport: undefined };
    }
    return { run: { ...run, status: "complete", progressPercent: 100 }, report: persistedReport, legacyReport };
  } catch (error) {
    await db.update(boardAnalysisRuns).set({
      status: "error", progressStage: "Error", errorMessage: error instanceof Error ? error.message : String(error),
      failureCategory: "analysis_error",
      completedAt: new Date(), durationMs: Date.now() - started,
    }).where(and(eq(boardAnalysisRuns.id, runId), eq(boardAnalysisRuns.status, "running")));
    throw error;
  }
}

export async function listBoardReports(boardId: string, userId: string) {
  const board = await storage.getBoard(boardId);
  if (!board || board.userId !== userId) throw new Error("Board not found");
  return db.select().from(boardReports).where(eq(boardReports.boardId, boardId)).orderBy(desc(boardReports.createdAt));
}

export async function getBoardRun(boardId: string, runId: string, userId: string) {
  const board = await storage.getBoard(boardId);
  if (!board || board.userId !== userId) throw new Error("Board not found");
  const result = await db.select().from(boardAnalysisRuns)
    .where(and(eq(boardAnalysisRuns.id, runId), eq(boardAnalysisRuns.boardId, boardId))).limit(1);
  return result[0];
}

export async function listBoardRuns(boardId: string, userId: string) {
  const board = await storage.getBoard(boardId);
  if (!board || board.userId !== userId) throw new Error("Board not found");
  return db.select().from(boardAnalysisRuns)
    .where(eq(boardAnalysisRuns.boardId, boardId))
    .orderBy(desc(boardAnalysisRuns.createdAt))
    .limit(10);
}

export async function cancelBoardAnalysis(boardId: string, runId: string, userId: string) {
  const run = await getBoardRun(boardId, runId, userId);
  if (!run) throw new Error("Analysis run not found");
  const updated = await db.update(boardAnalysisRuns).set({
    cancelRequested: 1, status: run.status === "queued" ? "cancelled" : "cancel_requested",
    progressStage: "Cancellation requested",
    cancelRequestedAt: new Date(),
  }).where(and(eq(boardAnalysisRuns.id, runId), eq(boardAnalysisRuns.status, run.status))).returning();
  return updated[0];
}