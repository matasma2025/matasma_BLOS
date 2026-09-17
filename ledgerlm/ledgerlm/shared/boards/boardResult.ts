export {
  BOARD_RESULT_SCHEMA_VERSION,
} from "./boardRun";

export type BoardSpecializedResultKind = "balance-sheet" | "entity-pnl" | "kpi-report";

export {
  BOARD_DETERMINISTIC_SCHEMA_VERSION,
  BOARD_FORMULA_ENGINE_VERSION,
  deterministicAnalysisRequestSchema,
  deterministicAnalysisResultSchema,
  deterministicEvidenceSchema,
  deterministicMeasureResultSchema,
} from "./deterministicAnalysis";
export type {
  DeterministicAnalysisRequest,
  DeterministicAnalysisResult,
  DeterministicEvidence,
  DeterministicMeasure,
  DeterministicMeasureResult,
} from "./deterministicAnalysis";
