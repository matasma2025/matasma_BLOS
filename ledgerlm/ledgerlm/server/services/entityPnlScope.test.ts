import assert from "node:assert/strict";
import { ENTITY_PNL_CALCULATION_VERSION } from "../../shared/entityPnlPlanning";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { buildEntityPnlPlanningBreakdown, type PlanningRow } from "./entityPnlPlanningService";
import { buildEntityPnlReport, entityPnlResultPayload, ENTITY_PNL_FINANCIAL_POPULATION, validateEntityPnlReportRequest } from "./entityPnlReportService";
import { parseBoardAnalysisResult } from "./boards/boardResultSchema";
import { supplementalRows } from "./boards/entityPnlSupplementExport";
import { exportEntityPnlPdf, exportEntityPnlPptx } from "./boards/entityPnlExportService";
import { unzipSync, strFromU8 } from "fflate";

const request = validateEntityPnlReportRequest({
  cubeId: "authorized-cube", entity: "", asOf: "2026-07", comparison: "yoy", currency: "INR", cfVersion: "CF05 2026",
});
const scope = { scenario: request.cfVersion!, asOf: request.asOf };
const plan = (entity: string, page: string, value: number): PlanningRow => ({
  entity, page, particulars: "Budget (mUSD)", sub_category: "Offshore", cost_value: value,
});
const financial = (category: string, value: number, scenario = "actual", year = 2026, entityCategory = "Employee Benefits") => ({
  year, month: 7, scenario, cost_category: category, entity_category: category === "Revenue Summary" ? "Revenue" : entityCategory,
  resource_type: "", source_sub_category: "", amount: value, capacity: null, source_rows: 1,
});

test("Entity P&L population retains the existing entity-specific cost and revenue exclusions", () => {
  const query = new PgDialect().sqlToQuery(ENTITY_PNL_FINANCIAL_POPULATION).sql;
  for (const term of ["entity_category", "entity_sub_category", "order_reason", "YEH", "YEI", "YEJ", "YEK", "YN2", "gl_account", "139%"]) {
    assert.ok(query.includes(term), `${term} must remain in Entity P&L's predicate`);
  }
});

test("All entities uses disjoint source displays, never adds World Wide or alternate pages", () => {
  const report = buildEntityPnlPlanningBreakdown([
    plan("BGSW", "Entity", 100), plan("BGSW", "MS View", 999),
    plan("BGSV", "Entity", 20), plan("World Wide", "Entity", 800),
    plan("World Wide", "World Wide", 120), plan("", "Entity", 900),
  ], scope);
  assert.equal(report.sourceRowCount, 3);
  assert.deepEqual(report.metrics, []);
  assert.deepEqual(report.entityBreakdowns?.map((item) => item.metrics[0].value), [100e6, 20e6, 120e6]);
  const rows = supplementalRows(buildEntityPnlReport([], request, report));
  assert.ok(rows.some((row) => row[0] === "World Wide — Budget — Offshore"));
  assert.ok(!rows.some((row) => row[0] === "Budget — Offshore"));
});

test("Conflicts are scoped per entity and identical duplicates are counted once", () => {
  const report = buildEntityPnlPlanningBreakdown([
    plan("BGSW", "Entity", 100), plan("bgsw", "Entity", 100),
    plan("BGSV", "Entity", 20), plan("BGSV", "Entity", 21),
  ], scope);
  assert.equal(report.entityBreakdowns![0].metrics[0].value, 100e6);
  assert.equal(report.entityBreakdowns![1].metrics[0].status, "conflicting");
});

test("Signed credits reduce expense totals; blank-category cost is excluded", () => {
  const report = buildEntityPnlReport([
    financial("Revenue Summary", 200),
    financial("Cost Summary", 100), financial("Cost Summary", -20, "actual", 2026, "Other Expenses"),
    financial("Cost Summary", 9999, "actual", 2026, ""),
  ], request);
  assert.equal(report.metrics["Total Expenses"], 80);
  assert.equal(report.metrics["Other Expenses"], -20);
  assert.equal(report.metrics.EBIT, 120);
  assert.equal(report.metrics["EBIT%"], 60);
  assert.equal(report.calculationVersion, ENTITY_PNL_CALCULATION_VERSION);
});

