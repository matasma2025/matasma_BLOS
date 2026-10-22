import PptxGenJS from "pptxgenjs";
import type { BalanceSheetCategoryBreakdown, BalanceSheetReport } from "@shared/boards/balanceSheet";
import { applyBalanceSheetCommentary, hasBalanceSheetComparison } from "./balanceSheetCommentaryService";
import { addBoschFooterToGeneratedSlide } from "./boschPptxFooter";

const CURRENT = "439798", PRIOR = "BC4096", TEXT = "333333", MUTED = "666666";
// Text margins are points, in left/top/right/bottom order. These match the
// reference's default OOXML insets (0.1 inches horizontal, 0.05 vertical).
const REFERENCE_MARGIN: [number, number, number, number] = [7.2, 3.6, 7.2, 3.6];
const compact = (label: string) => label.replace(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{2})(\d{2})$/, "$1-$3");
const labels: Record<string, string> = {
  "Cash & Cash equivalents": "Cash &\nequivalents",
  "Trade Receivables": "Trade\nreceivables",
  "Other current assets": "Other\ncurrent",
  "Investments in Group Entities": "Investments",
  "Right-of-use assets": "Right-of-use\nassets",
  "Fixed Assets": "Fixed assets",
  "Other Noncurrent assets": "Other\nnon-current",
  "Equity & reserves": "Equity &\nreserves",
  "Trade Payables": "Trade\npayables",
  "Lease liabilities": "Lease\nliabilities",
  "Other Liabilities": "Other\nliabilities",
  "Non-current liabilities & provisions": "Non-current\nliab. & prov.",
};

export function balanceSheetAxisRange(values: number[]) {
  const high = Math.max(0, ...values), low = Math.min(0, ...values);
  const extent = Math.max(high, -low) * 1.12;
  if (extent === 0) return { min: 0, max: 1, step: 0.2 };
  const power = 10 ** Math.floor(Math.log10(extent / 7));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= extent / 7)!;
  return { min: low < 0 ? Math.floor(low * 1.12 / step) * step : 0,
    max: high > 0 ? Math.ceil(high * 1.12 / step) * step : 0, step };
}

