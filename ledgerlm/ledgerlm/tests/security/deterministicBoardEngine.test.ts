import assert from "node:assert/strict";
import test from "node:test";
import { runDeterministicBoardEngine } from "../../server/services/boards/deterministicBoardEngine";
import type { DeterministicAnalysisRequest, DeterministicMeasureResult } from "../../shared/boards/deterministicAnalysis";

const measures: DeterministicAnalysisRequest["measures"] = [
  { id: "amount_usd", label: "Revenue", aggregation: "sum", valueType: "currency", favorability: "higher-is-favorable", filters: [] },
  { id: "headcount", label: "Headcount", aggregation: "last", valueType: "count", favorability: "neutral", filters: [] },
  {
    id: "utilization", label: "Utilization", aggregation: "ratio", valueType: "ratio",
    favorability: "higher-is-favorable", numerator: "billable_hours", denominator: "total_hours", filters: [],
  },
  { id: "records", label: "Records", aggregation: "count", valueType: "count", favorability: "neutral", filters: [] },
];

function total(measureId: string, actual: number, budget: number): DeterministicMeasureResult {
  const variance = actual - budget;
  return {
    measureId, actual, budget, variance,
    variancePct: budget === 0 ? null : variance / Math.abs(budget) * 100,
    contribution: null, favorable: null, material: true,
  };
}

test("uses authoritative totals independently of contributor limits and preserves measure semantics", () => {
  const result = runDeterministicBoardEngine({
    request: { schemaVersion: 1, measures, contributorLimit: 1 },
    authoritativeTotals: [
      { ...total("amount_usd", 300, 250), favorable: true },
      total("headcount", 12, 10),
      { ...total("utilization", 0.8, 0.75), favorable: true },
      total("records", 42, 40),
    ],
    rows: [
      {
        key: "B",
        actual: { amount_usd: 200, headcount: 7, billable_hours: 80, total_hours: 100, records: 25 },
        budget: { amount_usd: 150, headcount: 6, billable_hours: 70, total_hours: 100, records: 20 },
      },
      {
        key: "A",
        actual: { amount_usd: 100, headcount: 5, billable_hours: 40, total_hours: 50, records: 17 },
        budget: { amount_usd: 100, headcount: 4, billable_hours: 35, total_hours: 50, records: 20 },
      },
    ],
  });

  assert.equal(result.measures.find((measure) => measure.measureId === "amount_usd")?.actual, 300);
  assert.equal(result.contributors.length, 1);
  assert.equal(result.contributors[0]?.key, "A");
  assert.equal(result.contributors[0]?.measures.find((measure) => measure.measureId === "records")?.actual, 17);
  assert.equal(result.contributors[0]?.measures.find((measure) => measure.measureId === "utilization")?.actual, 0.8);
});

test("calculates comparison ratios and zero denominators deterministically", () => {
  const ratio = measures[2]!;
  const result = runDeterministicBoardEngine({
    request: { schemaVersion: 1, measures: [ratio], contributorLimit: 10 },
    rows: [{
      key: "A",
      actual: { billable_hours: 10, total_hours: 0 },
      budget: { billable_hours: 5, total_hours: 10 },
      comparisonActual: { billable_hours: 8, total_hours: 10 },
      comparisonBudget: { billable_hours: 4, total_hours: 10 },
    }],
  });
  const measure = result.contributors[0]!.measures[0]!;
  assert.equal(measure.actual, 0);
  assert.equal(measure.budget, 0.5);
  assert.equal(measure.comparisonActual, 0.8);
  assert.equal(measure.comparisonBudget, 0.4);
  assert.equal(measure.comparisonVariance, 0.4);
});

test("enforces bounded result contracts and binary deterministic ordering", () => {
  const measure = measures[0]!;
  const ordered = runDeterministicBoardEngine({
    request: { schemaVersion: 1, measures: [measure], contributorLimit: 10 },
    rows: [
      { key: JSON.stringify(["A | B", null]), actual: { amount_usd: 1 }, budget: { amount_usd: 0 } },
      { key: JSON.stringify(["A", "B | null"]), actual: { amount_usd: 1 }, budget: { amount_usd: 0 } },
    ],
  });
  assert.equal(ordered.contributors.length, 2);
  assert.notEqual(ordered.contributors[0]?.key, ordered.contributors[1]?.key);

  assert.throws(() => runDeterministicBoardEngine({
    request: { schemaVersion: 1, measures: [measure], contributorLimit: 10 },
    rows: [{ key: "x".repeat(1001), actual: { amount_usd: 1 }, budget: { amount_usd: 0 } }],
  }));
});

test("applies min, max, and latest consistently to comparison fallback totals", () => {
  for (const [aggregation, expected] of [["min", 3], ["max", 5], ["latest", 3]] as const) {
    const measure = { id: "capacity", label: "Capacity", aggregation, valueType: "number", favorability: "neutral", filters: [] } as const;
    const result = runDeterministicBoardEngine({
      request: { schemaVersion: 1, measures: [measure], contributorLimit: 10 },
      rows: [
        { key: "A", actual: { capacity: 7 }, budget: { capacity: 6 }, comparisonActual: { capacity: 5 }, comparisonBudget: { capacity: 4 } },
        { key: "B", actual: { capacity: 8 }, budget: { capacity: 7 }, comparisonActual: { capacity: 3 }, comparisonBudget: { capacity: 2 } },
      ],
    });
    assert.equal(result.measures[0]?.comparisonActual, expected);
  }
});