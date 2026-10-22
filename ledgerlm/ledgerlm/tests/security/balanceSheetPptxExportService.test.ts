import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { exportBalanceSheetPptx } from "../../server/services/boards/balanceSheetPptxExportService";
import type { BalanceSheetReport } from "../../shared/boards/balanceSheet";

function fixture(): BalanceSheetReport {
  const totals = {
    assets: 94_164_485_453.34, liabilities: 41_259_098_038.72,
    equity: 52_905_387_414.62, liabilitiesAndEquity: 94_164_485_453.34,
    balanceDifference: 0, currentAssets: 0, currentLiabilities: 0,
    workingCapital: 0, cash: 0, receivables: 0, inventory: 0, debt: 0, payables: 0,
  };
  return {
    balanced: true, difference: 0, tolerance: 1, currency: "INR", unitLabel: "INR",
    periodLabel: "Jun 2026", comparisonPeriodLabel: "Mar 2026",
    totals, comparisonTotals: {
      ...totals, assets: 98_946_000_000, liabilitiesAndEquity: 98_946_000_000,
      liabilities: 40_951_000_000, equity: 57_995_000_000,
    },
    ratios: { currentRatio: null, quickRatio: null, debtToEquity: null, equityRatio: null },
    periods: [], lineItems: [], movements: [], unmappedRows: [],
    warnings: [], insights: [], risks: [], actions: [],
    // Intentionally incomplete: totals must come from statement totals, not chart sums.
    categoryBreakdowns: [
      { label: "Investments in Group Entities", section: "assets",
        value: 15_143_000_000, previousValue: 18_831_000_000,
        change: -3_688_000_000, changePercent: -3_688 / 18_831 },
      { label: "Equity & reserves", section: "equity",
        value: 52_905_387_414.62, previousValue: 57_995_000_000,
        change: -5_089_612_585.38, changePercent: -5_089_612_585.38 / 57_995_000_000 },
      { label: "Non-current liabilities & provisions", section: "liabilities",
        value: 6_637_000_000, previousValue: 6_887_000_000,
        change: -250_000_000, changePercent: -250 / 6_887 },
    ],
  };
}

async function exported(balanceSheet: BalanceSheetReport) {
  return unzipSync(await exportBalanceSheetPptx({ title: "Balance Sheet", result: { balanceSheet } }));
}

test("both slides use prominent statement totals with no repeated table or data mutation", async () => {
  const balanceSheet = fixture();
  const before = JSON.stringify(balanceSheet);
  const files = await exported(balanceSheet);
  for (let index = 1; index <= 2; index++) {
    const xml = strFromU8(files[`ppt/slides/slide${index}.xml`]);
    const label = index === 1 ? "Total Assets" : "Total Liabilities + Equity";
    assert.ok(xml.includes(`${label}: 94,164 mINR (Jun-26) vs 98,946 mINR (Mar-26)`));
    assert.ok(!xml.includes("<a:tbl>"));
    assert.ok(!xml.includes("CATEGORY COMPARISON"));
    assert.ok(xml.includes('sz="2800"'));
    assert.ok(xml.includes("Key pointers on old balances:"));
    assert.ok(!xml.includes("separate scale"));
    assert.ok(xml.includes("Factual commentary"));
    const objectIds = Array.from(xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g), ([, id]) => id);
    assert.equal(objectIds.length, new Set(objectIds).size, "slide object IDs must be unique");
  }
  assert.equal(JSON.stringify(balanceSheet), before);
});

