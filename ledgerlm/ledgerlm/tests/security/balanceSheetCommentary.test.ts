import assert from "node:assert/strict";
import test from "node:test";
import { balanceSheetReportSchema, type BalanceSheetReport } from "../../shared/boards/balanceSheet";
import { applyBalanceSheetCommentary, buildBalanceSheetCommentaryFacts, type CommentaryAccount } from "../../server/services/boards/balanceSheetCommentaryService";
import { enrichBalanceSheetCommentary } from "../../server/services/boards/balanceSheetAiCommentaryService";
import { balanceSheetAxisRange } from "../../server/services/boards/balanceSheetPptxLayout";

function fixture(): BalanceSheetReport {
  const totals = { assets: 10_000_000_000, liabilities: 5_000_000_000, equity: 5_000_000_000,
    liabilitiesAndEquity: 10_000_000_000, balanceDifference: 0, currentAssets: 0, currentLiabilities: 0,
    workingCapital: 0, cash: 0, receivables: 0, inventory: 0, debt: 5_000_000_000, payables: 0 };
  return { balanced: true, difference: 0, tolerance: 1, currency: "INR", unitLabel: "INR",
    periodLabel: "Jun 2026", comparisonPeriodLabel: "Mar 2026", totals, comparisonTotals: totals,
    ratios: { currentRatio: null, quickRatio: null, debtToEquity: 1, equityRatio: 0.5 },
    periods: [], lineItems: [], movements: [], unmappedRows: [], warnings: [], insights: [], risks: [], actions: [],
    categoryBreakdowns: [{ label: "Provisions", section: "liabilities", value: 4_600_000_000,
      previousValue: 4_200_000_000, change: 400_000_000, changePercent: 400 / 4200 }] };
}
function accounts(): [CommentaryAccount[], CommentaryAccount[]] {
  const base = { category: "Provisions", section: "liabilities" as const };
  return [
    [{ ...base, identity: "a", name: "Employee provision", value: 4_000_000_000 },
      { ...base, identity: "b", name: "Warranty provision", value: 600_000_000 }],
    [{ ...base, identity: "a", name: "Employee provision", value: 3_000_000_000 },
      { ...base, identity: "closed", name: "Closed provision", value: 1_200_000_000 }],
  ];
}
function withFacts() {
  const report = fixture();
  report.commentaryFacts = buildBalanceSheetCommentaryFacts(report, ...accounts());
  return report;
}
const selected = () => JSON.stringify({ selections: [{ category: "Provisions", section: "liabilities", evidenceIds: ["bs-0-drivers"] }] });

test("evidence reconciles full source accounts, including disappeared accounts and offsets", () => {
  const report = withFacts(), before = JSON.stringify(report);
  const text = applyBalanceSheetCommentary(report).categoryCommentary![0].text;
  assert.ok(text.includes("Closed provision −1,200"));
  assert.ok(text.includes("Employee provision +1,000"));
  assert.ok(text.includes("offset"));
  assert.ok(text.includes("4,200 → 4,600"));
  assert.equal(JSON.stringify(report), before);
});
test("unreconciled detail and missing comparison never become invented attribution", () => {
  const report = fixture(), [current, previous] = accounts();
  current[0].value = 1;
  const facts = buildBalanceSheetCommentaryFacts(report, current, previous);
  assert.ok(!facts.some((fact) => fact.kind === "drivers"));
  assert.ok(facts.some((fact) => fact.kind === "composition" && fact.text.includes("supporting detail")));
  assert.ok(facts.some((fact) => fact.kind === "coverage"));
  report.comparisonTotals = null;
  report.comparisonPeriodLabel = null;
  const unavailable = buildBalanceSheetCommentaryFacts(report, ...accounts());
  assert.ok(!unavailable.some((fact) => fact.kind === "drivers"));
  assert.ok(unavailable[0].text.includes("comparison unavailable"));
});
test("AI selections preserve verified wording and reject invented, cross-category or causal prose", () => {
  const report = withFacts();
  const result = applyBalanceSheetCommentary(report, selected());
  assert.equal(result.commentaryStatus, "ai-selected");
  assert.ok(result.categoryCommentary![0].text.includes("Closed provision"));
  assert.deepEqual(result.totals, report.totals);
  assert.throws(() => applyBalanceSheetCommentary(report, '{"selections":[]}'));
  assert.throws(() => applyBalanceSheetCommentary(report, selected().replace("bs-0-drivers", "invented")));
  assert.throws(() => applyBalanceSheetCommentary(report, selected().replace("Provisions", "Cash")));
  assert.throws(() => applyBalanceSheetCommentary(report, '{"selections":[],"commentary":"Cash rose because collections improved"}'));
  assert.deepEqual(balanceSheetReportSchema.parse(result).categoryCommentary, result.categoryCommentary);
});
test("configured customer AI is used once and invalid/provider failures return explicit factual fallback", async () => {
  const report = withFacts();
  const config = { provider: "azure_openai" as const, endpoint: "https://example.invalid", chatModel: "test" };
  let calls = 0;
  const ai = await enrichBalanceSheetCommentary(report, config, async (actual, prompt, signal) => {
    calls++; assert.equal(actual, config); assert.ok(prompt.includes("Closed provision")); assert.ok(signal);
    return selected();
  });
  assert.equal(calls, 1);
  assert.equal(ai.commentaryStatus, "ai-selected");
  for (const response of ["bad json", '{"selections":[]}']) {
    const fallback = await enrichBalanceSheetCommentary(report, config, async () => response);
    assert.equal(fallback.commentaryStatus, "factual-fallback");
  }
  const failed = await enrichBalanceSheetCommentary(report, config, async () => { throw new Error("offline"); });
  assert.equal(failed.commentaryStatus, "factual-fallback");
  const absent = await enrichBalanceSheetCommentary(report);
  assert.equal(absent.commentaryStatus, "factual-fallback");
});
test("old reports remain valid and chart bounds are adaptive, zero based, and cover negatives", () => {
  assert.ok(balanceSheetReportSchema.safeParse(fixture()).success);
  assert.deepEqual(balanceSheetAxisRange([12310.75, 4671.53, 5227.16]), { min: 0, max: 14000, step: 2000 });
  assert.deepEqual(balanceSheetAxisRange([57995.18, 52905.39]), { min: 0, max: 70000, step: 10000 });
  const negative = balanceSheetAxisRange([-1500, 2000]);
  assert.ok(negative.min < -1500 && negative.max > 2000);
  assert.deepEqual(balanceSheetAxisRange([0, 0]), { min: 0, max: 1, step: 0.2 });
});
