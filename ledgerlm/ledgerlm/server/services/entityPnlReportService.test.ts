import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
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
  entitySubCategory?: string;
  orderReason?: string;
  glAccount?: string;
  resourceType?: string;
  onsiteOffshore?: string;
  sector?: string;
  serviceArea?: string;
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
    entity_sub_category: values.entitySubCategory ?? (values.costCategory === "Cost Summary" ? "Mapped cost" : ""),
    order_reason: values.orderReason ?? "",
    gl_account: values.glAccount ?? "",
    resource_type: values.resourceType ?? "",
    onsite_offshore: values.onsiteOffshore ?? "Offshore",
    sector: values.sector ?? "BBM",
    service_area: values.serviceArea ?? "Engineering",
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
      costCategory: "GB Wise END Capacity",
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

test("Entity P&L applies Semantic SQL revenue exclusions and signed eligible costs", () => {
  const rows = [
    aggregateRow({ year: 2025, month: 7, costCategory: "Revenue Summary", amount: 100 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "Revenue Summary", entityCategory: "Other revenue", amount: 20 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "Revenue Summary", orderReason: "YEH", amount: 50 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "Revenue Summary", glAccount: "1391234", amount: 60 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "Cost Summary", entityCategory: "Employee Benefits", entitySubCategory: "Salary", amount: 30 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "Cost Summary", entityCategory: "Other Expenses", entitySubCategory: "-", amount: 40 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "Cost Summary", entityCategory: "", entitySubCategory: "Mapped cost", amount: 100 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "Cost Summary", entityCategory: "Employee Benefits", entitySubCategory: "", amount: 100 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "Cost Summary", entityCategory: "Employee Benefits", entitySubCategory: "Salary", amount: -10 }),
  ];
  const yoyRequest = validateEntityPnlReportRequest({
    cubeId: "authorized-cube",
    entity: "",
    asOf: "2025-07",
    comparison: "yoy",
    currency: "USD",
  });
  const report = buildEntityPnlReport(rows, yoyRequest);
  const revenue = report.lines.find((line) => line.label === "Revenue")!;
  const expenses = report.lines.find((line) => line.label === "Total Expenses")!;
  const employeeBenefits = report.lines.find((line) => line.label === "Employee Benefits")!;
  const ebit = report.lines.find((line) => line.label === "EBIT")!;
  const ebitPct = report.lines.find((line) => line.label === "EBIT%")!;

  assert.equal(revenue.values[report.currentLabel], 120);
  assert.equal(expenses.values[report.currentLabel], 60);
  assert.equal(employeeBenefits.values[report.currentLabel], 20);
  assert.equal(ebit.values[report.currentLabel], 60);
  assert.equal(ebitPct.values[report.currentLabel], 50);
});

test("Entity P&L capacity follows Semantic SQL resource and location filters", () => {
  const rows = sampleRows();
  rows.push(
    aggregateRow({ year: 2025, month: 7, costCategory: "GB Wise END Capacity", resourceType: "Internal", onsiteOffshore: "Onsite", capacity: 3 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "GB Wise END Capacity", resourceType: "External", onsiteOffshore: "Offshore", capacity: 4 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "GB Wise END Capacity", resourceType: "External", onsiteOffshore: "Onsite", capacity: 100 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "GB Wise END Capacity", resourceType: "Internal", onsiteOffshore: "Offshore", sector: "Internal", capacity: 100 }),
    aggregateRow({ year: 2025, month: 7, costCategory: "GB Wise END Capacity", resourceType: "Internal", onsiteOffshore: "Offshore", serviceArea: "Corporate", capacity: 100 }),
  );
  const report = buildEntityPnlReport(rows, request);
  const end = report.lines.find((line) => line.label === "End Capacity On-roll")!;
  const outsourcing = report.lines.find((line) => line.label === "End Capacity Outsourcing")!;
  const totalEnd = report.lines.find((line) => line.label === "Total End")!;
  assert.equal(end.values[report.currentLabel], 30);
  assert.equal(outsourcing.values[report.currentLabel], 4);
  assert.equal(totalEnd.values[report.currentLabel], 34);
});

test("Entity P&L capacity uses end values and a YTD average, not snapshot sums", () => {
  const report = buildEntityPnlReport(sampleRows(), request);
  const end = report.lines.find((line) => line.label === "End Capacity On-roll")!;
  const average = report.lines.find((line) => line.label === "Avg Capacity Overall")!;
  const averageOnRoll = report.lines.find((line) => line.label === "Avg Capacity On-roll")!;
  assert.equal(end.values[report.currentLabel], 27);
  assert.equal(average.values[report.currentLabel], 24);
  assert.equal(averageOnRoll.values[report.currentLabel], 24);
});

