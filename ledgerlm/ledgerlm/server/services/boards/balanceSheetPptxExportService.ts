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
const TEXT = "333333";
const MUTED = "666666";
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

function oldBalancePointers(
  balanceSheet: BalanceSheetReport,
  sections: ReportSection[],
) {
  const previous = balanceSheet.comparisonTotals;
  const leveragePointer = sections.includes("liabilities") && previous
    && previous.equity !== 0 && balanceSheet.totals.equity !== 0
    && previous.assets !== 0 && balanceSheet.totals.assets !== 0
    ? `• Debt/equity ${(
      balanceSheet.totals.debt / balanceSheet.totals.equity
    ).toFixed(2)} vs ${(previous.debt / previous.equity).toFixed(2)}; equity ratio ${(
      (balanceSheet.totals.equity / balanceSheet.totals.assets) * 100
    ).toFixed(1)}% vs ${((previous.equity / previous.assets) * 100).toFixed(1)}%.`
    : null;
  const candidates = categoryBreakdowns(balanceSheet)
    .filter((item) => sections.includes(item.section) && Math.abs(item.previousValue) > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, leveragePointer ? 1 : 2);
  if (!candidates.length && !leveragePointer) return "• Nothing flagged from the data — add from supporting schedules.";
  const currentLabel = compactPeriodLabel(balanceSheet.periodLabel);
  const categoryPointers = candidates.map((item) => {
    const share = balanceSheet.totals.assets === 0 ? null : (item.value / balanceSheet.totals.assets) * 100;
    return `• ${item.label}: ${amount(item.value, balanceSheet)} ${displayUnit(balanceSheet)} at ${currentLabel}${share === null ? "" : ` (${share.toFixed(1)}% of assets)`}; change ${signedAmount(item.change, balanceSheet)}.`;
  });
  return [leveragePointer, ...categoryPointers].filter((line): line is string => Boolean(line)).join("\n");
}

