import assert from "node:assert/strict";
import { test } from "node:test";
import PptxGenJS from "pptxgenjs";
import { unzipSync, strFromU8, strToU8, zipSync } from "fflate";
import { XMLValidator } from "fast-xml-parser";
import { exportEntityPnlPptx, exportEntityPnlPdf, type EntityPnlExportPayload } from "./entityPnlExportService";
import { validateAndNormalizePptx } from "./entityPnlPptxTemplate";
import { buildEntityPnlPlanningForecast } from "../entityPnlPlanningService";

const labels = ["Revenue", "Employee Benefits", "Outsourcing Cost", "Consultancy Charges",
  "CI Charges & Other Revenue", "Facilities Cost", "Other Expenses", "Total Expenses", "EBIT",
  "EBIT%", "End Capacity On-roll", "End Capacity Outsourcing", "Total End", "Avg Capacity On-roll",
  "Avg Capacity Outsourcing", "Total Average"];
// A self-contained fixture: regression tests must not depend on a user's uploaded file.
const templatePromise = (async () => {
  const Constructor = (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS;
  const pptx = new Constructor();
  pptx.layout = "LAYOUT_WIDE";
  const slide = pptx.addSlide();
  slide.addText("P&L H1'26 – YoY", { x: 0, y: 0, w: 8, h: 0.4 });
  slide.addText("Entity P&L Analysis · {{entity}}", { x: 0, y: 0.5, w: 8, h: 0.4 });
  slide.addText("Values in mINR · {{comparison_label}}", { x: 0, y: 1, w: 8, h: 0.4 });
  slide.addTable([
    ["BGSW India", "YE 2025", "CF05 2026", "YTD06 2026", "YTD06 2025", "Variance", "%"],
    ...labels.map((label) => [label === "EBIT%" ? "EBIT% of TNS" : label,
      "{{value}}", "{{value}}", "{{value}}", "{{value}}", "{{value}}", "{{pct}}"]),
  ], { x: 0, y: 1.5, w: 8, fontSize: 7, rowH: 0.25, autoPage: false });
  slide.addText("Consultancy cost", { x: 9, y: 2, w: 3, h: 0.4 });
  slide.addText("Higher by +658mINR due to one-time costs.", { x: 9, y: 2.5, w: 3, h: 0.4 });
  slide.addText("BOSCH", { x: 10, y: 7, w: 2, h: 0.3 });
  const bytes = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes as Uint8Array);
})();
function payload(forecast = false, comparison: "yoy" | "qoq" = "yoy"): EntityPnlExportPayload {
  const currentLabel = comparison === "yoy" ? "Jul 2026 YTD" : "Q2 2026";
  const comparisonLabel = comparison === "yoy" ? "Jul 2025 YTD" : "Q1 2026";
  const forecastLabel = forecast ? comparison === "yoy" ? "CF05 YTD" : "CF05 Q2 2026" : undefined;
  return {
    entity: "BGSW & India", asOf: comparison === "yoy" ? "2026-07" : "2026-06",
    comparison, currency: "INR", currentLabel, comparisonLabel, forecastLabel,
    yearEndLabel: "Dec 2025 YE", columns: [currentLabel, comparisonLabel, ...(forecastLabel ? [forecastLabel] : []), "Dec 2025 YE"],
    lines: labels.map((label) => ({
      label,
      values: { [currentLabel]: label === "EBIT%" ? 20 : 50_000_000,
        [comparisonLabel]: 30_000_000, "Dec 2025 YE": 90_000_000,
        ...(forecastLabel ? { [forecastLabel]: 40_000_000 } : {}) },
      variance: label === "EBIT%" ? 2 : 20_000_000, variancePercent: 66.7,
    })),
    evidence: ["Authorized cube"], warnings: [],
  };
}
function inspect(bytes: Buffer) {
  const files = unzipSync(bytes);
  for (const [name, content] of Object.entries(files)) {
    if (name.endsWith(".xml") || name.endsWith(".rels")) assert.equal(XMLValidator.validate(strFromU8(content)), true, name);
  }
  const slide = strFromU8(files["ppt/slides/slide1.xml"]);
  const ids = [...slide.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "Every slide-object ID must be unique");
  return { files, slide };
}
function tableRows(slide: string) {
  return [...slide.matchAll(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g)].map(([row]) =>
    [...row.matchAll(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g)].map(([cell]) =>
      [...cell.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) => match[1]).join("")));
}