test("Unmapped Cost Summary categories roll into Other Expenses and reconcile to Total Expenses", () => {
  const otherSourceCosts: Array<[string, number]> = [
    ["Other Expenses", 10],
    ["Travel", 20],
    ["Revenue Hardware", 30],
    ["Welfare cost", 40],
    ["Material cost", 50],
    ["Other cost", 60],
    ["Depreciation", 70],
    ["Unmapped expense", 80],
    ["Travel", -15],
  ];
  const report = buildEntityPnlReport([
    financial("Revenue Summary", 1_000),
    financial("Cost Summary", 100, "actual", 2026, "Employee Benefits"),
    financial("Cost Summary", 50, "actual", 2026, "Outsourcing Cost"),
    financial("Cost Summary", 25, "actual", 2026, "Consultancy Charges"),
    financial("Cost Summary", 30, "actual", 2026, "CI Charges & Other Revenue"),
    financial("Cost Summary", 20, "actual", 2026, "Facilities Cost"),
    ...otherSourceCosts.map(([category, amount]) => financial("Cost Summary", amount, "actual", 2026, category)),
    financial("Cost Summary", 9999, "actual", 2026, ""),
  ], request);
  const displayedExpenseTotal = [
    "Employee Benefits", "Outsourcing Cost", "Consultancy Charges",
    "CI Charges & Other Revenue", "Facilities Cost", "Other Expenses",
  ].reduce((sum, label) => sum + (report.metrics[label] ?? 0), 0);

  assert.equal(report.metrics["Other Expenses"], 345);
  assert.equal(report.metrics["Total Expenses"], 570);
  assert.equal(displayedExpenseTotal, report.metrics["Total Expenses"]);
  assert.equal(report.expenseReconciliation?.find((item) => item.period === report.currentLabel)?.amount, 0);
});

test("YoY margin variance shows pp and relative percent; Actual-CF remains independent", () => {
  const report = buildEntityPnlReport([
    financial("Revenue Summary", 200), financial("Cost Summary", 100),
    financial("Revenue Summary", 100, "actual", 2025), financial("Cost Summary", 80, "actual", 2025),
    financial("Revenue Summary", 250, scope.scenario), financial("Cost Summary", 150, scope.scenario),
  ], request);
  const revenue = report.lines.find((row) => row.label === "Revenue")!;
  assert.equal(revenue.variance, 100);
  assert.equal(revenue.variancePercent, 100);
  const cfRevenue = report.forecastComparison!.rows.find((row) => row.label === "Revenue")!;
  assert.equal(cfRevenue.variance, -50);
  assert.equal(cfRevenue.variancePercent, -20);
  const margin = report.lines.find((row) => row.label === "EBIT%")!;
  assert.equal(margin.variance, 30);
  assert.equal(margin.variancePercent, 150);
  const cfMargin = report.forecastComparison!.rows.find((row) => row.label === "EBIT%")!;
  assert.equal(cfMargin.variance, 10);
  assert.equal(cfMargin.variancePercent, null);
});

test("QoQ EBIT% variance retains pp and adds relative percentage change", () => {
  const qoqRequest = validateEntityPnlReportRequest({
    cubeId: "authorized-cube", entity: "", asOf: "2026-06", comparison: "qoq", currency: "INR",
  });
  const report = buildEntityPnlReport([
    { ...financial("Revenue Summary", 100), month: 3 },
    { ...financial("Cost Summary", 60), month: 3 },
    { ...financial("Revenue Summary", 300), month: 6 },
    { ...financial("Cost Summary", 210), month: 6 },
  ], qoqRequest);
  const margin = report.lines.find((row) => row.label === "EBIT%")!;

  assert.equal(margin.values["Q2 2026"], 25);
  assert.equal(margin.values["Q1 2026"], 40);
  assert.equal(margin.variance, -15);
  assert.equal(margin.variancePercent, -37.5);
});

