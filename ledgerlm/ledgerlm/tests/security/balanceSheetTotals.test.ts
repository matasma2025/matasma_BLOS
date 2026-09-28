import assert from "node:assert/strict";
import test from "node:test";
import { unzipSync } from "fflate";
import { rollUpBalanceSheetDetailRows } from "../../server/services/balanceSheetRollup";
import { totalsForPeriod } from "../../server/services/balanceSheetService";
import { exportBalanceSheetPptx, leverageTrendPointer } from "../../server/services/boards/balanceSheetPptxExportService";
import type { BalanceSheetReport } from "../../shared/boards/balanceSheet";

test("calculates finite payable totals and reference debt from statement liabilities", () => {
  const totals = totalsForPeriod([
    { section: "assets", category: "cash and cash equivalents", accountName: "Cash", amountReporting: "100" },
    { section: "liabilities", category: "trade payables", accountName: "Trade payables", amountReporting: "-20" },
    { section: "liabilities", category: "lease liabilities", accountName: "Lease liability", amountReporting: "-10" },
    { section: "equity", category: "equity", accountName: "Subscribed capital", amountReporting: "-50" },
    { section: "assets", category: "Total: Assets", accountName: "Total: Assets", amountReporting: "100" },
    { section: "liabilities", category: "Total: Liabilities", accountName: "Total: Liabilities", amountReporting: "-50" },
    { section: "equity", category: "Total: Equity", accountName: "Total: Equity", amountReporting: "-50" },
    { section: "liabilities", category: "Total: Liabilities and equity", accountName: "Total: Liabilities and equity", amountReporting: "-100" },
  ]);

  assert.equal(totals.debt, 50);
  assert.equal(totals.payables, 20);
  assert.ok(Object.values(totals).every(Number.isFinite));
});

test("includes the reference leverage trend in Balance Sheet pointers", () => {
  const balanceSheet = {
    totals: {
      assets: 94_164_485_453.34,
      liabilities: 41_259_098_038.72,
      equity: 52_905_387_414.62,
      liabilitiesAndEquity: 94_164_485_453.34,
      balanceDifference: 0,
      currentAssets: 0,
      currentLiabilities: 0,
      workingCapital: 0,
      cash: 0,
      receivables: 0,
      inventory: 0,
      debt: 41_259_098_038.72,
      payables: 11_411_061_921.81,
    },
    comparisonTotals: {
      assets: 98_945_690_389.54,
      liabilities: 40_950_510_637.56,
      equity: 57_995_179_751.98,
      liabilitiesAndEquity: 98_945_690_389.54,
      balanceDifference: 0,
      currentAssets: 0,
      currentLiabilities: 0,
      workingCapital: 0,
      cash: 0,
      receivables: 0,
      inventory: 0,
      debt: 40_950_510_637.56,
      payables: 9_117_488_259.56,
    },
    periodLabel: "Jun 2026",
    comparisonPeriodLabel: "Mar 2026",
  } as BalanceSheetReport;

  const pointer = leverageTrendPointer(balanceSheet);
  assert.ok(pointer);
  assert.match(pointer, /debt-to-equity increased from 0\.71 \(Mar-26\) to 0\.78 \(Jun-26\)/);
  assert.match(pointer, /equity ratio fell from 58\.6% to 56\.2%/);
});

test("rolls detail captions into current/non-current chart categories and reports unmapped captions", () => {
  const result = rollUpBalanceSheetDetailRows([
    {
      section: "assets",
      category: "Current assets | Trade receivables",
      accountName: "Trade receivables ≤ 1 y",
      value: 120,
    },
    {
      section: "assets",
      category: "Other non-current financial assets > 1 y | Investments (wo B-a)",
      accountName: "Shares in group entities",
      value: 200,
    },
    {
      section: "liabilities",
      category: "Trade payables | Trade payables",
      accountName: "Trade payables - 3rd parties",
      value: 80,
    },
    {
      section: "liabilities",
      category: "Lease liabilities (lessee) > 1 y",
      accountName: "Lease liability",
      value: 20,
    },
    { section: "equity", category: "Equity", accountName: "Subscribed capital", value: 50 },
    { section: "assets", category: "Unusual assets", accountName: "Unclassified caption", value: 7 },
  ]);

  const line = (label: string) => result.lines.find((candidate) => candidate.label === label);
  assert.equal(line("Trade Receivables")?.value, 120);
  assert.equal(line("Investments in Group Entities")?.value, 200);
  assert.equal(line("Trade Payables")?.value, 80);
  assert.equal(line("Lease liabilities")?.value, 20);
  assert.equal(line("Equity & reserves")?.value, 50);
  assert.deepEqual(line("Trade Receivables")?.sources, [
    "Current assets | Trade receivables",
    "Trade receivables ≤ 1 y",
  ]);
  assert.deepEqual(result.unmapped, [{
    item: "Unclassified caption",
    section: "assets",
    category: "Unusual assets",
  }]);
});