async function combinedTemplate() {
  const files = unzipSync(await templatePromise);
  const source = strFromU8(files["ppt/slides/slide1.xml"]);
  files["ppt/slides/slide1.xml"] = strToU8(source.replace(/\bname="[^"]*"/, 'name="EntityPnLLayout:yoy"'));
  files["ppt/slides/slide2.xml"] = strToU8(source.replace(/\bname="[^"]*"/, 'name="EntityPnLLayout:qoq"'));
  files["ppt/slides/_rels/slide2.xml.rels"] = files["ppt/slides/_rels/slide1.xml.rels"];
  const presentation = strFromU8(files["ppt/presentation.xml"]);
  files["ppt/presentation.xml"] = strToU8(presentation.replace("</p:sldIdLst>", '<p:sldId id="257" r:id="rIdQoqLayout"/></p:sldIdLst>'));
  const rels = strFromU8(files["ppt/_rels/presentation.xml.rels"]);
  files["ppt/_rels/presentation.xml.rels"] = strToU8(rels.replace("</Relationships>",
    '<Relationship Id="rIdQoqLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>'));
  files["[Content_Types].xml"] = strToU8(strFromU8(files["[Content_Types].xml"]).replace("</Types>",
    '<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>'));
  return Buffer.from(zipSync(files));
}
test("legacy generated PPTX remains supported and has unique IDs", async () => {
  const data = payload();
  const original = JSON.stringify(data);
  inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } }));
  assert.equal(JSON.stringify(data), original, "Export must never mutate financial results");
});
test("uploaded template preserves non-slide files, branding, and correctly maps YoY + CF columns", async () => {
  const template = await templatePromise;
  const data = payload(true);
  const original = JSON.stringify(data);
  const { files, slide } = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } }, template.toString("base64")));
  const rows = tableRows(slide);
  assert.deepEqual(rows[1], ["Revenue", "90", "40", "50", "30", "20", "66.7%"]);
  assert.equal(rows[0][2], "CF05 · Jul 2026 YTD");
  assert.equal(rows[10][0], "EBIT%");
  assert.equal(rows[10][3], "20.0%");
  assert.equal(rows[10][5], "2.0 pp");
  assert.ok(slide.includes("BOSCH"));
  assert.ok(slide.includes("mINR"));
  assert.ok(!slide.includes("H1&apos;26"));
  assert.ok(!slide.includes("658mINR"));
  assert.ok(!slide.includes("{{"));
  for (const [name, content] of Object.entries(unzipSync(template))) {
    if (!name.startsWith("ppt/slides/")) assert.deepEqual(files[name], content, `Preserve ${name}`);
  }
  assert.equal(JSON.stringify(data), original);
});
test("missing forecast and historical data remain unavailable, not zero", async () => {
  const template = await templatePromise;
  const data = payload();
  for (const line of data.lines) {
    line.values[data.comparisonLabel] = null;
    line.values[data.yearEndLabel!] = null;
    line.variance = null;
    line.variancePercent = null;
  }
  const { slide } = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } }, template.toString("base64")));
  const rows = tableRows(slide);
  assert.equal(rows[0][2], "Forecast —");
  assert.deepEqual(rows[1], ["Revenue", "—", "—", "50", "—", "—", "—"]);
});
test("QoQ forecast headers retain quarter semantics; capacity is never divided by a million", async () => {
  const template = await templatePromise;
  const { slide } = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: payload(true, "qoq") } }, template.toString("base64")));
  const rows = tableRows(slide);
  assert.equal(rows[0][2], "CF05 Q2 2026");
  assert.equal(rows[0][3], "Q2 2026 Actual");
  assert.equal(rows[11][3], "50,000,000");
});
test("unsupported templates fail explicitly rather than silently outputting wrong values", async () => {
  const template = await templatePromise;
  const files = unzipSync(template);
  files["ppt/slides/slide1.xml"] = strToU8(strFromU8(files["ppt/slides/slide1.xml"]).replace("Employee Benefits", "Unknown Cost"));
  await assert.rejects(exportEntityPnlPptx({ title: "P&L", result: { entityPnl: payload() } }, Buffer.from(zipSync(files)).toString("base64")), /supported Entity P&L table/);
});
test("broken internal PowerPoint references are rejected", async () => {
  const template = await templatePromise;
  const files = unzipSync(template);
  delete files["ppt/theme/theme1.xml"];
  assert.throws(() => validateAndNormalizePptx(Buffer.from(zipSync(files))), /Missing PowerPoint package part/);
});

