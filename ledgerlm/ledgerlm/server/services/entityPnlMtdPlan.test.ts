import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { financialPlanAggregateRows, parseEntityPnlFinancialPlanWorkbook } from "./entityPnlFinancialPlanService";
import { buildEntityPnlReport, entityPnlResultPayload, validateEntityPnlReportRequest } from "./entityPnlReportService";
import { parseBoardAnalysisResult } from "./boards/boardResultSchema";
import { supplementNotes } from "./boards/entityPnlSupplementExport";
import { exportEntityPnlPptx } from "./boards/entityPnlExportService";
import { unzipSync, strFromU8 } from "fflate";
import type { EntityPnlFinancialPlan, EntityPnlFinancialPlanSource } from "../../shared/entityPnlPlanning";

function fixture(): EntityPnlFinancialPlan {
  return {
    version: 1, entity: "BGSW", sourceName: "monthly.xlsx", sourceUnit: "mINR", periodBasis: "mtd",
    usdExchangeRates: { "CF05 2026": 86.96 },
    rows: Array.from({ length: 12 }, (_, index) => index + 1).flatMap((month) =>
      [
        ["Revenue", "Services", month * 10],
        ["Employee Benefit", "Salary", month * 3],
        ["Other Expenses", "Credit", -month],
        ["Revenue Software", "CI charges", month],
        ["End Capacity", "Internal", 100 + month],
        ["End Capacity", "Outsourcing", 20 + month],
      ].map(([category, subcategory, value]) => ({
        year: 2026, month, scenario: "CF05 2026", category: String(category), subcategory: String(subcategory), value: Number(value),
      }))),
  };
}
const actuals = [
  { year: 2026, month: 7, scenario: "actual", cost_category: "Revenue Summary", entity_category: "Revenue", resource_type: "", source_sub_category: "", amount: 80e6, capacity: null, source_rows: 1 },
  { year: 2026, month: 7, scenario: "actual", cost_category: "Cost Summary", entity_category: "Employee Benefits", resource_type: "", source_sub_category: "", amount: 30e6, capacity: null, source_rows: 1 },
];
function reportFor(plan: EntityPnlFinancialPlan, comparison: "yoy" | "qoq" = "yoy", asOf = "2026-07", currency: "INR" | "USD" = "INR") {
  const request = validateEntityPnlReportRequest({ cubeId: "fixture", entity: "BGSW", cfVersion: "CF05 2026", comparison, asOf, currency });
  const source: EntityPnlFinancialPlanSource = {
    entity: plan.entity, sourceName: plan.sourceName, sourceUnit: plan.sourceUnit, periodBasis: plan.periodBasis,
    scenario: request.cfVersion!, storageScope: "cube", revision: 2, usdExchangeRate: plan.usdExchangeRates[request.cfVersion!],
  };
  return buildEntityPnlReport([...actuals, ...financialPlanAggregateRows(plan, request)], request, undefined, source);
}
function forecast(report: ReturnType<typeof reportFor>, label: string) {
  return report.lines.find((row) => row.label === label)!.values[report.forecastLabel!];
}

test("July MTD financial CF sums January–July only; Actuals and capacity are unchanged", () => {
  const report = reportFor(fixture());
  assert.equal(forecast(report, "Revenue"), 280e6);
  assert.equal(forecast(report, "Total Expenses"), 84e6);
  assert.equal(forecast(report, "Other Expenses"), -28e6);
  assert.equal(forecast(report, "CI Charges & Other Revenue"), 28e6);
  assert.equal(forecast(report, "EBIT"), 196e6);
  assert.equal(forecast(report, "EBIT%"), 70);
  assert.equal(forecast(report, "End Capacity On-roll"), 107);
  assert.equal(forecast(report, "Avg Capacity On-roll"), 104);
  assert.equal(forecast(report, "Avg Capacity Outsourcing"), 24);
  const ytd = reportFor({ ...fixture(), periodBasis: "ytd" });
  for (let index = 0; index < report.lines.length; index++) {
    for (const column of [report.currentLabel, report.comparisonLabel, report.yearEndLabel]) {
      assert.equal(report.lines[index].values[column], ytd.lines[index].values[column]);
    }
  }
  assert.equal(forecast(ytd, "Revenue"), 70e6);
  assert.equal(report.forecastComparison!.rows.find((row) => row.label === "Revenue")!.variance, -200e6);
  assert.equal(parseBoardAnalysisResult({ summary: report.summary, entityPnl: entityPnlResultPayload(report) }).entityPnl!.financialPlanSource!.periodBasis, "mtd");
});

