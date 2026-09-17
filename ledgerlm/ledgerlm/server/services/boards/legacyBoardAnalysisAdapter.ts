import type { AnalysisRequest, ColumnMapping } from "../boardAnalysisService";
import type { BoardAnalysisRequest } from "./boardRunService";
import type { BoardScopeQueryPlan } from "./sources/scopeQueryPlanner";

export function createLegacyBoardAnalysisRequest(params: {
  boardId: string;
  cubeId: string;
  mapping: ColumnMapping;
  settings: Record<string, unknown>;
  request: BoardAnalysisRequest;
  plan: BoardScopeQueryPlan;
  domainAiConfig: AnalysisRequest["domainAiConfig"];
}): AnalysisRequest {
  return {
    boardId: params.boardId,
    cubeId: params.cubeId,
    columnMapping: params.mapping,
    year: params.plan.year,
    months: params.plan.months,
    dimensions: params.plan.dimensions,
    metricColumn: params.plan.metricColumn,
    scopeFilters: params.plan.filters,
    maxGroups: params.plan.maxGroups,
    systemPromptTemplate: String(params.settings.analysisPrompts ?? ""),
    userPromptTemplate: params.request.userPromptTemplate ?? String(params.settings.userPromptTemplate ?? ""),
    extraContext: params.request.extraContext ?? "",
    comparison: params.plan.comparison,
    domainAiConfig: params.domainAiConfig,
  };
}