test("EBIT% relative variance stays unavailable when comparison margin is zero or missing", () => {
  const zeroBaseline = buildEntityPnlReport([
    financial("Revenue Summary", 200), financial("Cost Summary", 100),
    financial("Revenue Summary", 100, "actual", 2025), financial("Cost Summary", 100, "actual", 2025),
  ], request);
  const zeroBaselineMargin = zeroBaseline.lines.find((row) => row.label === "EBIT%")!;
  assert.equal(zeroBaselineMargin.variance, 50);
  assert.equal(zeroBaselineMargin.variancePercent, null);

  const missingBaseline = buildEntityPnlReport([
    financial("Revenue Summary", 200), financial("Cost Summary", 100),
  ], request);
  const missingBaselineMargin = missingBaseline.lines.find((row) => row.label === "EBIT%")!;
  assert.equal(missingBaselineMargin.variance, null);
  assert.equal(missingBaselineMargin.variancePercent, null);
});

test("True zero CF is comparable while missing CF financial records remain unavailable", () => {
  const report = buildEntityPnlReport([
    financial("Revenue Summary", 200), financial("Revenue Summary", 0, scope.scenario),
  ], request);
  const revenue = report.forecastComparison!.rows.find((row) => row.label === "Revenue")!;
  assert.equal(revenue.variance, 200);
  assert.equal(revenue.variancePercent, null);
  assert.equal(revenue.reason, undefined);
  const expenses = report.forecastComparison!.rows.find((row) => row.label === "Total Expenses")!;
  assert.equal(expenses.forecast, null);
  assert.ok(expenses.reason);
});

test("Forecast breakdown and comparisons paginate in both export formats", async () => {
  const planning = buildEntityPnlPlanningBreakdown([
    plan("BGSW", "Entity", 100), plan("BGSV", "Entity", 20), plan("World Wide", "World Wide", 120),
  ], scope);
  const report = buildEntityPnlReport([financial("Revenue Summary", 200), financial("Cost Summary", 100)], request, planning);
  const exported = { title: "Entity scope regression", result: { entityPnl: report } };
  const [pptx, pdf] = await Promise.all([exportEntityPnlPptx(exported, undefined, { includeSupplement: true }), exportEntityPnlPdf(exported)]);
  const files = unzipSync(new Uint8Array(pptx));
  const slides = Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slides.length, 1 + Math.ceil(supplementalRows(report).length / 12));
  const text = slides.map((name) => strFromU8(files[name])).join("\n");
  assert.ok(text.includes("Actual vs CF05 2026"));
  assert.ok(text.includes("World Wide"));
  assert.ok(pdf.toString("latin1").includes("/Type /Page"));
  const base = await exportEntityPnlPptx({
    title: "Legacy single-slide template",
    result: { entityPnl: { ...report, planningForecast: undefined, forecastComparison: undefined, expenseReconciliation: undefined } },
  });
  const templated = await exportEntityPnlPptx(exported, base.toString("base64"), { includeSupplement: true });
  const templatedFiles = unzipSync(new Uint8Array(templated));
  const templatedSlides = Object.keys(templatedFiles).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(templatedSlides.length, slides.length);
  for (const name of templatedSlides) {
    const ids = Array.from(strFromU8(templatedFiles[name]).matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g), (match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `unique object IDs required in ${name}`);
  }
});

test("The persisted Board result retains the entire Entity P&L comparison and planning contract", () => {
  const planning = buildEntityPnlPlanningBreakdown([plan("BGSW", "Entity", 100), plan("World Wide", "World Wide", 120)], scope);
  const report = buildEntityPnlReport([financial("Revenue Summary", 200), financial("Cost Summary", 100)], request, planning);
  const result = parseBoardAnalysisResult({ summary: report.summary, entityPnl: entityPnlResultPayload(report) });
  assert.equal(result.entityPnl?.calculationVersion, report.calculationVersion);
  assert.deepEqual(result.entityPnl?.forecastComparison, report.forecastComparison);
  assert.deepEqual(result.entityPnl?.planningForecast, report.planningForecast);
  const reloaded = JSON.parse(JSON.stringify(result));
  assert.deepEqual(reloaded.entityPnl.forecastComparison.rows, report.forecastComparison!.rows);
});