test("Entity P&L marks missing comparison snapshots and incomplete YTD capacity as unavailable", () => {
  const sparseRows = [
    aggregateRow({ year: 2026, month: 7, costCategory: "Revenue Summary", entityCategory: "Revenue", amount: 1000 }),
    aggregateRow({ year: 2026, month: 7, costCategory: "Cost Summary", entityCategory: "Employee Benefits", amount: 400 }),
    aggregateRow({
      year: 2026,
      month: 7,
      costCategory: "GB Wise END Capacity",
      resourceType: "Internal",
      sourceSubCategory: "Internal",
      capacity: 24,
    }),
  ];
  const qoqRequest = validateEntityPnlReportRequest({
    cubeId: "authorized-cube",
    entity: "",
    asOf: "2026-07",
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
  assert.ok(qoqReport.warnings.some((warning) => warning.includes("Jun 2026")));
  assert.ok(qoqReport.warnings.some((warning) => warning.includes("YTD capacity averages are unavailable")));

  const yoyRequest = validateEntityPnlReportRequest({
    cubeId: "authorized-cube",
    entity: "",
    asOf: "2026-07",
    comparison: "yoy",
    currency: "INR",
  });
  const yoyReport = buildEntityPnlReport(sparseRows, yoyRequest);
  const yoyRevenue = yoyReport.lines.find((line) => line.label === "Revenue")!;
  const yoyExpenses = yoyReport.lines.find((line) => line.label === "Total Expenses")!;
  const yoyEbit = yoyReport.lines.find((line) => line.label === "EBIT")!;

  assert.equal(yoyRevenue.values[yoyReport.currentLabel], 1000);
  assert.equal(yoyExpenses.values[yoyReport.currentLabel], 400);
  assert.equal(yoyEbit.values[yoyReport.currentLabel], 600);
  assert.equal(yoyRevenue.values[yoyReport.comparisonLabel], null);
  assert.equal(yoyReport.metrics.Revenue, 1000);
});

test("Entity P&L export services produce readable PDF and PowerPoint files", async () => {
  const report = buildEntityPnlReport(sampleRows(), request);
  const exportReport = { title: "Entity P&L", periodLabel: report.periodLabel, result: { entityPnl: report, summary: report.summary } };
  const pdf = exportEntityPnlPdf(exportReport);
  const pptx = await exportEntityPnlPptx(exportReport);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pptx.subarray(0, 2).toString(), "PK");

  const slideXml = strFromU8(unzipSync(pptx)["ppt/slides/slide1.xml"]);
  assert.doesNotMatch(slideXml, /<a:tbl(?:\s|>)/, "Entity P&L PPTX should not contain a native table");
  assert.match(slideXml, /<a:t>Line item<\/a:t>/, "Entity P&L table headers should be rendered as text");
  assert.ok((slideXml.match(/<p:sp>/g) ?? []).length > report.lines.length * 2);
});

test("Bosch Entity P&L export preserves its template and follows the selected comparison", async () => {
  const templateBytes = await readFile(new URL("../../../../attached_assets/entity_pnl_bosch_template_fixed_1790671130261.pptx", import.meta.url));
  const rows = sampleRows();
  for (const row of rows) {
    if (!String(row.cost_category ?? "").toLowerCase().includes("capacity")) {
      row.amount = Number(row.amount ?? 0) * 1_000_000;
    }
  }
  for (let month = 1; month <= 7; month += 1) {
    rows.push(aggregateRow({
      year: 2025,
      month,
      costCategory: "GB Wise END Capacity",
      resourceType: "Outsourcing",
      sourceSubCategory: "Outsourcing",
      capacity: month + 5,
    }));
  }

  for (const comparison of ["yoy", "qoq"] as const) {
    const selectedRequest = validateEntityPnlReportRequest({
      cubeId: "authorized-cube",
      entity: "BGSW India",
      asOf: "2025-07",
      comparison,
      currency: "INR",
      cfVersion: "CF02 2025",
    });
    const report = buildEntityPnlReport(rows, selectedRequest);
    const pptx = await exportEntityPnlPptx({
      title: "Entity P&L",
      result: {
        entityPnl: report,
        summary: report.summary,
        insights: report.insights,
        commentary: report.commentary,
      },
    }, templateBytes.toString("base64"));
    const files = unzipSync(pptx);
    const slideXml = strFromU8(files["ppt/slides/slide1.xml"]);
    const tableXml = slideXml.match(/<a:tbl\b[\s\S]*?<\/a:tbl>/)?.[0];
    assert.ok(tableXml, "Bosch template table should remain in the exported slide");
    const tableRows = Array.from(tableXml.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g), (rowMatch) =>
      Array.from(rowMatch[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g), (cellMatch) =>
        Array.from(cellMatch[0].matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g), (textMatch) =>
          textMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
        ).join(""),
      ),
    );

    assert.match(slideXml, /Key movements from the selected comparison/);
    assert.match(slideXml, comparison === "yoy" ? /P&amp;L YTD'25 – YOY/ : /P&amp;L Q3'25 – QOQ/);
    assert.deepEqual(tableRows[0], [
      "BGSW India",
      "YE 2024",
      "CF02.2025",
      comparison === "yoy" ? "YTD07'25" : "July'25",
      comparison === "yoy" ? "YTD07'24" : "Apr'25",
      "Variance",
      "%",
    ]);
    assert.equal(tableRows[1]?.[3], comparison === "yoy" ? "1,100" : "200");
    assert.equal(tableRows[1]?.[4], comparison === "yoy" ? "—" : "150");
    assert.match(slideXml, /Avg Capacity onroll/);
    assert.doesNotMatch(slideXml, /Rate increase \+1%|Employee benefit increase is primarily/);
    assert.doesNotMatch(slideXml, /\{\{value\}\}|\{\{entity\}\}|\{\{evidence_note\}\}/);
    assert.equal(
      Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)).length,
      1,
      "the export should contain exactly one selected comparison slide",
    );
  }
});