export function addBalanceSheetReferenceSlide(
  pptx: PptxGenJS,
  report: { sourceSnapshot?: { name?: string; sourceType?: string } | null },
  balanceSheet: BalanceSheetReport,
  section: "assets" | "liabilities",
  title: string,
  categories: BalanceSheetCategoryBreakdown[],
) {
  const slide = pptx.addSlide();
  const scale = balanceSheet.currency.toUpperCase() === "INR" ? 1_000_000 : 1;
  const unit = scale === 1_000_000 ? "mINR" : balanceSheet.unitLabel || balanceSheet.currency;
  const amount = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value / scale);
  const current = compact(balanceSheet.periodLabel);
  const prior = compact(balanceSheet.comparisonPeriodLabel || "Prior unavailable");
  const comparable = hasBalanceSheetComparison(balanceSheet);
  const narrative = balanceSheet.categoryCommentary ? balanceSheet : applyBalanceSheetCommentary(balanceSheet);
  const text = (value: string, x: number, y: number, w: number, h: number, size = 10, bold = false, color = TEXT) =>
    slide.addText(value, { x, y, w, h, fontFace: "Aptos", fontSize: size, bold, color,
      margin: 0, breakLine: false, valign: "top", fit: "shrink" });
  slide.background = { color: "FFFFFF" };
  // Coordinates and typography come from the supplied second PPT, not the
  // earlier redesign. Keep equity in the same liabilities plot and scale.
  const assets = section === "assets";
  slide.addText(title, {
    x: assets ? 0.28 : 0.47, y: assets ? 0.29 : 0.53, w: 11.43, h: 0.43,
    fontFace: "Aptos Display", fontSize: 28, bold: true, color: "000000",
    margin: REFERENCE_MARGIN, valign: "middle",
  });
  const key = section === "assets" ? "assets" : "liabilitiesAndEquity";
  const totalLabel = section === "assets" ? "Total Assets" : "Total Liabilities + Equity";
  const chart = (items: BalanceSheetCategoryBreakdown[]) => {
    if (!items.length) return;
    const values = items.map((item) => item.value / scale);
    const old = items.map((item) => item.previousValue / scale);
    const axis = balanceSheetAxisRange([...values, ...(comparable ? old : [])]);
    const categoryLabels = items.map((item) => labels[item.label] || item.label);
    slide.addChart(pptx.ChartType.bar, [
      { name: current, labels: categoryLabels, values },
      ...(comparable ? [{ name: prior, labels: categoryLabels, values: old }] : []),
    ], {
      x: 0.47, y: 1.09, w: 5.35, h: 2.98, barDir: "col", catAxisLabelRotate: 0,
      catAxisLabelFontFace: "Arial", catAxisLabelFontSize: 7.5,
      catAxisLabelColor: TEXT, catAxisMajorTickMark: "none",
      valAxisLabelFontFace: "Arial", valAxisLabelFontSize: 8,
      valAxisLabelColor: MUTED, valAxisLabelFormatCode: "#,##0",
      valAxisHidden: true, valAxisMinVal: axis.min, valAxisMaxVal: axis.max,
      valAxisMajorUnit: axis.step, valAxisLineShow: false,
      valGridLine: { style: "none" }, catGridLine: { style: "none" },
      chartColors: [CURRENT, PRIOR], showLegend: true, legendPos: "t", legendFontSize: 8,
      barGapWidthPct: 30,
      showTitle: false, showValue: true, showSerName: false, showLabel: false,
      dataLabelPosition: "inEnd", dataLabelFontFace: "Arial", dataLabelFontSize: 6,
      dataLabelColor: "000000", dataLabelFormatCode: "#,##0",
    });
  };
  chart(categories);
  slide.addText(`All figures in ${unit}.`, {
    x: assets ? 0.28 : 0.54, y: assets ? 4.33 : 4.38, w: assets ? 3.16 : 2.33, h: 0.2,
    fontFace: "Aptos", fontSize: 6, italic: true, color: "000000",
    margin: REFERENCE_MARGIN, valign: "middle",
  });
  const pointerX = assets ? 0.28 : 0.54;
  const pointerY = assets ? 4.66 : 4.59;
  const pointerW = assets ? 5.97 : 5.83;
  const pointers: string[] = [];
  const previousTotal = balanceSheet.comparisonTotals?.[key];
  pointers.push(`${totalLabel}: ${amount(balanceSheet.totals[key])} ${unit} (${current}) vs ${previousTotal == null ? "— (comparison unavailable)" : `${amount(previousTotal)} ${unit} (${prior})`}.`);
  if (section === "liabilities" && balanceSheet.comparisonTotals && balanceSheet.comparisonTotals.equity !== 0 && balanceSheet.totals.equity !== 0) {
    const old = balanceSheet.comparisonTotals!;
    pointers.push(`Debt/equity: ${(old.debt / old.equity).toFixed(2)}x → ${(balanceSheet.totals.debt / balanceSheet.totals.equity).toFixed(2)}x.`);
  }
  const largest = [...categories].sort((a, b) => b.value - a.value)[0];
  if (largest && balanceSheet.totals.assets > 0) pointers.push(`${largest.label}: ${(largest.value / balanceSheet.totals.assets * 100).toFixed(1)}% of total assets.`);
  pointers.push("Ageing requires supporting schedules.");
  slide.addText([
    { text: "Key pointers on old balances:", options: { bold: true, breakLine: true } },
    ...pointers.map((value) => ({ text: value, options: { bullet: { indent: 12 }, breakLine: true } })),
  ], { x: pointerX, y: pointerY, w: pointerW, h: assets ? 1.7 : 1.97,
    fontFace: "Aptos", fontSize: 10, color: "000000",
    margin: REFERENCE_MARGIN, valign: "top", fit: "shrink" });

  const commentaryOrder = assets
    ? ["Cash & Cash equivalents", "Trade Receivables", "Other current assets", "Investments in Group Entities", "Fixed Assets", "Other Noncurrent assets", "Right-of-use assets"]
    : ["Trade Payables", "Other Liabilities", "Equity & reserves", "Lease liabilities", "Provisions", "Non-current liabilities & provisions"];
  const ordered = [...categories].sort((a, b) =>
    (commentaryOrder.indexOf(a.label) < 0 ? commentaryOrder.length : commentaryOrder.indexOf(a.label))
    - (commentaryOrder.indexOf(b.label) < 0 ? commentaryOrder.length : commentaryOrder.indexOf(b.label)));
  const runs: PptxGenJS.TextProps[] = [];
  ordered.forEach((category) => {
    runs.push({ text: `${category.label}:`, options: { bold: true, breakLine: true, paraSpaceAfter: 2 } });
    const comment = narrative.categoryCommentary?.find((item) => item.category === category.label && item.section === category.section);
    runs.push({ text: comment?.text || "Supporting account detail is unavailable.",
      options: { bullet: { indent: 12 }, breakLine: true, paraSpaceAfter: 2 } });
  });
  slide.addText(runs, {
    x: assets ? 6.51 : 6.67, y: assets ? 0.91 : 1.07,
    w: assets ? 6.42 : 5.54, h: assets ? 5.67 : 5.35,
    fontFace: "Aptos", fontSize: 10, color: "000000", margin: REFERENCE_MARGIN,
    valign: "top", fit: "shrink",
  });
  const mode = narrative.commentaryStatus === "ai-selected" ? "AI-selected, verified commentary" : "Factual commentary (AI unavailable/not configured)";
  text(`${mode} · Source: ${report.sourceSnapshot?.name || "Dedicated Balance Sheet cube"} · latest earlier loaded comparison period`,
    0.32, 7.15, 11.1, 0.16, 7, false, MUTED);
  addBoschFooterToGeneratedSlide(pptx, slide);
}
