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

test("both slides use statement totals in the totals box and bold total row without mutating data", async () => {
  const balanceSheet = fixture();
  const before = JSON.stringify(balanceSheet);
  const files = await exported(balanceSheet);
  for (let index = 1; index <= 2; index++) {
    const xml = strFromU8(files[`ppt/slides/slide${index}.xml`]);
    const label = index === 1 ? "Total Assets" : "Total Liabilities + Equity";
    assert.equal(xml.match(/<a:t>94,164<\/a:t>/g)?.length, 2);
    assert.equal(xml.match(/<a:t>98,946<\/a:t>/g)?.length, 2);
    assert.ok(xml.includes(`${label} (mINR)`));
    assert.ok(xml.includes(`<a:t>${label}</a:t>`));
    const totalRow = xml.match(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g)?.at(-1);
    assert.ok(totalRow?.includes(label));
    assert.ok(totalRow?.includes('b="1"'));
    assert.ok(totalRow?.includes("<a:t>-4,782</a:t>"));
    assert.ok(xml.includes("MANAGEMENT ATTENTION"));
    const objectIds = Array.from(xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g), ([, id]) => id);
    assert.equal(objectIds.length, new Set(objectIds).size, "slide object IDs must be unique");
  }
  assert.equal(JSON.stringify(balanceSheet), before);
});

test("charts have horizontal wrapped categories, no gridlines or visible value axis, and above-bar values", async () => {
  const files = await exported(fixture());
  const chartNames = Object.keys(files).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  assert.equal(chartNames.length, 2);
  for (const name of chartNames) {
    const xml = strFromU8(files[name]);
    assert.ok(!xml.includes("<c:majorGridlines"));
    assert.ok(!xml.includes("<c:minorGridlines"));
    const categoryAxis = xml.match(/<c:catAx\b[^>]*>[\s\S]*?<\/c:catAx>/)?.[0];
    assert.ok(categoryAxis?.includes('<a:bodyPr rot="0"/>'));
    const valueAxis = xml.match(/<c:valAx\b[^>]*>[\s\S]*?<\/c:valAx>/)?.[0];
    assert.ok(valueAxis?.includes('<c:delete val="1"/>'));
    assert.ok(valueAxis?.includes("<a:noFill/>"));
    assert.ok(xml.includes('<c:legendPos val="b"/>'));
    assert.ok(xml.includes('<c:dLblPos val="outEnd"/>'));
    assert.ok(xml.includes('<c:showVal val="1"/>'));
    assert.ok(xml.includes("439798") && xml.includes("BC4096"));
    assert.ok(xml.includes("Jun-26") && xml.includes("Mar-26"));
  }
  assert.ok(strFromU8(files[chartNames[0]]).includes("Investments in Group\nEntities"));
  assert.ok(strFromU8(files[chartNames[1]]).includes("Non-current\nliabilities &amp;\nprovisions"));
});

test("missing comparison totals are shown as unavailable rather than invented from chart categories", async () => {
  const balanceSheet = fixture();
  balanceSheet.comparisonTotals = null;
  const files = await exported(balanceSheet);
  for (let index = 1; index <= 2; index++) {
    const xml = strFromU8(files[`ppt/slides/slide${index}.xml`]);
    const totalRow = xml.match(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g)?.at(-1);
    assert.equal(totalRow?.match(/<a:t>—<\/a:t>/g)?.length, 2);
    assert.ok(totalRow?.includes("<a:t>n/a</a:t>"));
  }
});

test("zero comparison totals have no misleading infinite change percentage", async () => {
  const balanceSheet = fixture();
  balanceSheet.comparisonTotals!.assets = 0;
  balanceSheet.comparisonTotals!.liabilitiesAndEquity = 0;
  const files = await exported(balanceSheet);
  for (let index = 1; index <= 2; index++) {
    const xml = strFromU8(files[`ppt/slides/slide${index}.xml`]);
    const totalRow = xml.match(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g)?.at(-1);
    assert.ok(totalRow?.includes("<a:t>0</a:t>"));
    assert.ok(totalRow?.includes("<a:t>+94,164</a:t>"));
    assert.ok(totalRow?.includes("<a:t>n/a</a:t>"));
    assert.ok(!xml.includes("Infinity") && !xml.includes("NaN"));
  }
});