test("well-formed XML with a non-renderable table graphic URI is rejected", async () => {
  const files = unzipSync(await templatePromise);
  files["ppt/slides/slide1.xml"] = strToU8(strFromU8(files["ppt/slides/slide1.xml"])
    .replace('uri="http://schemas.openxmlformats.org/drawingml/2006/table"',
      'uri="http://schemas.openxmlformats.org/drawingml/2006/main/table"'));
  assert.throws(() => validateAndNormalizePptx(Buffer.from(zipSync(files))), /table graphic URI/);
});
test("existing PDF export still works", () => {
  assert.ok(exportEntityPnlPdf({ title: "P&L", result: { entityPnl: payload() } }).subarray(0, 4).equals(Buffer.from("%PDF")));
});

test("planning supplement is exported without altering the uploaded template table or its existing assets", async () => {
  const template = await templatePromise;
  const data = payload(true);
  data.planningForecast = buildEntityPnlPlanningForecast([
    { particulars: "Budget (mUSD)", sub_category: "Offshore", cost_value: 1162.8432 },
    { particulars: "Outsourcing Capacity", sub_category: "Average", cost_value: 3216.6871 },
  ], { entity: data.entity, scenario: "CF05 2026", asOf: data.asOf });
  data.expenseReconciliation = [{ period: data.currentLabel, amount: 25_000_000 }];
  const legacy = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } }, undefined, { includeSupplement: true }));
  assert.ok(legacy.files["ppt/slides/slide2.xml"]);
  const output = await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } }, template.toString("base64"), { includeSupplement: true });
  const { files, slide } = inspect(output);
  const supplementaryXml = strFromU8(files["ppt/slides/slide2.xml"]);
  assert.ok(supplementaryXml.includes("1,162.8432"));
  assert.ok(supplementaryXml.includes("3,216.6871"));
  assert.ok(supplementaryXml.includes("mUSD"));
  assert.ok(supplementaryXml.includes("Already in Total Expenses"));
  const main = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: payload(true) } }, template.toString("base64")));
  assert.deepEqual(tableRows(slide), tableRows(main.slide));
  const before = unzipSync(template);
  for (const name of Object.keys(before).filter((name) => name.startsWith("ppt/media/") || name.startsWith("ppt/theme/"))) {
    assert.deepEqual(files[name], before[name], name);
  }
  assert.deepEqual(validateAndNormalizePptx(output), output);
  const pdf = exportEntityPnlPdf({ title: "P&L", result: { entityPnl: data } });
  assert.ok(pdf.toString("latin1").includes("/Count 2"));
});

test("normal summary exports one slide even when detailed planning and comparisons exist", async () => {
  const data = payload(true);
  data.planningForecast = buildEntityPnlPlanningForecast([
    { particulars: "Budget (mUSD)", sub_category: "Offshore", cost_value: 1162.8432 },
  ], { entity: data.entity, scenario: "CF05 2026", asOf: data.asOf });
  data.expenseReconciliation = [{ period: data.currentLabel, amount: 25_000_000 }];
  for (const template of [undefined, (await templatePromise).toString("base64")]) {
    const { files } = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } }, template));
    const slides = Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    assert.equal(slides.length, 1);
    assert.ok(!files["ppt/slides/slide2.xml"]);
  }
});

test("combined template exports only the selected layout with dynamic periods and reference formatting", async () => {
  const template = await combinedTemplate();
  for (const comparison of ["qoq", "yoy"] as const) {
    const data = payload(true, comparison);
    data.lines[1].variance = -1_461_600_000;
    data.lines[1].variancePercent = -0.4;
    const before = JSON.stringify(data);
    const { files, slide } = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } }, template.toString("base64")));
    assert.equal(Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 1);
    assert.ok(slide.includes(`EntityPnLLayout:${comparison}`));
    assert.ok(!slide.includes(`EntityPnLLayout:${comparison === "qoq" ? "yoy" : "qoq"}`));
    const rows = tableRows(slide);
    assert.equal(rows[0][1], "YE 2025");
    assert.equal(rows[0][3], comparison === "qoq" ? "Jun&apos;26" : "YTD07&apos;26");
    assert.equal(rows[0][4], comparison === "qoq" ? "Mar&apos;26" : "YTD07&apos;25");
    assert.equal(rows[2][5], "(1,462)");
    assert.equal(rows[2][6], "0%");
    assert.equal(rows[1][6], "67%");
    assert.equal(rows[10][5], "2.00 pp");
    assert.ok(!slide.includes("658mINR") && !slide.includes("{{"));
    assert.equal(JSON.stringify(data), before);
    assert.deepEqual(validateAndNormalizePptx(Buffer.from(zipSync(files))), Buffer.from(zipSync(files)));
  }
});

