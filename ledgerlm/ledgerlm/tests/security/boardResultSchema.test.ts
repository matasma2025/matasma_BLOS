import assert from "node:assert/strict";
import test from "node:test";
import {
  boardAnalysisResultSchema,
  markdownToBoardAnalysisResult,
} from "../../server/services/boards/boardResultSchema";

test("normalizes a minimal Board result with versioned defaults", () => {
  const result = boardAnalysisResultSchema.parse({ summary: "Controlled result" });
  assert.equal(result.schemaVersion, 2);
  assert.deepEqual(result.kpis, []);
  assert.deepEqual(result.charts, []);
  assert.deepEqual(result.actions, []);
});

test("accepts bounded specialized Board results", () => {
  const result = boardAnalysisResultSchema.parse({
    summary: "Specialized result",
    balanceSheet: {
      balanced: false,
      difference: 125,
      totals: { assets: 1_000, liabilities: 500, equity: 375 },
      ratios: { currentRatio: 1.25, quickRatio: null },
      unmappedRows: ["Unknown clearing account"],
    },
    entityPnl: {
      entity: "Example entity",
      currency: "USD",
      metrics: { revenue: 100, ebit: 12 },
      warnings: [],
    },
    kpiReport: {
      scope: "Example entity",
      metrics: [{
        label: "Utilization",
        actual: 80,
        forecast: 82,
        variance: -2,
        variancePercent: -2.44,
      }],
      warnings: [],
    },
  });

  assert.equal(result.balanceSheet?.difference, 125);
  assert.equal(result.entityPnl?.metrics.ebit, 12);
  assert.equal(result.kpiReport?.metrics[0]?.actual, 80);
});

test("rejects unknown and unbounded Board result fields", () => {
  assert.equal(boardAnalysisResultSchema.safeParse({
    summary: "Result",
    userId: "attacker-controlled",
  }).success, false);

  assert.equal(boardAnalysisResultSchema.safeParse({
    summary: "Result",
    kpis: Array.from({ length: 21 }, (_, index) => ({
      label: `KPI ${index}`,
      value: "1",
    })),
  }).success, false);

  assert.equal(boardAnalysisResultSchema.safeParse({
    schemaVersion: 999,
    summary: "Unsupported future result",
  }).success, false);

  assert.equal(boardAnalysisResultSchema.safeParse({
    summary: "Non-finite result",
    balanceSheet: {
      balanced: false,
      difference: Number.POSITIVE_INFINITY,
      totals: {},
      ratios: {},
      unmappedRows: [],
    },
  }).success, false);
});

test("persists the governed Balance Sheet commentary without dropping evidence", () => {
  const commentaryFacts = [{
    id: "assets-cash", category: "Cash", section: "assets" as const,
    kind: "composition" as const, text: "Cash forms part of current assets.",
  }];
  const categoryCommentary = [{
    category: "Cash", section: "assets" as const, text: "Cash forms part of current assets.",
    evidenceIds: ["assets-cash"], source: "factual-fallback" as const,
  }];
  const payload = {
    summary: "Balance Sheet",
    balanceSheet: { balanced: true, difference: 0,
      totals: { assets: 100, liabilities: 60, equity: 40 }, ratios: {},
      unmappedRows: [], commentaryFacts, categoryCommentary,
      commentaryStatus: "factual-fallback",
    },
  };
  const result = boardAnalysisResultSchema.parse(payload);
  assert.deepEqual(result.balanceSheet?.commentaryFacts, commentaryFacts);
  assert.deepEqual(result.balanceSheet?.categoryCommentary, categoryCommentary);
  assert.equal(result.balanceSheet?.commentaryStatus, "factual-fallback");
  assert.equal(boardAnalysisResultSchema.safeParse({
    ...payload, balanceSheet: { ...payload.balanceSheet, commentaryStatus: "invented" },
  }).success, false);
  assert.equal(boardAnalysisResultSchema.safeParse({
    ...payload, balanceSheet: { ...payload.balanceSheet,
      commentaryFacts: Array.from({ length: 201 }, () => commentaryFacts[0]) },
  }).success, false);
});

test("keeps legacy markdown conversion compatible", () => {
  const result = markdownToBoardAnalysisResult("- Revenue was above budget.", [{
    k: "Revenue",
    a: 110,
    b: 100,
    v: 10,
    vp: 10,
  }]);

  assert.equal(result.schemaVersion, 2);
  assert.deepEqual(result.insights, ["Revenue was above budget."]);
  assert.equal(result.tables[0]?.rows[0]?.[0], "Revenue");
});