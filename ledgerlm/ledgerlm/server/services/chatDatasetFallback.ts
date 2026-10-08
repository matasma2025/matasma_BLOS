import type { Evidence, SemanticSQLEvidence } from "./queryOrchestrator";

export const UNSUPPORTED_DATASET_QUESTION =
  "The requested metric is not supported by the selected dataset. Please revise your question to reference an available metric.";

// This is the exact projection emitted by compile_sql's empty-selection
// fallback. A response's rowCount is metadata and must never be used here.
const FALLBACK_SQL =
  /^\s*SELECT\s+COUNT\s*\(\s*\*\s*\)\s+AS\s+row_count\s+FROM\s+cube_fact_data\b/i;
const RECORDS = "(?:rows?|records?|entries|data\\s+(?:points?|rows?|records?))";
const COUNT_REQUEST = new RegExp(
  "^(?:(?:please|can you|could you|would you)\\s+)*" +
    "(?:(?:(?:show|give|tell)(?:\\s+me)?|what is|what's)\\s+)?" +
    "(?:(?:how many(?:\\s+total)?|(?:the\\s+)?(?:total\\s+)?number of)\\s+" + RECORDS + "\\b" +
    "|count\\s+(?:(?:all|the|total)\\s+)*(?:number of\\s+)?" + RECORDS + "\\b" +
    "|(?:the\\s+)?(?:total\\s+)?(?:row|record|dataset|data set)\\s+count\\b" +
    "|(?:the\\s+)?(?:dataset|data set)\\s+size\\b" +
    "|(?:the\\s+)?size\\s+of\\s+(?:(?:the|this|my)\\s+)?(?:dataset|data set)\\b)",
  "i",
);

export function isDatasetCountFallback(evidence: Evidence): evidence is SemanticSQLEvidence {
  return evidence.source === "semantic_sql"
    && FALLBACK_SQL.test(evidence.sqlQuery)
    && evidence.columns.length === 1
    && evidence.columns[0].toLowerCase() === "row_count";
}

/** Only Chat calls this; shared SQL compilation and Board behaviour stay intact. */
export function resolveChatDatasetFallback(query: string, evidence: Evidence[]) {
  if (COUNT_REQUEST.test(query.trim())) {
    return { evidence, unsupported: false };
  }

  const filteredEvidence = evidence.filter((item) => !isDatasetCountFallback(item));
  const removedFallback = filteredEvidence.length !== evidence.length;
  // Another selected source may genuinely answer the question. Keep that
  // source, but never include an unrelated fallback count in the LLM context.
  const hasUsableEvidence = filteredEvidence.some((item) => {
    if (item.source === "semantic_sql" || item.source === "database") {
      return item.results.length > 0;
    }
    return item.source === "document" ? Boolean(item.content.trim()) : Boolean(item.snippet.trim());
  });

  return {
    evidence: filteredEvidence,
    unsupported: removedFallback && !hasUsableEvidence,
  };
}
