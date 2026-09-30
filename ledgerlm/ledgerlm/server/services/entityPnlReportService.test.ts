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
  asOf: "2025-06",
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
    rows.push(aggregateRow({ year: 2025, month, scenario: "CF02 2025", costCategory: "Revenue Summary", entityCategory: "Revenue", amount: cfRevenue[month - 1] }));
    rows.push(aggregateRow({ year: 2025, month, scenario: "CF02 2025", costCategory: "Cost Summary", entityCategory: "Employee Benefits", amount: cfCost[month - 1] }));
  }
  return rows;
}

test("Entity P&L derives quarter totals from cumulative snapshots and keeps forecast separate", () => {
  const report = buildEntityPnlReport(sampleRows(), request);
  const current = report.lines.find((line) => line.label === "Revenue")!;
  const expenses = report.lines.find((line) => line.label === "Total Expenses")!;
  const employeeBenefits = report.lines.find((line) => line.label === "Employee Benefits")!;
  const ebit = report.lines.find((line) => line.label === "EBIT")!;

  assert.equal(report.currentLabel, "Q2 2025");
  assert.equal(report.comparisonLabel, "Q1 2025");
  assert.equal(current.values[report.currentLabel], 500);
  assert.equal(current.values[report.comparisonLabel], 400);
  assert.equal(current.values[report.forecastLabel!], 550);
  assert.equal(expenses.values[report.currentLabel], 140);
  assert.equal(employeeBenefits.values[report.currentLabel], 100);
  assert.equal(ebit.values[report.currentLabel], 360);
  assert.equal(report.sourceRowCount, 28);
  assert.equal(report.forecastSourceRowCount, 14);
  assert.equal(ebit.variance, 70);
  assert.ok(report.evidence.some((item) => item.includes("blank entity values")));
});

test("Entity P&L capacity uses end values and a YTD average, not snapshot sums", () => {
  const report = buildEntityPnlReport(sampleRows(), request);
  const end = report.lines.find((line) => line.label === "End Capacity On-roll")!;
  const average = report.lines.find((line) => line.label === "Avg Capacity Overall")!;
  assert.equal(end.values[report.currentLabel], 26);
  assert.equal(average.values[report.currentLabel], 23.5);
});

test("Entity P&L marks missing comparison snapshots and incomplete YTD capacity as unavailable", () => {
  const sparseRows = [
    aggregateRow({ year: 2026, month: 6, costCategory: "Revenue Summary", entityCategory: "Revenue", amount: 1000 }),
    aggregateRow({ year: 2026, month: 6, costCategory: "Cost Summary", entityCategory: "Employee Benefits", amount: 400 }),
    aggregateRow({
      year: 2026,
      month: 6,
      costCategory: "End Capacity",
      resourceType: "Internal",
      sourceSubCategory: "Internal",
      capacity: 24,
    }),
  ];
  const qoqRequest = validateEntityPnlReportRequest({
    cubeId: "authorized-cube",
    entity: "",
    asOf: "2026-06",
    comparison: "qoq",
    currency: "INR",
  });
  const qoqReport = buildEntityPnlReport(sparseRows, qoqRequest);
  const qoqRevenue = qoqReport.lines.find((line) => line.label === "Revenue")!;
  const qoqExpenses = qoqReport.lines.find((line) => line.label === "Total Expenses")!;
  const qoqEbit = qoqReport.lines.find((line) => line.label === "EBIT")!;
  const qoqEndCapacity = qoqReport.lines.find((line) => line.label === "Total End")!;
  const qoqAverageCapacity = qoqReport.lines.find((line) => line.label === "Avg Capacity Overall")!;

  assert.equal(qoqRevenue.values[qoqReport.currentLabel], null);
  assert.equal(qoqExpenses.values[qoqReport.currentLabel], null);
  assert.equal(qoqEbit.values[qoqReport.currentLabel], null);
  assert.equal(qoqRevenue.values[qoqReport.comparisonLabel], null);
  assert.equal(qoqEndCapacity.values[qoqReport.currentLabel], 24);
  assert.equal(qoqAverageCapacity.values[qoqReport.currentLabel], null);
  assert.equal(qoqReport.kpis.find((kpi) => kpi.label.startsWith("Revenue"))?.value, "—");
  assert.ok(qoqReport.warnings.some((warning) => warning.includes("Mar 2026")));
  assert.ok(qoqReport.warnings.some((warning) => warning.includes("YTD capacity averages are unavailable")));

  const yoyRequest = validateEntityPnlReportRequest({
    cubeId: "authorized-cube",
    entity: "",
    asOf: "2026-07",
    comparison: "yoy",
    currency: "INR",
  });
  const yoySparseRows = [
    aggregateRow({ year: 2026, month: 7, costCategory: "Revenue Summary", entityCategory: "Revenue", amount: 1000 }),
    aggregateRow({ year: 2026, month: 7, costCategory: "Cost Summary", entityCategory: "Employee Benefits", amount: 400 }),
  ];
  const yoyReport = buildEntityPnlReport(yoySparseRows, yoyRequest);
  const yoyRevenue = yoyReport.lines.find((line) => line.label === "Revenue")!;
  const yoyExpenses = yoyReport.lines.find((line) => line.label === "Total Expenses")!;
  const yoyEbit = yoyReport.lines.find((line) => line.label === "EBIT")!;

  assert.equal(yoyRevenue.values[yoyReport.currentLabel], 1000);
  assert.equal(yoyExpenses.values[yoyReport.currentLabel], 400);
  assert.equal(yoyEbit.values[yoyReport.currentLabel], 600);
  assert.equal(yoyRevenue.values[yoyReport.comparisonLabel], null);
  assert.equal(yoyReport.metrics.Revenue, 1000);
});

