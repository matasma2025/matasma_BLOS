import PptxGenJS from "pptxgenjs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
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

function chartCategoryLabel(label: string) {
  const lines: string[] = [];
  for (const word of label.split(/\s+/)) {
    const last = lines.length - 1;
    if (last < 0 || lines[last].length + word.length + 1 > 22) {
      lines.push(word);
    } else {
      lines[last] += ` ${word}`;
    }
  }
  return lines.join("\n");
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
  const chartLabels = categories.map((item) => chartCategoryLabel(item.label));
  const chartValues = categories.map((item) => item.value / scaleFor(balanceSheet));
  const priorValues = categories.map((item) => item.previousValue / scaleFor(balanceSheet));
  const maxChartValue = Math.max(0, ...chartValues, ...priorValues);
  const sectionName = section === "assets" ? "ASSETS" : "LIABILITIES & EQUITY";
  const totalKey = section === "assets" ? "assets" : "liabilitiesAndEquity";
  const totalLabel = section === "assets" ? "Total Assets" : "Total Liabilities + Equity";
  const currentTotal = balanceSheet.totals[totalKey];
  const priorTotal = balanceSheet.comparisonTotals?.[totalKey] ?? null;
  const totalChange = priorTotal === null ? null : currentTotal - priorTotal;
  const totalChangePercent = priorTotal === null || priorTotal === 0
    ? null
    : (currentTotal - priorTotal) / Math.abs(priorTotal);
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
    [
      totalLabel,
      amount(currentTotal, balanceSheet),
      priorTotal === null ? "—" : amount(priorTotal, balanceSheet),
      totalChange === null ? "—" : signedAmount(totalChange, balanceSheet),
      percentage(totalChangePercent),
    ].map((text, index) => ({
      text,
      options: {
        bold: true, fill: { color: "EEF7F7" },
        align: index === 0 ? "left" as const : "right" as const,
      },
    })),
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
    x: 0.58, y: 0.46, w: 9.0, h: 0.42,
    fontFace: "Aptos Display", fontSize: 23, bold: true, color: "000000", margin: 0, fit: "shrink",
  });
  slide.addText(`${currentLabel} compared with ${priorLabel}  ·  Values in ${displayUnit(balanceSheet)}`, {
    x: 0.6, y: 0.91, w: 9.5, h: 0.16,
    fontFace: "Aptos", fontSize: 8.5, color: MUTED, margin: 0, fit: "shrink",
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 10.1, y: 0.28, w: 2.7, h: 0.95, rectRadius: 0.06,
    fill: { color: "FFFFFF" }, line: { color: CURRENT_COLOR, width: 1 },
  });
  slide.addText(`${totalLabel} (${displayUnit(balanceSheet)})`, {
    x: 10.23, y: 0.39, w: 2.44, h: 0.16,
    fontFace: "Aptos", fontSize: 8, bold: true, color: TEXT, margin: 0, fit: "shrink",
  });
  [
    { label: currentLabel, value: amount(currentTotal, balanceSheet), color: CURRENT_COLOR },
    { label: priorLabel, value: priorTotal === null ? "—" : amount(priorTotal, balanceSheet), color: PRIOR_COLOR },
  ].forEach((total, index) => {
    const x = 10.23 + index * 1.26;
    slide.addText(total.label, {
      x, y: 0.66, w: 1.18, h: 0.16, fontFace: "Aptos", fontSize: 8,
      bold: true, color: total.color, margin: 0, align: "center", fit: "shrink",
    });
    slide.addText(total.value, {
      x, y: 0.9, w: 1.18, h: 0.22, fontFace: "Aptos", fontSize: 12,
      bold: true, color: total.color, margin: 0, align: "center", fit: "shrink",
    });
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
    barDir: "col", catAxisLabelRotate: 0, catAxisLabelFontFace: "Aptos", catAxisLabelFontSize: 8,
    catAxisMajorTickMark: "none",
    catAxisLabelColor: TEXT, valAxisLabelFontFace: "Aptos", valAxisLabelFontSize: 8,
    valAxisHidden: true, valAxisLineShow: false,
    valAxisLabelColor: MUTED, valAxisLabelFormatCode: "#,##0",
    valAxisMaxVal: maxChartValue > 0 ? maxChartValue * 1.24 : 1,
    valGridLine: { style: "none" }, catGridLine: { style: "none" },
    chartColors: [CURRENT_COLOR, PRIOR_COLOR],
    showLegend: true, legendPos: "b", showTitle: false, showValue: true,
    // PptxGenJS filters outEnd for clustered columns; the postprocessor moves
    // these supported inEnd labels just above the bars after writing the file.
    dataLabelPosition: "inEnd", dataLabelColor: "222222", dataLabelFontFace: "Aptos",
    dataLabelFontSize: 7, dataLabelFormatCode: "#,##0",
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

function finalizeBalanceSheetPptx(pptxBytes: Buffer): Buffer {
  const files = unzipSync(pptxBytes);
  const chartPaths = Object.keys(files).filter((path) => /^ppt\/charts\/chart\d+\.xml$/.test(path));
  if (!chartPaths.length) throw new Error("Balance Sheet export did not contain chart XML.");

  for (const path of chartPaths) {
    const xml = strFromU8(files[path]);
    if (!/<c:showVal\b[^>]*val="1"/.test(xml)) {
      throw new Error(`Chart ${path} is missing visible value labels.`);
    }
    const positions = xml.match(/<c:dLblPos\b[^>]*\/>/g) ?? [];
    if (!positions.length) {
      throw new Error(`Chart ${path} is missing data-label positioning.`);
    }
    const aboveBarLabels = xml.replace(/<c:dLblPos\b[^>]*\/>/g, '<c:dLblPos val="outEnd"/>');
    // PptxGenJS treats a zero rotation as automatic. Force horizontal labels
    // explicitly so PowerPoint cannot rotate long category names on opening.
    files[path] = strToU8(aboveBarLabels.replace(
      /<c:catAx\b[^>]*>[\s\S]*?<\/c:catAx>/g,
      (axis) => axis.replace(/<a:bodyPr\b[^>]*\/>/, '<a:bodyPr rot="0"/>'),
    ));
  }

  // The generator's chart IDs can collide with text/shape IDs. Repair only
  // duplicate nonvisual IDs; chart relationships and visible content stay intact.
  for (const path of Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
    const xml = strFromU8(files[path]);
    const ids = Array.from(xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g), ([, id]) => Number(id));
    let nextId = Math.max(0, ...ids) + 1;
    const seen = new Set<number>();
    files[path] = strToU8(xml.replace(/<p:cNvPr\b[^>]*\bid="(\d+)"[^>]*\/?>/g, (tag, id) => {
      if (seen.has(Number(id))) return tag.replace(/\bid="\d+"/, `id="${nextId++}"`);
      seen.add(Number(id));
      return tag;
    }));
  }

  return Buffer.from(zipSync(files));
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
  const pptxBytes = Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
  return finalizeBalanceSheetPptx(pptxBytes);
}