test("exports two chart slides from caption-rollup categories", async () => {
  const rollup = rollUpBalanceSheetDetailRows([
    {
      section: "assets",
      category: "Current assets | Trade receivables",
      accountName: "Trade receivables ≤ 1 y",
      value: 120_000_000,
    },
    {
      section: "liabilities",
      category: "Trade payables | Trade payables",
      accountName: "Trade payables - 3rd parties",
      value: 80_000_000,
    },
    { section: "equity", category: "Equity", accountName: "Subscribed capital", value: 40_000_000 },
  ]);
  const categoryBreakdowns = rollup.lines.map((item) => ({
    label: item.label,
    section: item.section,
    value: item.value,
    previousValue: item.value / 2,
    change: item.value / 2,
    changePercent: 1,
    sourceCaptions: item.sources,
  }));
  const balanceSheet = {
    currency: "INR",
    unitLabel: "INR",
    periodLabel: "Jun 2026",
    comparisonPeriodLabel: "Mar 2026",
    totals: {
      assets: 120_000_000,
      liabilities: 80_000_000,
      equity: 40_000_000,
      liabilitiesAndEquity: 120_000_000,
      balanceDifference: 0,
      currentAssets: 120_000_000,
      currentLiabilities: 80_000_000,
      workingCapital: 40_000_000,
      cash: 0,
      receivables: 120_000_000,
      inventory: 0,
      debt: 80_000_000,
      payables: 80_000_000,
    },
    comparisonTotals: {
      assets: 60_000_000,
      liabilities: 40_000_000,
      equity: 20_000_000,
      liabilitiesAndEquity: 60_000_000,
      balanceDifference: 0,
      currentAssets: 60_000_000,
      currentLiabilities: 40_000_000,
      workingCapital: 20_000_000,
      cash: 0,
      receivables: 60_000_000,
      inventory: 0,
      debt: 40_000_000,
      payables: 40_000_000,
    },
    ratios: { currentRatio: 1.5, quickRatio: 1.5, debtToEquity: 2, equityRatio: 1 / 3 },
    periods: [],
    lineItems: [],
    movements: [],
    categoryBreakdowns,
    unmappedRows: [],
    warnings: [],
    insights: [],
    risks: [],
    actions: [],
    balanced: true,
    difference: 0,
    tolerance: 0.01,
  } as BalanceSheetReport;

  const pptx = await exportBalanceSheetPptx({
    title: "Balance Sheet",
    result: { balanceSheet },
  });
  const archive = unzipSync(pptx);
  const slides = Object.keys(archive).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path));
  const charts = Object.entries(archive)
    .filter(([path]) => /^ppt\/charts\/chart\d+\.xml$/.test(path))
    .map(([, bytes]) => new TextDecoder().decode(bytes));
  const slideXml = slides.map((path) => new TextDecoder().decode(archive[path]));
  assert.equal(slides.length, 2);
  assert.equal(charts.length, 2);
  assert.ok(charts.some((xml) => xml.includes("Trade Receivables")));
  assert.ok(charts.some((xml) => xml.includes("Trade Payables")));
  assert.ok(charts.every((xml) => !/<c:showVal val="1"\/>/.test(xml)));
  assert.ok(slideXml.some((xml) => xml.includes("CATEGORY COMPARISON")));
  assert.ok(slideXml.some((xml) => xml.includes("MANAGEMENT ATTENTION")));
  assert.ok(slideXml.some((xml) => xml.includes("Trade Receivables")));
  assert.ok(slideXml.some((xml) => xml.includes("<a:t>120</a:t>")));
  assert.ok(slideXml.some((xml) => xml.includes("<a:t>60</a:t>")));
  assert.ok(slideXml.some((xml) => xml.includes("<a:t>+60</a:t>")));
  assert.ok(slideXml.some((xml) => xml.includes("<a:t>+100.0%</a:t>")));
});