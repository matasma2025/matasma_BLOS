import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { exportKpiReportPptx, removeEmptyPlaceholderParagraphs, removeSourceGovernanceFooter } from "../../server/services/boards/kpiPptxExportService";

test("removes a paragraph containing only an empty KPI placeholder", () => {
  const emptySummaryParagraph = '<a:p><a:pPr marL="0"/><a:r><a:t>{{ww_budget_revenue_summary}}</a:t></a:r></a:p>';
  const detailParagraph = '<a:p><a:pPr marL="0"/><a:r><a:t>{{ww_budget_revenue_detail}}</a:t></a:r></a:p>';

  assert.equal(
    removeEmptyPlaceholderParagraphs(
      `<p:txBody>${emptySummaryParagraph}${detailParagraph}</p:txBody>`,
      ["{{ww_budget_revenue_summary}}"],
    ),
    `<p:txBody>${detailParagraph}</p:txBody>`,
  );
});

test("preserves paragraphs with visible text and leaves XML unchanged without empty tokens", () => {
  const mixedParagraph = '<a:p><a:r><a:t>Summary: {{ww_budget_revenue_summary}}</a:t></a:r></a:p>';
  const detailParagraph = '<a:p><a:r><a:t>{{ww_budget_revenue_detail}}</a:t></a:r></a:p>';
  const xml = `<p:txBody>${mixedParagraph}${detailParagraph}</p:txBody>`;

  assert.equal(removeEmptyPlaceholderParagraphs(xml, ["{{ww_budget_revenue_summary}}"]), xml);
  assert.equal(removeEmptyPlaceholderParagraphs(xml, []), xml);
});

test("matches a placeholder split across runs without deleting neighboring paragraphs", () => {
  const splitSummaryParagraph = '<a:p><a:r><a:t>{{ww_budget_</a:t></a:r><a:r><a:t>revenue_summary}}</a:t></a:r></a:p>';
  const detailParagraph = '<a:p><a:r><a:t>Actual 12.3</a:t></a:r></a:p>';

  assert.equal(
    removeEmptyPlaceholderParagraphs(
      `${splitSummaryParagraph}${detailParagraph}`,
      ["{{ww_budget_revenue_summary}}"],
    ),
    detailParagraph,
  );
});

function wordingFixture(variance: number | null = 9) {
  const scopes = [
    { id: "world-wide", code: "WW", label: "World Wide", entity: "World Wide" },
    { id: "india", code: "IN", label: "India", entity: "BGSW" },
    { id: "vietnam", code: "VN", label: "Vietnam", entity: "BGSV" },
    { id: "mexico", code: "MX", label: "Mexico", entity: "NE-MX" },
  ];
  const metrics = [
    {
      label: "Budget / Revenue", actual: 696 as number | null, forecast: 687 as number | null, variance,
      breakdowns: [{ label: "MS", actual: 696, forecast: 687, variance }],
    },
    {
      label: "Capacity", actual: 20329.2 as number | null, forecast: 20564.7 as number | null, variance: variance === null ? null : -235.5,
      breakdowns: [{ label: "MS", actual: 20329.2, forecast: 20564.7, variance: variance === null ? null : -235.5 }],
    },
    {
      label: "Internal Utilization", actual: 0.952,
      comparisons: { priorYearActual: 0.93, previousMonthActual: 0.94 },
      breakdowns: [],
    },
  ];
  const report = {
    title: "KPI wording regression",
    result: { kpiReport: {
      periodLabel: "Aug 2026", metrics,
      scopeBadges: scopes.map((scope) => ({ ...scope, metrics })),
    } },
  };
  const files = Object.fromEntries(scopes.map((scope, index) => {
    const prefix = scope.code.toLowerCase();
    const paragraphs = ["budget_revenue", "capacity", "internal_utilization"].map(
      (metric) => `<a:p><a:r><a:t>{{${prefix}_${metric}_detail}}</a:t></a:r></a:p>`,
    ).join("");
    return [`ppt/slides/slide${index + 1}.xml`, strToU8(`<p:sld><p:txBody>${paragraphs}</p:txBody></p:sld>`)];
  }));
  return { report, template: Buffer.from(zipSync(files)).toString("base64") };
}

test("all four template slides use Budget forecast-first and Capacity actual-first wording without changing data", async () => {
  const { report, template } = wordingFixture();
  const before = JSON.stringify(report);
  const files = unzipSync(await exportKpiReportPptx(report, undefined, template));
  for (let index = 1; index <= 4; index++) {
    const xml = strFromU8(files[`ppt/slides/slide${index}.xml`]);
    for (const prefix of ["1) ", "MS: "]) {
      assert.ok(xml.includes(`${prefix}YTD 08.26 forecast is 687.0 m USD; Actuals is 696.0 m USD; up by 9.0 m USD.`));
      assert.ok(xml.includes(`${prefix}YTD 08.26 end Capacity (20,329) is lower by 236 HC as compared to YTD 08.26 Forecast (20,565).`));
    }
    assert.ok(xml.includes("1) YTD 08.26 is 95.2%; YTD 08.25: 93.0%; YTD 07.26 is 94.0%"));
  }
  assert.equal(JSON.stringify(report), before);
});