test("MTD QoQ sums only quarter months, even when a prior-quarter month is absent", () => {
  const plan = fixture();
  plan.rows = plan.rows.filter((row) => !(row.category === "Revenue" && row.month === 1));
  const report = reportFor(plan, "qoq", "2026-06");
  assert.equal(forecast(report, "Revenue"), 150e6);
  assert.equal(forecast(report, "Total Expenses"), 45e6);
  assert.equal(forecast(report, "Avg Capacity On-roll"), 105);
  assert.equal(forecast(report, "End Capacity On-roll"), 106);
  assert.equal(forecast(reportFor(plan, "qoq", "2026-03"), "Revenue"), null);
});

test("Absent and blank required financial months cannot silently understate YTD; real zero remains valid", () => {
  const plan = fixture();
  plan.rows.find((row) => row.category === "Revenue" && row.month === 2)!.value = null;
  assert.equal(forecast(reportFor(plan), "Revenue"), null);
  plan.rows.find((row) => row.category === "Revenue" && row.month === 2)!.value = 0;
  assert.equal(forecast(reportFor(plan), "Revenue"), 260e6);
  plan.rows = plan.rows.filter((row) => !(row.category === "Employee Benefit" && row.month === 2));
  assert.equal(forecast(reportFor(plan), "Total Expenses"), null);
  assert.equal(forecast(reportFor(plan), "EBIT"), null);
  assert.equal(forecast(reportFor(plan), "Revenue"), 260e6);
});

test("MTD currency normalization uses the approved rate once; missing FX does not borrow a rate", () => {
  const plan = fixture();
  const report = reportFor(plan, "yoy", "2026-07", "USD");
  assert.ok(Math.abs(forecast(report, "Revenue")! - 280e6 / 86.96) < 1e-8);
  assert.equal(forecast(report, "Total End"), 134);
  plan.usdExchangeRates = {};
  assert.equal(forecast(reportFor(plan, "yoy", "2026-07", "USD"), "Revenue"), null);
  assert.equal(forecast(reportFor(plan, "yoy", "2026-07", "USD"), "Total End"), 134);
  assert.deepEqual(financialPlanAggregateRows(plan, { entity: "BGSV", cfVersion: "CF05 2026", currency: "INR" }), []);
  assert.deepEqual(financialPlanAggregateRows(plan, { entity: "", cfVersion: "CF05 2026", currency: "INR" }), []);
});

test("Monthly accumulation does not cross scenario or fiscal-year boundaries", () => {
  const plan = fixture();
  plan.rows.push(...plan.rows.map((row) => ({ ...row, year: 2025, scenario: "CF05 2025", value: 99999 })));
  plan.rows.push(...plan.rows.filter((row) => row.year === 2026).map((row) => ({ ...row, scenario: "CF02 2026", value: 88888 })));
  assert.equal(forecast(reportFor(plan), "Revenue"), 280e6);
});

test("Workbook parsing keeps explicit MTD and legacy YTD bases distinct", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Plan Entity P&L");
  sheet.addRow(["Entity", "FiscalYear", "Month", "Category", "Sub_Category", "CF05"]);
  sheet.addRow(["BGSW", 2026, 7, "Revenue", "Services", 10]);
  const bytes = Buffer.from(await wb.xlsx.writeBuffer());
  const options = { entity: "BGSW", sourceName: "monthly.xlsx", usdExchangeRates: {} };
  assert.equal((await parseEntityPnlFinancialPlanWorkbook(bytes, { ...options, periodBasis: "mtd" })).periodBasis, "mtd");
  assert.equal((await parseEntityPnlFinancialPlanWorkbook(bytes, options)).periodBasis, "ytd");
});

test("PowerPoint CF totals and source notes describe monthly MTD rather than cumulative YTD", async () => {
  const report = reportFor(fixture());
  assert.match(supplementNotes(report).join(" "), /monthly MTD/);
  const pptx = await exportEntityPnlPptx({ title: "MTD financial plan", result: { entityPnl: report } });
  const files = unzipSync(pptx);
  const text = Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map((name) => strFromU8(files[name])).join("\n");
  assert.match(text, /280,000,000/);
  assert.equal(Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 1);
  const detailed = unzipSync(await exportEntityPnlPptx({ title: "MTD financial plan", result: { entityPnl: report } }, undefined, { includeSupplement: true }));
  const detailedText = Object.keys(detailed).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map((name) => strFromU8(detailed[name])).join("\n");
  assert.match(detailedText, /monthly MTD/);
  assert.doesNotMatch(detailedText, /confirmed YTD|cumulative YTD basis is user-confirmed/);
});
