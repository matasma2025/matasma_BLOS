import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntityPnlReport,
  validateEntityPnlReportRequest,
} from "./entityPnlReportService";
import { exportEntityPnlPdf, exportEntityPnlPptx } from "./boards/entityPnlExportService";

const request = validateEntityPnlReportRequest({
  cubeId: "authorized-cube",
  entity: "",
  asOf: "2025-07",
  comparison: "qoq",
  currency: "INR",
  cfVersion: "CF02 2025",
});

function aggregateRow(values: {
  year: number;
  month: number;
  scenario?: string;
  costCategory: string;
  entityCategory?: string;
  resourceType?: string;
  sourceSubCategory?: string;
  amount?: number;
  capacity?: number;
}): Parameters<typeof buildEntityPnlReport>[0][number] {
  return {
    year: values.year,
    month: values.month,
    scenario: values.scenario ?? "actual",
    cost_category: values.costCategory,
    entity_category: values.entityCategory ?? "",
    resource_type: values.resourceType ?? "",
    source_sub_category: values.sourceSubCategory ?? "",
    amount: values.amount ?? 0,
    capacity: values.capacity ?? 0,
    source_rows: 1,
  };
}

function sampleRows() {
  const rows: ReturnType<typeof aggregateRow>[] = [];
  const actualRevenue = [100, 250, 400, 550, 700, 900, 1100];
  const actualVisibleCost = [20, 50, 80, 110, 140, 180, 220];
  const actualOtherCost = [10, 20, 30, 40, 50, 70, 90];
  const cfRevenue = [120, 280, 450, 620, 800, 1000, 1250];
  const cfCost = [35, 70, 110, 150, 200, 250, 300];
  for (let month = 1; month <= 7; month += 1) {
    rows.push(aggregateRow({ year: 2025, month, costCategory: "Revenue Summary", entityCategory: "Revenue", amount: actualRevenue[month - 1] }));
    rows.push(aggregateRow({ year: 2025, month, costCategory: "Cost Summary", entityCategory: "Employee Benefits", amount: actualVisibleCost[month - 1] }));
    rows.push(aggregateRow({ year: 2025, month, costCategory: "Cost Summary", entityCategory: "Other governed cost", amount: actualOtherCost[month - 1] }));
    rows.push(aggregateRow({
      year: 2025,
      month,
      costCategory: "End Capacity",
      resourceType: "Internal",
      sourceSubCategory: "Internal",
      capacity: 20 + month,
    }));
    if (month >= 6) {
      rows.push(aggregateRow({ year: 2025, month, scenario: "CF02 2025", costCategory: "Revenue Summary", entityCategory: "Revenue", amount: cfRevenue[month - 1] }));
      rows.push(aggregateRow({ year: 2025, month, scenario: "CF02 2025", costCategory: "Cost Summary", entityCategory: "Employee Benefits", amount: cfCost[month - 1] }));
    }
  }
  return rows;
}

test("Entity P&L derives QoQ MTD, full cost totals, and separate forecast", () => {
  const report = buildEntityPnlReport(sampleRows(), request);
  const current = report.lines.find((line) => line.label === "Revenue")!;
  const expenses = report.lines.find((line) => line.label === "Total Expenses")!;
  const employeeBenefits = report.lines.find((line) => line.label === "Employee Benefits")!;
  const ebit = report.lines.find((line) => line.label === "EBIT")!;

  assert.equal(current.values[report.currentLabel], 200);
  assert.equal(current.values[report.comparisonLabel], 150);
  assert.equal(current.values[report.forecastLabel!], 250);
  assert.equal(expenses.values[report.currentLabel], 60);
  assert.equal(employeeBenefits.values[report.currentLabel], 40);
  assert.equal(ebit.values[report.currentLabel], 140);
  assert.equal(report.sourceRowCount, 28);
  assert.equal(report.forecastSourceRowCount, 4);
  assert.ok(report.evidence.some((item) => item.includes("blank entity values")));
});

test("Entity P&L capacity uses end values and a YTD average, not snapshot sums", () => {
  const report = buildEntityPnlReport(sampleRows(), request);
  const end = report.lines.find((line) => line.label === "End Capacity On-roll")!;
  const average = report.lines.find((line) => line.label === "Avg Capacity Overall")!;
  assert.equal(end.values[report.currentLabel], 27);
  assert.equal(average.values[report.currentLabel], 24);
});

test("Entity P&L export services produce readable PDF and PowerPoint files", async () => {
  const report = buildEntityPnlReport(sampleRows(), request);
  const exportReport = { title: "Entity P&L", periodLabel: report.periodLabel, result: { entityPnl: report, summary: report.summary } };
  const pdf = exportEntityPnlPdf(exportReport);
  const pptx = await exportEntityPnlPptx(exportReport);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pptx.subarray(0, 2).toString(), "PK");
});