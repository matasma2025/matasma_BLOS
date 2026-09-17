import { db } from "../../db";
import { storage } from "../../storage";
import {
  boardAnalysisConfigs,
  boardAnalysisRuns,
  boardReports,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { runBoardAnalysis, type AnalysisRequest } from "../boardAnalysisService";
import { resolveDomainAiConfigForUser } from "../domainAiConfigService";
import { assertBoardSourceAccess, type BoardSourceSelection, getAuthorizedBoardSource } from "../boardSourceService";
import { markdownToBoardAnalysisResult } from "./boardResultSchema";
import {
  BOARD_FORMULA_ENGINE_VERSION,
  BOARD_RESULT_SCHEMA_VERSION,
} from "@shared/boards/boardRun";
import { prepareEnterpriseBoardSource } from "./sources/enterpriseSourceLoader";
import { createLegacyBoardAnalysisRequest } from "./legacyBoardAnalysisAdapter";

export interface BoardAnalysisRequest {
  year?: number;
  months?: number[];
  dimensions?: string[];
  keyColumns?: Array<{
    column: string;
    label: string;
    aggregation?: "sum" | "last" | "average" | "min" | "max";
    valueType?: "currency" | "percentage" | "count" | "ratio";
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
}) {
  const board = await storage.getBoard(params.boardId);
  if (!board || board.userId !== params.userId) throw new Error("Board not found");
  const config = await getOrCreateBoardAnalysisConfig(params.boardId);
  const selection = params.request.sourceSelection
    ?? (config?.sourceConfig as BoardSourceSelection | undefined)
    ?? ((board.settings as any)?.cubeId ? { sourceType: "enterprise", cubeId: (board.settings as any).cubeId } : undefined);
  if (!selection) throw new Error("Select an authorized source before starting an analysis");
  if (selection.sourceType !== "enterprise") {
    throw new Error("Vault analysis is not available in this phase; select an authorized Enterprise Data source");
  }
  await assertBoardSourceAccess(params.userId, selection);
  const source = await getAuthorizedBoardSource(params.userId, selection);
  const normalizedRequest = normalizeBoardRunRequest(params.request);
  const templateKey = config?.templateKey ?? "variance-analysis";
  const effectiveConfigSnapshot = {
    config: config ?? null,
    boardSettings: board.settings ?? {},
    request: normalizedRequest,
    sourceSelection: selection,
  };
  const created = await db.insert(boardAnalysisRuns).values({
    boardId: params.boardId,
    requestedBy: params.userId,
    templateKey,
    requestConfig: normalizedRequest,
    sourceSnapshot: { id: source.id, name: source.name, sourceType: source.sourceType },
    configSnapshot: effectiveConfigSnapshot,
    resultSchemaVersion: BOARD_RESULT_SCHEMA_VERSION,
    formulaEngineVersion: BOARD_FORMULA_ENGINE_VERSION,
    promptVersion: "legacy-board-prompt-v1",
    status: "queued",
    progressPercent: 0,
    progressStage: "Queued",
  }).returning();
  return created[0];
}

export async function executeBoardAnalysis(runId: string) {
  const rows = await db.select().from(boardAnalysisRuns).where(eq(boardAnalysisRuns.id, runId)).limit(1);
  const run = rows[0];
  if (!run) throw new Error("Analysis run not found");
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
  await db.update(boardAnalysisRuns).set({
    status: "running", progressPercent: 15, progressStage: "Authorizing source", startedAt: new Date(),
  }).where(eq(boardAnalysisRuns.id, runId));

  const started = Date.now();
  try {
    if (selection.sourceType !== "enterprise" || !selection.id) {
      throw new Error("Vault analysis is not available for this Board template yet; select an authorized Enterprise Data source.");
    }
    const sourceSelection = { sourceType: "enterprise" as const, cubeId: selection.id };
    if (effectiveSnapshot.sourceSelection) {
      const snapshottedSourceId = sourceId(effectiveSnapshot.sourceSelection);
      if (effectiveSnapshot.sourceSelection.sourceType !== selection.sourceType || snapshottedSourceId !== selection.id) {
        throw new Error("Board run source snapshot does not match the queued configuration");
      }
    }
    const settings = (effectiveSnapshot.boardSettings ?? board.settings ?? {}) as any;
    const mapping = settings.columnMapping;
    if (!mapping?.actuals || !mapping?.budget) {
      throw new Error("Configure actuals and budget versions on the Board before running an Enterprise Data analysis.");
    }
    // New runs already contain queue-time normalized periods. This fallback is
    // retained only for immutable snapshots created before Phase 2.
    const normalizedRequest = normalizeBoardRunRequest(request);
    await db.update(boardAnalysisRuns).set({ progressPercent: 35, progressStage: "Computing deterministic metrics" })
      .where(eq(boardAnalysisRuns.id, runId));
    const preparedSource = await prepareEnterpriseBoardSource({
      userId: run.requestedBy,
      selection: sourceSelection,
      config: effectiveSnapshot.config,
      boardSettings: settings,
      request: normalizedRequest,
    });
    const legacyRequest: AnalysisRequest = createLegacyBoardAnalysisRequest({
      boardId: board.id,
      cubeId: preparedSource.source.id,
      mapping,
      settings,
      request: normalizedRequest,
      plan: preparedSource.plan,
      domainAiConfig: await resolveDomainAiConfigForUser(run.requestedBy),
    });
    const legacyReport = await runBoardAnalysis(legacyRequest);
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
    const result = markdownToBoardAnalysisResult(legacyReport.rawAnalysis ?? "", legacyReport.varianceData);
    const created = await db.insert(boardReports).values({
      boardId: board.id,
      runId: run.id,
      templateKey: run.templateKey,
      title: legacyReport.title,
      periodLabel: legacyReport.periodLabel,
      result,
      schemaVersion: BOARD_RESULT_SCHEMA_VERSION,
      deterministicMetrics: { varianceData: legacyReport.varianceData, dimensions: legacyReport.dimensions },
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
      rawModelOutput: legacyReport.rawAnalysis,
      status: "complete",
    }).returning();
    await db.update(boardAnalysisRuns).set({
      status: "complete", progressPercent: 100, progressStage: "Complete",
      completedAt: new Date(), durationMs: Date.now() - started,
    }).where(eq(boardAnalysisRuns.id, runId));
    return { run: { ...run, status: "complete", progressPercent: 100 }, report: created[0], legacyReport };
  } catch (error) {
    await db.update(boardAnalysisRuns).set({
      status: "error", progressStage: "Error", errorMessage: error instanceof Error ? error.message : String(error),
      failureCategory: "analysis_error",
      completedAt: new Date(), durationMs: Date.now() - started,
    }).where(eq(boardAnalysisRuns.id, runId));
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

export async function cancelBoardAnalysis(boardId: string, runId: string, userId: string) {
  const run = await getBoardRun(boardId, runId, userId);
  if (!run) throw new Error("Analysis run not found");
  const updated = await db.update(boardAnalysisRuns).set({
    cancelRequested: 1, status: run.status === "queued" ? "cancelled" : "cancel_requested",
    progressStage: "Cancellation requested",
    cancelRequestedAt: new Date(),
  }).where(eq(boardAnalysisRuns.id, runId)).returning();
  return updated[0];
}