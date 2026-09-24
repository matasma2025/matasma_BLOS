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
type ReportSection = "assets" | "liabilities" | "equity";

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

function compactPeriodLabel(label: string) {
  const match = label.trim().match(/^([A-Za-z]{3,})\s+(\d{4})$/);
  if (!match) return label;
  return `${match[1].slice(0, 3)}-${match[2].slice(-2)}`;
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

function chartCategories(
  balanceSheet: BalanceSheetReport,
  section: "assets" | "liabilities",
) {
  const order = section === "assets"
    ? [
      "Cash & Cash equivalents",
      "Trade Receivables",
      "Other current assets",
      "Investments in Group Entities",
      "Right-of-use assets",
      "Fixed Assets",
      "Other Noncurrent assets",
    ]
    : [
      "Equity & reserves",
      "Trade Payables",
      "Lease liabilities",
      "Provisions",
      "Other Liabilities",
      "Non-current liabilities & provisions",
    ];
  const rank = new Map(order.map((label, index) => [label, index]));
  return categoryBreakdowns(balanceSheet)
    .filter((item) => (section === "assets"
      ? item.section === "assets"
      : item.section === "liabilities" || item.section === "equity"))
    .sort((a, b) => (rank.get(a.label) ?? order.length) - (rank.get(b.label) ?? order.length));
}

function topMovements(balanceSheet: BalanceSheetReport, section: "assets" | "liabilities" | "equity", label: string) {
  return balanceSheet.lineItems
    .filter((item) => item.section === section && item.category === label)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 2);
}

export function leverageTrendPointer(
  balanceSheet: Pick<BalanceSheetReport, "totals" | "comparisonTotals" | "periodLabel" | "comparisonPeriodLabel">,
): string | null {
  const previous = balanceSheet.comparisonTotals;
  if (!previous) return null;

  const previousDebtToEquity = previous.equity === 0 ? null : previous.debt / previous.equity;
  const currentDebtToEquity = balanceSheet.totals.equity === 0
    ? null
    : balanceSheet.totals.debt / balanceSheet.totals.equity;
  const previousEquityRatio = previous.assets === 0 ? null : previous.equity / previous.assets;
  const currentEquityRatio = balanceSheet.totals.assets === 0
    ? null
    : balanceSheet.totals.equity / balanceSheet.totals.assets;
  if (
    previousDebtToEquity === null
    || currentDebtToEquity === null
    || previousEquityRatio === null
    || currentEquityRatio === null
  ) return null;

  const worsened = currentDebtToEquity > previousDebtToEquity || currentEquityRatio < previousEquityRatio;
  const improved = currentDebtToEquity < previousDebtToEquity || currentEquityRatio > previousEquityRatio;
  const direction = worsened === improved ? "was mixed vs baseline" : worsened ? "worsened vs baseline" : "improved vs baseline";
  const debtVerb = currentDebtToEquity > previousDebtToEquity
    ? "increased"
    : currentDebtToEquity < previousDebtToEquity ? "fell" : "held steady";
  const equityVerb = currentEquityRatio < previousEquityRatio
    ? "fell"
    : currentEquityRatio > previousEquityRatio ? "increased" : "held steady";
  const currentLabel = compactPeriodLabel(balanceSheet.periodLabel);
  const previousLabel = compactPeriodLabel(balanceSheet.comparisonPeriodLabel || "prior loaded period");
  const caution = worsened ? "—still strong, but a watch item if the trend continues" : "";

  return `• Leverage direction of travel ${direction}: debt-to-equity ${debtVerb} from ${previousDebtToEquity.toFixed(2)} (${previousLabel}) to ${currentDebtToEquity.toFixed(2)} (${currentLabel}) and equity ratio ${equityVerb} from ${(previousEquityRatio * 100).toFixed(1)}% to ${(currentEquityRatio * 100).toFixed(1)}%${caution}.`;
}