test("combined template retains quarter semantics across the Q1/year boundary and appends supplement after selection", async () => {
  const template = await combinedTemplate();
  const data = payload(true, "qoq");
  const old = data.currentLabel;
  data.asOf = "2027-03";
  data.currentLabel = "Q1 2027";
  data.comparisonLabel = "Q4 2026";
  data.columns = [data.currentLabel, data.comparisonLabel, data.forecastLabel!, data.yearEndLabel!];
  for (const line of data.lines) {
    line.values[data.currentLabel] = line.values[old];
    line.values[data.comparisonLabel] = 20_000_000;
  }
  data.planningForecast = buildEntityPnlPlanningForecast([
    { particulars: "Budget (mUSD)", sub_category: "Offshore", cost_value: 12.5 },
  ], { entity: data.entity, scenario: "CF05 2027", asOf: data.asOf });
  const { files, slide } = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } }, template.toString("base64"), { includeSupplement: true }));
  assert.ok(slide.includes("Q1&apos;27"));
  assert.equal(tableRows(slide)[0][4], "Dec&apos;26");
  assert.ok(files["ppt/slides/slide2.xml"]);
  assert.ok(strFromU8(files["ppt/slides/slide2.xml"]).includes("12.5"));
});

test("combined layouts fail closed when the selected comparison layout is missing or duplicated", async () => {
  const template = await combinedTemplate();
  const files = unzipSync(template);
  files["ppt/slides/slide2.xml"] = strToU8(strFromU8(files["ppt/slides/slide2.xml"]).replace("EntityPnLLayout:qoq", "EntityPnLLayout:yoy"));
  for (const comparison of ["qoq", "yoy"] as const) {
    await assert.rejects(exportEntityPnlPptx({ title: "P&L", result: { entityPnl: payload(false, comparison) } },
      Buffer.from(zipSync(files)).toString("base64")), /exactly one/);
  }
});

test("old single-slide Overall template row maps to the new on-roll average without changing geometry", async () => {
  const files = unzipSync(await templatePromise);
  files["ppt/slides/slide1.xml"] = strToU8(strFromU8(files["ppt/slides/slide1.xml"]).replace("Avg Capacity On-roll", "Avg Capacity Overall"));
  const { slide } = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: payload() } },
    Buffer.from(zipSync(files)).toString("base64")));
  assert.equal(tableRows(slide)[14][0], "Avg Capacity On-roll");
});

test("old saved combined-average reports export a separately derived on-roll average without mutation", async () => {
  const data = payload();
  const average = data.lines.find((line) => line.label === "Avg Capacity On-roll")!;
  average.label = "Avg Capacity Overall";
  average.values[data.currentLabel] = 27000;
  average.values[data.comparisonLabel] = 29000;
  const outsourcing = data.lines.find((line) => line.label === "Avg Capacity Outsourcing")!;
  outsourcing.values[data.currentLabel] = 3000;
  outsourcing.values[data.comparisonLabel] = 2500;
  const before = JSON.stringify(data);
  const { slide } = inspect(await exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } },
    (await templatePromise).toString("base64")));
  const row = tableRows(slide)[14];
  assert.equal(row[3], "24,000");
  assert.equal(row[4], "26,500");
  assert.equal(row[5], "-2,500");
  assert.equal(JSON.stringify(data), before);
});

test("old saved QoQ YTD-average payloads must be regenerated before using the quarter-average layout", async () => {
  const data = payload(false, "qoq");
  data.lines.find((line) => line.label === "Avg Capacity On-roll")!.label = "Avg Capacity Overall";
  await assert.rejects(exportEntityPnlPptx({ title: "P&L", result: { entityPnl: data } },
    (await combinedTemplate()).toString("base64")), /Regenerate.*quarter capacity averages/);
});
