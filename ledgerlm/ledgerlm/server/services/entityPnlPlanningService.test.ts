import assert from "node:assert/strict";
import test from "node:test";
import { buildEntityPnlPlanningForecast, type PlanningRow } from "./entityPnlPlanningService";
import { buildEntityPnlReport, validateEntityPnlReportRequest } from "./entityPnlReportService";
import { supplementalRows } from "./boards/entityPnlSupplementExport";

const scope = { scenario: "CF05 2026", asOf: "2026-07", entity: "BGSW" };
const request = validateEntityPnlReportRequest({ cubeId: "authorized-cube", ...scope, cfVersion: scope.scenario, currency: "INR", comparison: "yoy" });
const row = (particulars: string, sub_category: string, cost_value: PlanningRow["cost_value"]): PlanningRow =>
  ({ particulars, sub_category, cost_value });

test("planning mUSD is normalized to raw USD once and identical duplicates are not summed", () => {
  const forecast = buildEntityPnlPlanningForecast([
    row("Budget (mUSD)", "Offshore", "1,162.8431618251464"),
    row(" Budget (mUSD) ", " offshore ", "1162.8431618251464"),
    row("Offshore Capacity", "Average", 23479.495589292626),
    row("Budget (mUSD)", "Total", 999999),
  ], scope);
  assert.equal(forecast.metrics[0].value, 1162.8431618251464 * 1_000_000);
  assert.equal(forecast.metrics[0].status, "available");
  assert.equal(forecast.metrics[4].value, 23479.495589292626);
  assert.equal(forecast.metrics[1].status, "missing");
  assert.ok(forecast.warnings.some((warning) => warning.includes("counted once")));
});

test("conflicting values, blank duplicates, and zero values remain distinct", () => {
  const forecast = buildEntityPnlPlanningForecast([
    row("Budget (mUSD)", "Offshore", 674.373584),
    row("Budget (mUSD)", "Offshore", 674.585584),
    row("Budget (mUSD)", "Onsite", ""),
    row("Budget (mUSD)", "Onsite", 9.6),
    row("Budget (mUSD)", "Outsourcing", 0),
    row("Outsourcing Capacity", "Average", null),
  ], scope);
  assert.equal(forecast.metrics[0].value, null);
  assert.equal(forecast.metrics[0].status, "conflicting");
  assert.equal(forecast.metrics[1].status, "conflicting");
  assert.equal(forecast.metrics[2].value, 0);
  assert.equal(forecast.metrics[2].status, "available");
  assert.equal(forecast.metrics[8].status, "missing");
});

test("operational forecasts never become INR financial revenue, fabricated expenses, or YTD capacity", () => {
  const forecast = buildEntityPnlPlanningForecast([
    row("Budget (mUSD)", "Offshore", 1162),
    row("Outsourcing Capacity", "Average", 3216),
  ], scope);
  const report = buildEntityPnlReport([], request, forecast);
  assert.ok(report.forecastLabel?.includes("snapshot"));
  assert.ok(!report.forecastLabel?.includes("YTD"));
  for (const label of ["Revenue", "Total Expenses", "EBIT", "Total Average"]) {
    assert.equal(report.lines.find((line) => line.label === label)!.values[report.forecastLabel!], null);
  }
  assert.equal(report.planningForecast?.metrics[0].value, 1162_000_000);
  const rows = supplementalRows(report);
  assert.deepEqual(rows[0], ["Budget — Offshore", "1,162", "mUSD", "Available"]);
  assert.ok(report.warnings.some((warning) => warning.includes("operational forecast")));
});

test("missing or partially populated monetary amounts invalidate totals and EBIT, but a true zero remains zero", () => {
  const base = { year: 2026, month: 7, scenario: "actual", entity_category: "", resource_type: "",
    source_sub_category: "", capacity: null, source_rows: 1 };
  const report = buildEntityPnlReport([
    { ...base, cost_category: "Revenue Summary", amount: null },
    { ...base, cost_category: "Cost Summary", entity_category: "Employee Benefits", amount: 100 },
    { ...base, cost_category: "Cost Summary", entity_category: "Other Expenses", amount: 50, amount_complete: false },
  ], request);
  for (const label of ["Revenue", "Total Expenses", "EBIT"]) {
    assert.equal(report.lines.find((line) => line.label === label)!.values[report.currentLabel], null);
  }
  const zero = buildEntityPnlReport([{ ...base, cost_category: "Revenue Summary", amount: 0, amount_complete: true }], request);
  assert.equal(zero.lines.find((line) => line.label === "Revenue")!.values[zero.currentLabel], 0);
});

test("existing governed financial forecasts retain cumulative semantics even with planning data attached", () => {
  const forecast = buildEntityPnlPlanningForecast([row("Budget (mUSD)", "Offshore", 1162)], scope);
  const report = buildEntityPnlReport([
    { year: 2026, month: 7, scenario: scope.scenario, cost_category: "Revenue Summary",
      entity_category: "Revenue", resource_type: "", source_sub_category: "", amount: 400,
      capacity: null, source_rows: 1 },
  ], request, forecast);
  assert.equal(report.forecastLabel, "CF05 2026 YTD");
  assert.equal(report.lines.find((line) => line.label === "Revenue")!.values[report.forecastLabel!], 400);
});

test("expense reconciliation reports the residual without adding it again to expenses", () => {
  const base = { year: 2026, month: 7, scenario: "actual", cost_category: "Cost Summary",
    resource_type: "", source_sub_category: "", capacity: null, source_rows: 1 };
  const report = buildEntityPnlReport([
    { ...base, entity_category: "Employee Benefits", amount: 100 },
    { ...base, entity_category: "Other Expenses", amount: 10 },
    { ...base, entity_category: "Travel expenses", amount: 25 },
  ], request);
  assert.equal(report.lines.find((line) => line.label === "Total Expenses")!.values[report.currentLabel], 135);
  assert.equal(report.lines.find((line) => line.label === "Other Expenses")!.values[report.currentLabel], 10);
  assert.equal(report.expenseReconciliation?.find((item) => item.period === report.currentLabel)?.amount, 25);
});