function largestAccountMovements(
  balanceSheet: BalanceSheetReport,
  sections: ReportSection[],
) {
  return balanceSheet.lineItems
    .filter((item) => sections.includes(item.section as ReportSection) && Math.abs(item.change) > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 2)
    .map((item) => {
      const accountName = item.accountName.length > 44
        ? `${item.accountName.slice(0, 41).trimEnd()}…`
        : item.accountName;
      return `• ${item.category}: ${accountName} · ${signedAmount(item.change, balanceSheet)} ${displayUnit(balanceSheet)} (${percentage(item.changePercent)}).`;
    });
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
  const maxChartValue = Math.max(0, ...chartValues, ...priorValues);
  const sectionName = section === "assets" ? "ASSETS" : "LIABILITIES & EQUITY";
  const tableRows = [
    ["Category", currentLabel, priorLabel, "Change", "Change %"].map((text, index) => ({
      text,
      options: {
        bold: true,
        color: "FFFFFF",
        fill: { color: CURRENT_COLOR },
        align: index === 0 ? "left" as const : "right" as const,
      },
    })),
    ...categories.map((item) => [
      { text: item.label, options: { align: "left" as const } },
      { text: amount(item.value, balanceSheet), options: { align: "right" as const } },
      { text: amount(item.previousValue, balanceSheet), options: { align: "right" as const } },
      { text: signedAmount(item.change, balanceSheet), options: { align: "right" as const } },
      { text: percentage(item.changePercent), options: { align: "right" as const } },
    ]),
  ];
  const tableRowHeight = Math.min(0.245, 1.84 / tableRows.length);
  const attentionItems = oldBalancePointers(balanceSheet, includedSections);
  const movementItems = largestAccountMovements(balanceSheet, includedSections);

  slide.background = { color: "FFFFFF" };
  slide.addText(`BALANCE SHEET  /  ${sectionName}`, {
    x: 0.58, y: 0.2, w: 7.8, h: 0.16,
    fontFace: "Aptos", fontSize: 8, bold: true, charSpacing: 1.25, color: CURRENT_COLOR, margin: 0,
  });
  slide.addText(title, {
    x: 0.58, y: 0.46, w: 10.8, h: 0.42,
    fontFace: "Aptos Display", fontSize: 23, bold: true, color: "000000", margin: 0, fit: "shrink",
  });
  slide.addText(`${currentLabel} compared with ${priorLabel}  ·  Values in ${displayUnit(balanceSheet)}`, {
    x: 0.6, y: 0.91, w: 9.5, h: 0.16,
    fontFace: "Aptos", fontSize: 8.5, color: MUTED, margin: 0, fit: "shrink",
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.52, y: 1.42, w: 12.29, h: 3.16, rectRadius: 0.06,
    fill: { color: "FFFFFF" }, line: { color: "E1E8EF", width: 0.8 },
  });
  slide.addChart(pptx.ChartType.bar, [
    { name: currentLabel, labels: chartLabels, values: chartValues },
    { name: priorLabel, labels: chartLabels, values: priorValues },
  ], {
    x: 0.62, y: 1.48, w: 12.08, h: 3.02,
    barDir: "col", catAxisLabelRotate: -28, catAxisLabelFontFace: "Aptos", catAxisLabelFontSize: 8,
    catAxisLabelColor: TEXT, valAxisLabelFontFace: "Aptos", valAxisLabelFontSize: 8,
    valAxisLabelColor: MUTED, valAxisLabelFormatCode: "#,##0",
    valAxisMaxVal: maxChartValue > 0 ? maxChartValue * 1.18 : 1,
    valGridLine: { color: "D9E1E2" }, chartColors: [CURRENT_COLOR, PRIOR_COLOR],
    showLegend: true, legendPos: "b", showTitle: false, showValue: false,
    showSerName: false, showLabel: false,
  });

  slide.addText("CATEGORY COMPARISON", {
    x: 0.62, y: 4.75, w: 4.1, h: 0.15,
    fontFace: "Aptos", fontSize: 8, bold: true, charSpacing: 0.7, color: MUTED, margin: 0,
  });
  slide.addTable(tableRows as any, {
    x: 0.58, y: 4.96, w: 7.57, h: tableRowHeight * tableRows.length,
    colW: [2.55, 1.18, 1.18, 1.48, 1.18],
    fontFace: "Aptos", fontSize: categories.length > 8 ? 7.2 : 8.2,
    color: TEXT, border: { type: "solid", color: "DCE4EC", pt: 0.45 },
    margin: 0.04, valign: "middle", rowH: tableRowHeight,
    autoPage: false,
    fill: { color: "FFFFFF" }, align: "right",
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.4, y: 4.75, w: 4.4, h: 2.06, rectRadius: 0.06,
    fill: { color: "FFFFFF" }, line: { color: "E1E8EF", width: 0.8 },
  });
  slide.addText("MANAGEMENT ATTENTION", {
    x: 8.62, y: 4.94, w: 3.95, h: 0.15,
    fontFace: "Aptos", fontSize: 8, bold: true, charSpacing: 0.7, color: MUTED, margin: 0,
  });
  slide.addText("Old-balance checks", {
    x: 8.62, y: 5.17, w: 3.95, h: 0.17,
    fontFace: "Aptos", fontSize: 9, bold: true, color: TEXT, margin: 0,
  });
  slide.addText(attentionItems || "• No material old-balance items flagged.", {
    x: 8.62, y: 5.39, w: 3.95, h: 0.53,
    fontFace: "Aptos", fontSize: 8, color: TEXT, margin: 0,
    fit: "shrink", valign: "top",
  });
  slide.addText("Largest account movements", {
    x: 8.62, y: 5.99, w: 3.95, h: 0.17,
    fontFace: "Aptos", fontSize: 9, bold: true, color: TEXT, margin: 0,
  });
  slide.addText(movementItems.length ? movementItems.join("\n") : "• No material account movements.", {
    x: 8.62, y: 6.21, w: 3.95, h: 0.46,
    fontFace: "Aptos", fontSize: 8, color: TEXT, margin: 0,
    fit: "shrink", valign: "top",
  });
  slide.addText(`Source: ${report.sourceSnapshot?.name ?? "Dedicated Balance Sheet cube"} · comparison uses the latest earlier loaded period`, {
    x: 0.58, y: 7.12, w: 12.2, h: 0.14,
    fontFace: "Aptos", fontSize: 7, color: MUTED, margin: 0, align: "right", fit: "shrink",
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