function narrativeText(
  balanceSheet: BalanceSheetReport,
  sections: ReportSection[],
  currentLabel: string,
  priorLabel: string,
) {
  const categories = categoryBreakdowns(balanceSheet).filter((item) => sections.includes(item.section));
  const lines: string[] = [];
  for (const item of categories) {
    const movement = topMovements(balanceSheet, item.section, item.label);
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
  sections: ReportSection[],
) {
  const leveragePointer = sections.includes("liabilities")
    ? leverageTrendPointer(balanceSheet)
    : null;
  const candidates = categoryBreakdowns(balanceSheet)
    .filter((item) => sections.includes(item.section) && Math.abs(item.previousValue) > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, leveragePointer ? 1 : 2);
  if (!candidates.length && !leveragePointer) return "• Nothing flagged from the data — add from supporting schedules.";
  const currentLabel = compactPeriodLabel(balanceSheet.periodLabel);
  const categoryPointers = candidates.map((item) => {
    const share = balanceSheet.totals.assets === 0 ? null : (item.value / balanceSheet.totals.assets) * 100;
    return `• ${item.label} remains ${amount(item.value, balanceSheet)} ${displayUnit(balanceSheet)} at ${currentLabel}${share === null ? "" : ` (${share.toFixed(1)}% of total assets)`}; validate the underlying account mix and any reclassification behind the ${signedAmount(item.change, balanceSheet)} ${displayUnit(balanceSheet)} movement.`;
  });
  return [leveragePointer, ...categoryPointers].filter((line): line is string => Boolean(line)).join("\n");
}

function addSectionSlide(
  pptx: InstanceType<typeof PptxGenJS>,
  report: BalanceSheetExportReport,
  balanceSheet: BalanceSheetReport,
  section: "assets" | "liabilities",
  title: string,
) {
  const slide = pptx.addSlide();
  const includedSections: ReportSection[] = section === "liabilities" ? ["liabilities", "equity"] : ["assets"];
  const currentLabel = compactPeriodLabel(balanceSheet.periodLabel);
  const priorLabel = compactPeriodLabel(balanceSheet.comparisonPeriodLabel || "prior loaded period");
  const categories = chartCategories(balanceSheet, section);
  const chartLabels = categories.map((item) => item.label);
  const chartValues = categories.map((item) => item.value / scaleFor(balanceSheet));
  const priorValues = categories.map((item) => item.previousValue / scaleFor(balanceSheet));

  slide.background = { color: "FFFFFF" };
  slide.addText(title, {
    x: 0.28, y: 0.29, w: 11.43, h: 0.43,
    fontFace: "Aptos Display", fontSize: 28, bold: true, color: "000000", margin: 0.1, fit: "shrink",
  });
  slide.addChart(pptx.ChartType.bar, [
    { name: currentLabel, labels: chartLabels, values: chartValues },
    { name: priorLabel, labels: chartLabels, values: priorValues },
  ], {
    x: 0.47, y: 1.09, w: 5.35, h: 2.98,
    barDir: "col", catAxisLabelRotate: -35, catAxisLabelFontFace: "Aptos", catAxisLabelFontSize: 8,
    catAxisLabelColor: "333333", valAxisLabelFontFace: "Aptos", valAxisLabelFontSize: 8,
    valAxisLabelColor: "666666", valAxisLabelFormatCode: "#,##0", valAxisTitle: displayUnit(balanceSheet),
    valAxisTitleFontFace: "Aptos", valAxisTitleFontSize: 8, valAxisTitleColor: "666666",
    valGridLine: { color: "D9E1E2" }, chartColors: [CURRENT_COLOR, PRIOR_COLOR],
    showLegend: true, legendPos: "b", showTitle: false, showValue: false,
    showCatName: false, showSerName: false, showLabel: false, showBorder: false,
  });
  slide.addText(narrativeText(balanceSheet, includedSections, currentLabel, priorLabel), {
    x: 6.51, y: 0.91, w: 6.42, h: 5.67,
    fontFace: "Aptos", fontSize: 10, color: "000000", margin: 0.07,
    breakLine: false, fit: "shrink", valign: "top", paraSpaceAfter: 3,
  });
  slide.addText("All figures in " + displayUnit(balanceSheet) + ".", {
    x: 0.28, y: 4.33, w: 3, h: 0.18,
    fontFace: "Aptos", fontSize: 6, italic: true, color: "000000", margin: 0.1,
  });
  slide.addText("Key pointers on old balances:", {
    x: 0.28, y: 4.66, w: 5.97, h: 0.2,
    fontFace: "Aptos", fontSize: 8.5, bold: true, color: "000000", margin: 0.1,
  });
  slide.addText(oldBalancePointers(balanceSheet, includedSections), {
    x: 0.28, y: 4.86, w: 5.97, h: 1.98,
    fontFace: "Aptos", fontSize: 8.5, color: "000000", margin: 0.1,
    breakLine: false, fit: "shrink", valign: "top", paraSpaceAfter: 3,
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
  const periodLabel = compactPeriodLabel(balanceSheet.periodLabel);
  addSectionSlide(pptx, report, balanceSheet, "assets", `Balance Sheet – Assets as of ${periodLabel}`);
  addSectionSlide(pptx, report, balanceSheet, "liabilities", `Balance Sheet – Liabilities as of ${periodLabel}`);
  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}