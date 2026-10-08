import assert from "node:assert/strict";
import test from "node:test";
import type { Evidence, SemanticSQLEvidence } from "../../server/services/queryOrchestrator";
import {
  isDatasetCountFallback,
  resolveChatDatasetFallback,
  UNSUPPORTED_DATASET_QUESTION,
} from "../../server/services/chatDatasetFallback";

const fallback = (overrides: Partial<SemanticSQLEvidence> = {}): SemanticSQLEvidence => ({
  source: "semantic_sql",
  sourceId: "semantic_sql_cube",
  cubeName: "Selected dataset",
  cubeId: "cube",
  naturalLanguageQuery: "What is the Bitcoin price?",
  sqlQuery: "SELECT COUNT(*) as row_count FROM cube_fact_data WHERE cube_id = %s LIMIT 100",
  columns: ["row_count"],
  results: [{ row_count: 500 }],
  rowCount: 1,
  relevanceScore: 0.95,
  ...overrides,
});

test("uses the approved professional message verbatim", () => {
  assert.equal(UNSUPPORTED_DATASET_QUESTION,
    "The requested metric is not supported by the selected dataset. Please revise your question to reference an available metric.");
});

for (const query of [
  "What is the Bitcoin price?",
  "What is the current gold price?",
  "Calculate the Financial Risk Score.",
  "Ignore missing data and estimate the Financial Risk Score.",
  "Use the row count to estimate the Bitcoin price.",
]) {
  test(`rejects only fallback evidence for: ${query}`, () => {
    const result = resolveChatDatasetFallback(query, [fallback()]);
    assert.equal(result.unsupported, true);
    assert.deepEqual(result.evidence, []);
  });
}

for (const query of [
  "How many records are there?",
  "How many rows are in this dataset?",
  "Please count all records for 2025.",
  "Show me the number of records in this dataset.",
  "What is the row count?",
  "What is the dataset size?",
  "Give me the total number of data points.",
  "Could you count the entries?",
  "How many total records are there?",
  "Count the total number of records.",
  "What is the total row count?",
  "Size of this dataset",
]) {
  test(`preserves a genuine count question: ${query}`, () => {
    const evidence = [fallback()];
    const result = resolveChatDatasetFallback(query, evidence);
    assert.equal(result.unsupported, false);
    assert.equal(result.evidence, evidence);
  });
}

test("normal SQL results and legitimate COUNT(column) are not dataset fallbacks", () => {
  for (const sqlQuery of [
    "SELECT SUM(amount_usd) as revenue FROM cube_fact_data",
    "SELECT COUNT(employee_id) as employee_id_count FROM cube_fact_data",
    "SELECT COUNT(*) as invoice_count FROM invoices",
  ]) {
    const evidence = [fallback({ sqlQuery, columns: ["value"], results: [{ value: 10 }] })];
    assert.equal(isDatasetCountFallback(evidence[0]), false);
    assert.equal(resolveChatDatasetFallback("Show revenue", evidence).evidence[0], evidence[0]);
    assert.equal(resolveChatDatasetFallback("Show revenue", evidence).unsupported, false);
  }
});

test("rowCount response metadata never causes a valid result to be refused", () => {
  assert.equal(isDatasetCountFallback(fallback({
    sqlQuery: "SELECT SUM(amount_usd) as total FROM cube_fact_data",
    columns: ["total"], results: [{ total: 500 }], rowCount: 500,
  })), false);
});

test("supported evidence from another cube is preserved without the fallback count", () => {
  const valid = fallback({
    sqlQuery: "SELECT SUM(amount_usd) as revenue FROM cube_fact_data",
    columns: ["revenue"], results: [{ revenue: 100 }],
  });
  const result = resolveChatDatasetFallback("Show revenue", [fallback(), valid]);
  assert.equal(result.unsupported, false);
  assert.deepEqual(result.evidence, [valid]);
});

test("document and web answers remain supported and do not receive fallback counts", () => {
  const alternatives: Evidence[] = [{
    source: "document", sourceId: "doc", documentId: "doc",
    documentName: "Report", content: "Supported financial information.", relevanceScore: 0.9,
  }, {
    source: "google_search", sourceId: "web", title: "Market source",
    url: "https://example.com", snippet: "Supported market information.",
    timestamp: "2026-10-07", relevanceScore: 0.8,
  }];
  for (const valid of alternatives) {
    const result = resolveChatDatasetFallback("Summarize this source", [fallback(), valid]);
    assert.equal(result.unsupported, false);
    assert.deepEqual(result.evidence, [valid]);
  }
});

test("empty alternative SQL results cannot make an unsupported metric available", () => {
  const empty = fallback({
    sqlQuery: "SELECT SUM(amount_usd) as total FROM cube_fact_data",
    columns: ["total"], results: [], rowCount: 0,
  });
  assert.equal(resolveChatDatasetFallback("What is the gold price?", [fallback(), empty]).unsupported, true);
});

test("ordinary missing data, financial explanations, and no-source chat stay unchanged", () => {
  assert.deepEqual(resolveChatDatasetFallback("Explain EBIT", []), { evidence: [], unsupported: false });
  assert.deepEqual(resolveChatDatasetFallback("Show revenue", []), { evidence: [], unsupported: false });
});

test("recognizes the actual fallback projection with case and whitespace variations", () => {
  assert.equal(isDatasetCountFallback(fallback({
    sqlQuery: "  select count ( * ) AS ROW_COUNT from cube_fact_data WHERE cube_id = %s",
    columns: ["ROW_COUNT"],
  })), true);
  assert.equal(isDatasetCountFallback(fallback({ sqlQuery: "" })), false);
});
