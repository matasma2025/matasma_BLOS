import { db } from "../../db";
import { storage } from "../../storage";
import {
  boardAnalysisConfigs,
  boardAnalysisRuns,
  boardReports,
  type BoardAnalysisRequest as _Unused,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { runBoardAnalysis, type AnalysisRequest } from "../boardAnalysisService";
import { resolveDomainAiConfigForUser } from "../domainAiConfigService";
import { assertBoardSourceAccess, type BoardSourceSelection, getAuthorizedBoardSource } from "../boardSourceService";
import { markdownToBoardAnalysisResult } from "./boardResultSchema";

export interface BoardAnalysisRequest {
  year?: number;
  months?: number[];
  dimensions?: string[];
  sourceSelection?: BoardSourceSelection;
  extraContext?: string;
  userPromptTemplate?: string;
  comparison?: { year: number; months: number[]; label?: string };
}

function sourceId(selection: BoardSourceSelection) {
  return selection.sourceType === "enterprise" ? selection.cubeId : selection.documentId;
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
  await assertBoardSourceAccess(params.userId, selection);
  const source = await getAuthorizedBoardSource(params.userId, selection);
  const templateKey = config?.templateKey ?? "variance-analysis";
  const created = await db.insert(boardAnalysisRuns).values({
    boardId: params.boardId,
    requestedBy: params.userId,
    templateKey,
    requestConfig: params.request,
    sourceSnapshot: { id: source.id, name: source.name, sourceType: source.sourceType },
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
  const request = (run.requestConfig ?? {}) as BoardAnalysisRequest;
  const selection = (run.sourceSnapshot ?? {}) as { sourceType?: "enterprise" | "vault"; id?: string };
  await db.update(boardAnalysisRuns).set({
    status: "running", progressPercent: 15, progressStage: "Authorizing source", startedAt: new Date(),
  }).where(eq(boardAnalysisRuns.id, runId));

  const started = Date.now();
  try {
    if (selection.sourceType !== "enterprise" || !selection.id) {
      throw new Error("Vault analysis is not available for this Board template yet; select an authorized Enterprise Data source.");
    }
    const settings = (board.settings as any) ?? {};
    const mapping = settings.columnMapping;
    if (!mapping?.actuals || !mapping?.budget) {
      throw new Error("Configure actuals and budget versions on the Board before running an Enterprise Data analysis.");
    }
    const year = Number(request.year ?? new Date().getFullYear());
    const months = (request.months?.length ? request.months : [new Date().getMonth() + 1]).map(Number);
    await db.update(boardAnalysisRuns).set({ progressPercent: 35, progressStage: "Computing deterministic metrics" })
      .where(eq(boardAnalysisRuns.id, runId));
    const legacyRequest: AnalysisRequest = {
      boardId: board.id,
      cubeId: selection.id,
      columnMapping: mapping,
      year,
      months,
      dimensions: request.dimensions ?? settings.defaultDimensions ?? ["Entity", "Sector", "Cost Category"],
      systemPromptTemplate: settings.analysisPrompts ?? "",
      userPromptTemplate: request.userPromptTemplate ?? settings.userPromptTemplate ?? "",
      extraContext: request.extraContext ?? "",
      comparison: request.comparison,
      domainAiConfig: await resolveDomainAiConfigForUser(run.requestedBy),
    };
    const legacyReport = await runBoardAnalysis(legacyRequest);
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
      deterministicMetrics: { varianceData: legacyReport.varianceData, dimensions: legacyReport.dimensions },
      sourceSnapshot: run.sourceSnapshot,
      configSnapshot: (await getOrCreateBoardAnalysisConfig(board.id)) ?? {},
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
  }).where(eq(boardAnalysisRuns.id, runId)).returning();
  return updated[0];
}