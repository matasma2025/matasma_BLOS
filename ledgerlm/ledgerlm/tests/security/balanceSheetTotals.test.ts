import assert from "node:assert/strict";
import test from "node:test";
import { totalsForPeriod } from "../../server/services/balanceSheetService";
import { leverageTrendPointer } from "../../server/services/boards/balanceSheetPptxExportService";
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