test("both generated Balance Sheet slides include the Bosch logo and multicolor footer band", async () => {
  const files = await exported(fixture());
  for (let index = 1; index <= 2; index++) {
    const xml = strFromU8(files[`ppt/slides/slide${index}.xml`]);
    const relationships = strFromU8(files[`ppt/slides/_rels/slide${index}.xml.rels`]);
    assert.equal((xml.match(/<p:pic>/g) ?? []).length, 2);
    assert.ok(xml.includes("Internal | Governed Enterprise Data"));
    assert.ok(xml.includes("© Bosch Global Software Technologies Company Limited 2022."));
    assert.equal((relationships.match(/\/image"/g) ?? []).length, 2);
  }
});

test("reference charts keep equity first in the main plot, with top legends and unwrapped above-bar values", async () => {
  const files = await exported(fixture());
  const chartNames = Object.keys(files).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  assert.equal(chartNames.length, 2);
  for (const name of chartNames) {
    const xml = strFromU8(files[name]);
    const categoryAxis = xml.match(/<c:catAx\b[^>]*>[\s\S]*?<\/c:catAx>/)?.[0];
    assert.ok(categoryAxis?.includes('<a:bodyPr rot="0"/>'));
    const valueAxis = xml.match(/<c:valAx\b[^>]*>[\s\S]*?<\/c:valAx>/)?.[0];
    assert.ok(valueAxis?.includes('<c:delete val="1"/>'));
    assert.ok(valueAxis?.includes('<c:min val="0"/>'));
    assert.ok(xml.includes('<c:legendPos val="t"/>'));
    assert.ok(xml.includes('<c:dLblPos val="outEnd"/>'));
    assert.ok(!xml.includes('<c:dLblPos val="inBase"/>'));
    assert.ok(xml.includes('wrap="none"'));
    assert.ok(xml.includes('<c:showVal val="1"/>'));
    assert.ok(xml.includes('sz="600"'));
    assert.ok(xml.includes("439798") && xml.includes("BC4096"));
    assert.ok(xml.includes("Jun-26") && xml.includes("Mar-26"));
  }
  assert.ok(strFromU8(files[chartNames[0]]).includes("Investments"));
  const mainLiabilities = strFromU8(files[chartNames[1]]);
  assert.ok(mainLiabilities.includes("Non-current\nliab. &amp; prov."));
  assert.ok(mainLiabilities.includes("Equity"));
  assert.ok(mainLiabilities.indexOf("Equity") < mainLiabilities.indexOf("Non-current"));
  for (let i = 1; i <= 2; i++) {
    const xml = strFromU8(files[`ppt/slides/slide${i}.xml`]);
    assert.ok(xml.includes('<a:off x="429768" y="996696"/>'), "reference chart origin");
    assert.ok(xml.includes('<a:ext cx="4892040" cy="2724912"/>'), "reference chart dimensions");
  }
});

test("missing comparison totals are shown as unavailable rather than invented from chart categories", async () => {
  const balanceSheet = fixture();
  balanceSheet.comparisonTotals = null;
  const files = await exported(balanceSheet);
  for (let index = 1; index <= 2; index++) {
    const xml = strFromU8(files[`ppt/slides/slide${index}.xml`]);
    assert.ok(xml.includes("— (comparison unavailable)"));
    assert.ok(!xml.includes("<a:tbl>"));
  }
  for (const [name, bytes] of Object.entries(files).filter(([name]) => /^ppt\/charts\/chart\d+\.xml$/.test(name))) {
    assert.equal((strFromU8(bytes).match(/<c:ser>/g) ?? []).length, 2, name);
  }
});

test("a report without any prior balances does not plot invented comparison zeros", async () => {
  const report = fixture();
  report.comparisonTotals = null;
  report.comparisonPeriodLabel = null;
  report.categoryBreakdowns.forEach((item) => { item.previousValue = 0; });
  const files = await exported(report);
  for (const [name, bytes] of Object.entries(files).filter(([name]) => /^ppt\/charts\/chart\d+\.xml$/.test(name))) {
    assert.equal((strFromU8(bytes).match(/<c:ser>/g) ?? []).length, 1, name);
  }
});

test("zero comparison totals have no misleading infinite change percentage", async () => {
  const balanceSheet = fixture();
  balanceSheet.comparisonTotals!.assets = 0;
  balanceSheet.comparisonTotals!.liabilitiesAndEquity = 0;
  const files = await exported(balanceSheet);
  for (let index = 1; index <= 2; index++) {
    const xml = strFromU8(files[`ppt/slides/slide${index}.xml`]);
    assert.ok(xml.includes("vs 0 mINR"));
    assert.ok(!xml.includes("Infinity") && !xml.includes("NaN"));
  }
});
