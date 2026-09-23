import PptxGenJS from "pptxgenjs";
import type { BalanceSheetCategoryBreakdown, BalanceSheetLineItem, BalanceSheetReport } from "@shared/boards/balanceSheet";

interface BalanceSheetExportReport {
  title: string;
  periodLabel?: string | null;
  sourceSnapshot?: { name?: string; sourceType?: string } | null;
  result?: { balanceSheet?: BalanceSheetReport } | null;
}

const PptxConstructor = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS);
const CURRENT_COLOR = "439798";
const PRIOR_COLOR = "BC4096";

function displayUnit(balanceSheet: BalanceSheetReport) {
  return balanceSheet.currency.toUpperCase() === "INR" ? "mINR" : balanceSheet.unitLabel || balanceSheet.currency;
}

function scaleFor(balanceSheet: BalanceSheetReport) {
  return balanceSheet.currency.toUpperCase() === "INR" ? 1_000_000 : 1;
}

function amount(value: number, balanceSheet: BalanceSheetReport) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value / scaleFor(balanceSheet));
}

function signedAmount(value: number, balanceSheet: BalanceSheetReport) {
  return `${value >= 0 ? "+" : ""}${amount(value, balanceSheet)}`;
}

function percentage(value: number | null) {
  return value === null ? "n/a" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function categoryBreakdowns(balanceSheet: BalanceSheetReport): BalanceSheetCategoryBreakdown[] {
  if (balanceSheet.categoryBreakdowns?.length) return balanceSheet.categoryBreakdowns;
  const grouped = new Map<string, BalanceSheetCategoryBreakdown>();
  for (const item of balanceSheet.lineItems) {
    const key = `${item.section}|${item.category}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.value += item.value;
      existing.previousValue += item.previousValue ?? 0;
      existing.change += item.change;
    } else {
      grouped.set(key, {
        label: item.category,
        section: item.section === "unmapped" ? "assets" : item.section,
        value: item.value,
        previousValue: item.previousValue ?? 0,
        change: item.change,
        changePercent: item.previousValue ? item.change / Math.abs(item.previousValue) : null,
      });
    }
  }
  return Array.from(grouped.values());
}

function topMovements(balanceSheet: BalanceSheetReport, section: "assets" | "liabilities" | "equity", label: string) {
  return balanceSheet.lineItems
    .filter((item) => item.section === section && item.category === label)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 2);
}

function narrativeText(
  balanceSheet: BalanceSheetReport,
  section: "assets" | "liabilities" | "equity",
  currentLabel: string,
  priorLabel: string,
) {
  const categories = categoryBreakdowns(balanceSheet).filter((item) => item.section === section);
  const lines: string[] = [];
  for (const item of categories) {
    const movement = topMovements(balanceSheet, section, item.label);
    const detail = movement[0];
    lines.push(`${item.label}:`);
    lines.push(`• ${amount(item.value, balanceSheet)} ${displayUnit(balanceSheet)} at ${currentLabel} vs ${amount(item.previousValue, balanceSheet)} ${displayUnit(balanceSheet)} at ${priorLabel}: ${signedAmount(item.change, balanceSheet)} (${percentage(item.changePercent)}).`);
    if (detail && Math.abs(detail.change) > 0) {
      lines.push(`• Main account movement: ${detail.accountName} changed by ${signedAmount(detail.change, balanceSheet)} ${displayUnit(balanceSheet)} (${percentage(detail.changePercent)}).`);
    }
  }
  if (!lines.length) lines.push("• No category-level movement was available for this section.");
  return lines.join("\n");
}

function oldBalancePointers(
  balanceSheet: BalanceSheetReport,
  section: "assets" | "liabilities" | "equity",
) {
  const candidates = categoryBreakdowns(balanceSheet)
    .filter((item) => item.section === section && Math.abs(item.previousValue) > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 2);
  if (!candidates.length) return "• Nothing flagged from the data — add from supporting schedules.";
  return candidates.map((item) => {
    const share = balanceSheet.totals.assets === 0 ? null : (item.value / balanceSheet.totals.assets) * 100;
    return `• ${item.label} remains ${amount(item.value, balanceSheet)} ${displayUnit(balanceSheet)} at ${balanceSheet.periodLabel}${share === null ? "" : ` (${share.toFixed(1)}% of total assets)`}; validate the underlying account mix and any reclassification behind the ${signedAmount(item.change, balanceSheet)} ${displayUnit(balanceSheet)} movement.`;
  }).join("\n");
}

function addSectionSlide(
  pptx: InstanceType<typeof PptxGenJS>,
  report: BalanceSheetExportReport,
  balanceSheet: BalanceSheetReport,
  section: "assets" | "liabilities",
  title: string,
) {
  const slide = pptx.addSlide();
  const currentLabel = balanceSheet.periodLabel;
  const priorLabel = balanceSheet.comparisonPeriodLabel || "prior loaded period";
  const categories = categoryBreakdowns(balanceSheet).filter((item) => item.section === section);
  const chartLabels = categories.map((item) => item.label);
  const chartValues = categories.map((item) => item.value / scaleFor(balanceSheet));
  const priorValues = categories.map((item) => item.previousValue / scaleFor(balanceSheet));

  slide.background = { color: "FFFFFF" };
  slide.addText(title, {
    x: 0.45, y: 0.2, w: 12.3, h: 0.45,
    fontFace: "Aptos Display", fontSize: 24, bold: true, color: "000000", margin: 0, fit: "shrink",
  });
  slide.addChart(pptx.ChartType.bar, [
    { name: currentLabel, labels: chartLabels, values: chartValues },
    { name: priorLabel, labels: chartLabels, values: priorValues },
  ], {
    x: 0.45, y: 0.95, w: 5.55, h: 3.15,
    barDir: "col", catAxisLabelRotate: -35, catAxisLabelFontFace: "Aptos", catAxisLabelFontSize: 8,
    catAxisLabelColor: "333333", valAxisLabelFontFace: "Aptos", valAxisLabelFontSize: 8,
    valAxisLabelColor: "666666", valAxisLabelFormatCode: "#,##0", valAxisTitle: displayUnit(balanceSheet),
    valAxisTitleFontFace: "Aptos", valAxisTitleFontSize: 8, valAxisTitleColor: "666666",
    valGridLine: { color: "D9E1E2", width: 1 }, chartColors: [CURRENT_COLOR, PRIOR_COLOR],
    showLegend: true, legendPos: "b", showTitle: false, showValue: false,
    showCatName: false, showSerName: false, showLabel: false, showBorder: false,
  });
  slide.addText(narrativeText(balanceSheet, section, currentLabel, priorLabel), {
    x: 6.35, y: 0.92, w: 6.5, h: 3.65,
    fontFace: "Aptos", fontSize: 8.7, color: "000000", margin: 0.03,
    breakLine: false, fit: "shrink", valign: "top", paraSpaceAfterPt: 3,
  });
  slide.addText("All figures in " + displayUnit(balanceSheet) + ".", {
    x: 0.47, y: 4.18, w: 3, h: 0.18,
    fontFace: "Aptos", fontSize: 6.5, italic: true, color: "000000", margin: 0,
  });
  slide.addText("Key pointers on old balances:", {
    x: 0.47, y: 4.52, w: 5.5, h: 0.2,
    fontFace: "Aptos", fontSize: 9, bold: true, color: "000000", margin: 0,
  });
  slide.addText(oldBalancePointers(balanceSheet, section), {
    x: 0.47, y: 4.78, w: 12.25, h: 1.65,
    fontFace: "Aptos", fontSize: 8.4, color: "000000", margin: 0.02,
    breakLine: false, fit: "shrink", valign: "top", paraSpaceAfterPt: 3,
  });
  slide.addText(`Source: ${report.sourceSnapshot?.name ?? "Dedicated Balance Sheet cube"} · comparison uses the latest earlier loaded period`, {
    x: 0.47, y: 7.18, w: 12.35, h: 0.13,
    fontFace: "Aptos", fontSize: 6.5, color: "667085", margin: 0, align: "right",
  });
}

export async function exportBalanceSheetPptx(
  report: BalanceSheetExportReport,
  templateBytesBase64?: string,
): Promise<Buffer> {
  const balanceSheet = report.result?.balanceSheet;
  if (!balanceSheet) throw new Error("This report does not contain Balance Sheet data");
  // Balance Sheet exports are generated from the dedicated report payload. An
  // uploaded generic token template cannot carry the category chart and
  // period-over-period narrative required by the standalone output.
  void templateBytesBase64;
  const pptx = new PptxConstructor();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "LedgerLM";
  pptx.company = "LedgerLM";
  pptx.subject = "Balance Sheet standalone analysis";
  pptx.title = report.title;
  addSectionSlide(pptx, report, balanceSheet, "assets", `Balance Sheet – Assets as of ${balanceSheet.periodLabel}`);
  addSectionSlide(pptx, report, balanceSheet, "liabilities", `Balance Sheet – Liabilities as of ${balanceSheet.periodLabel}`);
  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}