test("Entity P&L QoQ accepts only quarter ends and computes every quarter against the prior quarter", () => {
  assert.throws(
    () => validateEntityPnlReportRequest({
      cubeId: "authorized-cube",
      entity: "",
      asOf: "2025-07",
      comparison: "qoq",
      currency: "INR",
    }),
    /March, June, September, or December/,
  );

  const cumulativeSnapshots = [
    { year: 2024, month: 9, revenue: 500, cost: 250 },
    { year: 2024, month: 12, revenue: 800, cost: 400 },
    { year: 2025, month: 3, revenue: 300, cost: 120 },
    { year: 2025, month: 6, revenue: 750, cost: 300 },
    { year: 2025, month: 9, revenue: 1300, cost: 520 },
    { year: 2025, month: 12, revenue: 2000, cost: 800 },
  ];
  const rows = cumulativeSnapshots.flatMap(({ year, month, revenue, cost }) => [
    aggregateRow({ year, month, costCategory: "Revenue Summary", entityCategory: "Revenue", amount: revenue }),
    aggregateRow({ year, month, costCategory: "Cost Summary", entityCategory: "Employee Benefits", amount: cost }),
  ]);
  const cases = [
    { asOf: "2025-03", current: "Q1 2025", prior: "Q4 2024", revenue: 300, priorRevenue: 300 },
    { asOf: "2025-06", current: "Q2 2025", prior: "Q1 2025", revenue: 450, priorRevenue: 300 },
    { asOf: "2025-09", current: "Q3 2025", prior: "Q2 2025", revenue: 550, priorRevenue: 450 },
    { asOf: "2025-12", current: "Q4 2025", prior: "Q3 2025", revenue: 700, priorRevenue: 550 },
  ];

  for (const quarter of cases) {
    const report = buildEntityPnlReport(rows, validateEntityPnlReportRequest({
      cubeId: "authorized-cube",
      entity: "",
      asOf: quarter.asOf,
      comparison: "qoq",
      currency: "INR",
    }));
    const revenue = report.lines.find((line) => line.label === "Revenue")!;
    assert.equal(report.currentLabel, quarter.current);
    assert.equal(report.comparisonLabel, quarter.prior);
    assert.equal(revenue.values[report.currentLabel], quarter.revenue);
    assert.equal(revenue.values[report.comparisonLabel], quarter.priorRevenue);
  }
});

test("Entity P&L export services produce readable PDF and PowerPoint files", async () => {
  const report = buildEntityPnlReport(sampleRows(), request);
  const exportReport = { title: "Entity P&L", periodLabel: report.periodLabel, result: { entityPnl: report, summary: report.summary } };
  const pdf = exportEntityPnlPdf(exportReport);
  const pptx = await exportEntityPnlPptx(exportReport);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pptx.subarray(0, 2).toString(), "PK");
});