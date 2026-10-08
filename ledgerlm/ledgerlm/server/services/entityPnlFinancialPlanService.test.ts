import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { financialPlanAggregateRows, parseEntityPnlFinancialPlanWorkbook, validateEntityPnlFinancialPlan } from "./entityPnlFinancialPlanService";
import { buildEntityPnlReport, entityPnlResultPayload, validateEntityPnlReportRequest } from "./entityPnlReportService";
import { parseBoardAnalysisResult } from "./boards/boardResultSchema";
import { exportEntityPnlPdf, exportEntityPnlPptx } from "./boards/entityPnlExportService";
import { supplementNotes } from "./boards/entityPnlSupplementExport";
import { unzipSync, strFromU8 } from "fflate";

async function fixture(entity = "BGSW") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plan Entity P&L");
  sheet.addRow(["Entity ", "FiscalYear", "Month", "Category", "Sub_Category", "BP", "CF02", "CF05", "CF09", "CF11"]);
  for (let month = 1; month <= 12; month++) {
    for (const [category, subcategory, value] of [
      ["Revenue", "Revenue from services", month * 10],
      ["Employee Benefit", "Salary and wages", month * 3],
      ["Other Expenses", "Credit", -month],
      ["Revenue Software", "CI charges", month],
      ["End Capacity", "Internal", 100 + month],
      ["End Capacity", "Outsourcing", 20 + month],
    ] as Array<[string, string, number]>) {
      sheet.addRow([entity, "2026", String(month).padStart(2, "0"), category, subcategory, null, value, value, null, null]);
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
const options = { entity: "BGSW", sourceName: "Financial plan.xlsx", usdExchangeRates: { "CF05 2026": 86.96 } };
const request = (currency: "INR" | "USD" = "INR", comparison: "yoy" | "qoq" = "yoy", asOf = "2026-07", cfVersion = "CF05 2026") =>
  validateEntityPnlReportRequest({ cubeId: "authorized", entity: "BGSW", currency, comparison, asOf, cfVersion });
const source = { sourceName: options.sourceName, entity: "BGSW", sourceUnit: "mINR" as const, periodBasis: "ytd" as const, scenario: "CF05 2026", usdExchangeRate: 86.96 };
const actuals = [
  { year: 2026, month: 7, scenario: "actual", cost_category: "Revenue Summary", entity_category: "Revenue", resource_type: "", source_sub_category: "", amount: 80e6, capacity: null, source_rows: 1 },
  { year: 2026, month: 7, scenario: "actual", cost_category: "Cost Summary", entity_category: "Employee Benefits", resource_type: "", source_sub_category: "", amount: 30e6, capacity: null, source_rows: 1 },
];

test("Workbook import respects entity, units, scenario years and empty scenarios", async () => {
  const plan = await parseEntityPnlFinancialPlanWorkbook(await fixture(), options);
  assert.equal(plan.entity, "BGSW");
  assert.equal(plan.rows.length, 144);
  assert.deepEqual(Array.from(new Set(plan.rows.map((row) => row.scenario))), ["CF02 2026", "CF05 2026"]);
  assert.equal(plan.rows.find((row) => row.category === "Revenue" && row.month === 7)!.value, 70);
  await assert.rejects(parseEntityPnlFinancialPlanWorkbook(await fixture("BGSV"), options), /not BGSW/);
});

test("INR financial CF uses the selected YTD snapshot, not a sum of monthly values; credits retain signs", async () => {
  const plan = await parseEntityPnlFinancialPlanWorkbook(await fixture(), options);
  const report = buildEntityPnlReport([...actuals, ...financialPlanAggregateRows(plan, request())], request(), undefined, source);
  const values = Object.fromEntries(report.lines.map((line) => [line.label, line.values[report.forecastLabel!]]));
  assert.equal(values.Revenue, 70e6);
  assert.equal(values["Total Expenses"], 21e6);
  assert.equal(values["Other Expenses"], -7e6);
  assert.equal(values["CI Charges & Other Revenue"], 7e6);
  assert.equal(values.EBIT, 49e6);
  assert.equal(values["EBIT%"], 70);
  assert.equal(values["End Capacity On-roll"], 107);
  assert.equal(values["Avg Capacity On-roll"], 104);
  assert.equal(values["Avg Capacity Outsourcing"], 24);
  assert.equal(report.forecastComparison!.rows.find((row) => row.label === "Revenue")!.variance, 10e6);
  const stored = parseBoardAnalysisResult({ summary: report.summary, entityPnl: entityPnlResultPayload(report) });
  assert.deepEqual(stored.entityPnl!.financialPlanSource, source);
});

test("CF05 USD conversion divides normalized INR by exactly 86.96 and never scales capacity", async () => {
  const plan = await parseEntityPnlFinancialPlanWorkbook(await fixture(), options);
  const report = buildEntityPnlReport(financialPlanAggregateRows(plan, request("USD")), request("USD"), undefined, source);
  assert.equal(report.lines[0].values[report.forecastLabel!], 70e6 / 86.96);
  assert.equal(report.lines.find((line) => line.label === "Total End")!.values[report.forecastLabel!], 134);
});

test("CF02 cannot borrow the CF05 rate, and a BGSW source cannot fill All entities or BGSV", async () => {
  const plan = await parseEntityPnlFinancialPlanWorkbook(await fixture(), options);
  const req = request("USD", "yoy", "2026-07", "CF02 2026");
  const report = buildEntityPnlReport(financialPlanAggregateRows(plan, req), req);
  assert.equal(report.lines[0].values[report.forecastLabel!], null);
  assert.equal(report.lines.find((line) => line.label === "Total End")!.values[report.forecastLabel!], 134);
  assert.deepEqual(financialPlanAggregateRows(plan, { ...req, entity: "" }), []);
  assert.deepEqual(financialPlanAggregateRows(plan, { ...req, entity: "BGSV" }), []);
});

test("QoQ differences cumulative CF snapshots and uses three-month capacity averages", async () => {
  const plan = await parseEntityPnlFinancialPlanWorkbook(await fixture(), options);
  const req = request("INR", "qoq", "2026-06");
  const report = buildEntityPnlReport(financialPlanAggregateRows(plan, req), req, undefined, source);
  assert.equal(report.lines[0].values[report.forecastLabel!], 30e6);
  assert.equal(report.lines.find((line) => line.label === "Avg Capacity On-roll")!.values[report.forecastLabel!], 105);
});

test("Partial blanks stay unavailable, true zero is preserved, duplicate facts fail closed", async () => {
  const plan = await parseEntityPnlFinancialPlanWorkbook(await fixture(), options);
  const july = plan.rows.find((row) => row.category === "Revenue" && row.month === 7 && row.scenario === "CF05 2026")!;
  july.value = null;
  const unavailable = buildEntityPnlReport(financialPlanAggregateRows(plan, request()), request(), undefined, source);
  assert.equal(unavailable.lines[0].values[unavailable.forecastLabel!], null);
  july.value = 0;
  const zero = buildEntityPnlReport(financialPlanAggregateRows(plan, request()), request(), undefined, source);
  assert.equal(zero.lines[0].values[zero.forecastLabel!], 0);
  assert.throws(() => validateEntityPnlFinancialPlan({ ...plan, rows: [...plan.rows, plan.rows[0]] }), /Duplicate/);
});

test("Financial plan exports contain the same CF values and correct source/FX assurance", async () => {
  const plan = await parseEntityPnlFinancialPlanWorkbook(await fixture(), options);
  const report = buildEntityPnlReport([...actuals, ...financialPlanAggregateRows(plan, request())], request(), undefined, source);
  const wrapper = { title: "BGSW plan", result: { entityPnl: report } };
  const pptx = await exportEntityPnlPptx(wrapper, undefined, { includeSupplement: true });
  const pdf = exportEntityPnlPdf(wrapper);
  const files = unzipSync(pptx);
  const text = Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map((name) => strFromU8(files[name])).join("\n");
  assert.ok(text.includes("70,000,000"));
  assert.ok(text.includes("Financial plan.xlsx"));
  assert.ok(text.includes("cumulative YTD"));
  assert.ok(!text.includes("Planning budget period basis is unconfirmed"));
  assert.ok(pdf.toString("latin1").includes("cumulative YTD"));
  assert.ok(supplementNotes({ ...report, currency: "USD" }).join(" ").includes("86.96"));
});