test("single-slide downloads use the same wording and preserve supplied variance rather than rounded subtraction", async () => {
  const { report, template } = wordingFixture(6.84);
  report.result.kpiReport.scopeBadges[1].metrics[0].actual = 612.3;
  report.result.kpiReport.scopeBadges[1].metrics[0].forecast = 605.4;
  const files = unzipSync(await exportKpiReportPptx(report, "IN", template));
  assert.equal(Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 1);
  const xml = strFromU8(files["ppt/slides/slide2.xml"]);
  assert.ok(xml.includes("forecast is 605.4 m USD; Actuals is 612.3 m USD; up by 6.8 m USD."));
});

test("negative Budget and positive Capacity differences use down and higher wording", async () => {
  const { report, template } = wordingFixture(-9);
  const budget = report.result.kpiReport.metrics[0];
  budget.actual = 678;
  budget.breakdowns[0].actual = 678;
  const capacity = report.result.kpiReport.metrics[1];
  capacity.actual = 20800.2;
  capacity.variance = 235.5;
  capacity.breakdowns[0].actual = 20800.2;
  capacity.breakdowns[0].variance = 235.5;
  const files = unzipSync(await exportKpiReportPptx(report, undefined, template));
  const xml = strFromU8(files["ppt/slides/slide1.xml"]);
  assert.ok(xml.includes("MS: YTD 08.26 forecast is 687.0 m USD; Actuals is 678.0 m USD; down by 9.0 m USD."));
  assert.ok(xml.includes("MS: YTD 08.26 end Capacity (20,800) is higher by 236 HC as compared to YTD 08.26 Forecast (20,565)."));
});

test("zero and missing differences are not described as higher or lower", async () => {
  const { report, template } = wordingFixture(0);
  for (const metric of report.result.kpiReport.metrics.slice(0, 2)) {
    metric.forecast = metric.actual;
    metric.variance = 0;
    for (const breakdown of metric.breakdowns) {
      breakdown.forecast = breakdown.actual;
      breakdown.variance = 0;
    }
  }
  const equalFiles = unzipSync(await exportKpiReportPptx(report, undefined, template));
  const equalXml = strFromU8(equalFiles["ppt/slides/slide1.xml"]);
  assert.ok(equalXml.includes("Actuals is 696.0 m USD; no difference."));
  assert.ok(equalXml.includes("end Capacity (20,329) is equal to YTD 08.26 Forecast (20,329)."));
  const missing = wordingFixture(null);
  const missingFiles = unzipSync(await exportKpiReportPptx(missing.report, undefined, missing.template));
  const missingXml = strFromU8(missingFiles["ppt/slides/slide1.xml"]);
  assert.ok(missingXml.includes("difference is unavailable."));
  assert.ok(!missingXml.includes("by 0 "));
});

test("missing Actual or Forecast retains unavailable-data wording instead of inventing a difference", async () => {
  const { report, template } = wordingFixture();
  const budget = report.result.kpiReport.metrics[0];
  budget.actual = null;
  const capacity = report.result.kpiReport.metrics[1];
  capacity.forecast = null;
  const files = unzipSync(await exportKpiReportPptx(report, undefined, template));
  const xml = strFromU8(files["ppt/slides/slide1.xml"]);
  assert.ok(xml.includes("1) YTD 08.26 Forecast is 687.0 mUSD; governed Actual is unavailable."));
  assert.ok(xml.includes("1) YTD 08.26 Actual 20,329 HC; governed Forecast is unavailable."));
});

test("Integrated Service is renamed for display only, retaining policy matching and source labels", async () => {
  const { report, template } = wordingFixture();
  for (const metric of report.result.kpiReport.metrics.slice(0, 2)) {
    metric.breakdowns.push({ ...metric.breakdowns[0], label: "Integrated Service" });
  }
  const before = JSON.stringify(report);
  const allFiles = unzipSync(await exportKpiReportPptx(report, undefined, template));
  for (let index = 1; index <= 3; index++) {
    const xml = strFromU8(allFiles[`ppt/slides/slide${index}.xml`]);
    assert.ok(xml.includes("Integrated Service (BD,GS,SO) : YTD 08.26 forecast"));
    assert.ok(xml.includes("Integrated Service (BD,GS,SO) : YTD 08.26 end Capacity"));
    assert.ok(!xml.includes("Integrated Service:"));
  }
  assert.ok(!strFromU8(allFiles["ppt/slides/slide4.xml"]).includes("Integrated Service"));
  const single = unzipSync(await exportKpiReportPptx(report, "VN", template));
  assert.ok(strFromU8(single["ppt/slides/slide3.xml"]).includes("Integrated Service (BD,GS,SO) : "));
  assert.equal(JSON.stringify(report), before);
});

test("removes the Source and governance block and its divider, preserving branding and slide footer", () => {
  const shape = (name: string, text: string) => `<p:sp><p:nvSpPr><p:cNvPr id="1" name="${name}"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const kept = shape("Title", "Business Metrics") + shape("Brand", "BOSCH") + shape("Slide", "{{ww_entity_label}} • Slide 1 of 4");
  const xml = kept + shape("Heading", "Source &amp; governance")
    + shape("Source", "{{ww_source_note}} • Actuals: {{ww_actual_source_label}}")
    + shape("Warnings", "Warnings / data-quality notes: {{ww_warnings}}")
    + shape("Shape 48", "");
  assert.equal(removeSourceGovernanceFooter(xml), kept);
  assert.equal(removeSourceGovernanceFooter(kept + shape("Shape 48", "")), kept + shape("Shape 48", ""));
});