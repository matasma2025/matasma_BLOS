import PptxGenJS from "pptxgenjs";
import { jsPDF } from "jspdf";
import { renderEntityPnlTemplate, validateAndNormalizePptx } from "./entityPnlPptxTemplate";
import type { EntityPnlPlanningForecast, EntityPnlForecastComparison, EntityPnlFinancialPlanSource } from "../../../shared/entityPnlPlanning";
import { appendSupplementSlide, supplementalRows, supplementNotes } from "./entityPnlSupplementExport";

export interface EntityPnlExportPayload {
  entity: string;
  asOf: string;
  comparison: "qoq" | "yoy";
  currency: "USD" | "INR";
  columns: string[];
  currentLabel: string;
  comparisonLabel: string;
  forecastLabel?: string;
  yearEndLabel?: string;
  lines: Array<{
    label: string;
    values: Record<string, number | null>;
    variance: number | null;
    variancePercent: number | null;
  }>;
  evidence: string[];
  warnings: string[];
  planningForecast?: EntityPnlPlanningForecast;
  forecastComparison?: EntityPnlForecastComparison;
  financialPlanSource?: EntityPnlFinancialPlanSource;
  expenseReconciliation?: Array<{ period: string; amount: number | null }>;
}

interface EntityPnlExportReport {
  title: string;
  periodLabel?: string | null;
  sourceSnapshot?: { name?: string; sourceType?: string } | null;
  result?: {
    summary?: string;
    insights?: string[];
    commentary?: Array<{ label: string; text: string }>;
    entityPnl?: EntityPnlExportPayload;
  } | null;
}

const PptxConstructor = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS);
const MONEY_LINES = new Set([
  "Revenue",
  "Employee Benefits",
  "Outsourcing Cost",
  "Consultancy Charges",
  "CI Charges & Other Revenue",
  "Facilities Cost",
  "Other Expenses",
  "Total Expenses",
  "EBIT",
]);

function payloadFrom(report: EntityPnlExportReport) {
  const payload = report.result?.entityPnl;
  if (!payload) throw new Error("This report does not contain Entity P&L data");
  return payload;
}

function valueText(label: string, value: number | null | undefined, currency: "USD" | "INR") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (label === "EBIT%") return `${value.toFixed(1)}%`;
  if (MONEY_LINES.has(label)) {
    const symbol = currency === "USD" ? "$" : "₹";
    return `${symbol}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function exportRows(payload: EntityPnlExportPayload) {
  return payload.lines.map((line) => {
    const variance = line.variance === null
      ? "—"
      : line.label === "EBIT%"
        ? `${line.variance.toFixed(1)} pp`
        : valueText(line.label, line.variance, payload.currency);
    return [
      line.label,
      ...payload.columns.map((column) => valueText(line.label, line.values[column], payload.currency)),
      variance,
      line.label === "EBIT%" || line.variancePercent === null ? "—" : `${line.variancePercent.toFixed(1)}%`,
    ];
  });
}

function addPptxTable(slide: any, payload: EntityPnlExportPayload) {
  const headers = ["Line item", ...payload.columns, `${payload.comparison.toUpperCase()} variance`, `${payload.comparison.toUpperCase()} %`];
  const rows = [headers, ...exportRows(payload)];
  const columnCount = headers.length;
  const lineColumnWidth = 2.05;
  const remainingWidth = 12.25 - lineColumnWidth;
  const columnWidths = [lineColumnWidth, ...Array.from({ length: columnCount - 1 }, () => remainingWidth / (columnCount - 1))];
  slide.addTable(rows, {
    x: 0.42,
    y: 1.14,
    w: 12.25,
    h: 5.68,
    colW: columnWidths,
    fontFace: "Aptos",
    fontSize: columnCount > 7 ? 6 : 7,
    color: "1F2937",
    border: { type: "solid", color: "D8DEE4", pt: 0.4 },
    margin: 0.035,
    autoFit: false,
    valign: "mid",
    breakLine: false,
    fill: "FFFFFF",
    bold: false,
    paraSpaceAfterPt: 0,
    rowH: 0.31,
    showHeader: true,
    autoPage: false,
    headerRows: 1,
    align: "right",
  });
}

export async function exportEntityPnlPptx(report: EntityPnlExportReport, templateBytesBase64?: string): Promise<Buffer> {
  const payload = payloadFrom(report);
  const supplement = supplementalRows(payload);
  const notes = supplementNotes(payload);
  const sourceCaption = payload.financialPlanSource
    ? `${payload.financialPlanSource.scenario} · ${payload.entity} · source mINR · confirmed YTD · display ${payload.currency}`
    : `${payload.planningForecast?.scenario ?? "Actual"} · ${payload.asOf} snapshot · Planning budgets shown in mUSD`;
  const pages = Array.from({ length: Math.ceil(supplement.length / 12) }, (_, index) => supplement.slice(index * 12, index * 12 + 12));
  const addSupplement = (deck: InstanceType<typeof PptxConstructor>, rows: string[][], page: number) => {
    const slide = deck.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(`Planning, CF comparisons and reconciliation — ${payload.entity} (${page + 1}/${pages.length})`, {
      x: 0.42, y: 0.3, w: 12.2, h: 0.5, fontSize: 20, bold: true, color: "143B45", margin: 0,
    });
    slide.addText(sourceCaption, {
      x: 0.42, y: 0.86, w: 12.2, h: 0.3, fontSize: 10, color: "58666B", margin: 0,
    });
    slide.addTable([["Source measure", "Value (comparison: Actual / CF / delta)", "Unit", "Availability"], ...rows].map((row) => row.map((text) => ({ text }))), {
      x: 0.42, y: 1.3, w: 12.2, colW: [4.2, 3.7, 1.1, 3.2], fontSize: 8,
      rowH: 0.3, margin: 0.035, border: { type: "solid", color: "D8DEE4", pt: 0.4 },
      autoPage: false, color: "1F2937",
    });
    slide.addText(notes.join("\n"), {
      x: 0.42, y: 5.8, w: 12.2, h: 1.2, fontSize: 9, color: "58666B", margin: 0, fit: "shrink",
    });
  };
  if (templateBytesBase64) {
    let template = renderEntityPnlTemplate(templateBytesBase64, payload);
    if (!supplement.length) return template;
    for (let page = 0; page < pages.length; page++) {
      const rows = pages[page];
      const extra = new PptxConstructor();
      extra.layout = "LAYOUT_WIDE";
      addSupplement(extra, rows, page);
      const buffer = await extra.write({ outputType: "nodebuffer" });
      template = appendSupplementSlide(template, Buffer.from(buffer as Uint8Array));
    }
    return validateAndNormalizePptx(template);
  }
  const pptx = new PptxConstructor();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "LedgerLM";
  pptx.company = "LedgerLM";
  pptx.subject = "Entity P&L standalone analysis";
  pptx.title = report.title;

  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText(`Entity P&L – ${payload.entity}`, {
    x: 0.42, y: 0.28, w: 12.2, h: 0.42,
    fontFace: "Aptos Display", fontSize: 24, bold: true, color: "143B45", margin: 0,
  });
  slide.addText(`${payload.currentLabel} · ${payload.comparison.toUpperCase()} versus ${payload.comparisonLabel} · Values in ${payload.currency}`, {
    x: 0.43, y: 0.78, w: 12.2, h: 0.21,
    fontFace: "Aptos", fontSize: 9, color: "58666B", margin: 0,
  });
  addPptxTable(slide, payload);
  const noteLines = [
    ...(payload.warnings ?? []),
    ...(payload.evidence ?? []),
  ].slice(0, 3);
  slide.addText(noteLines.join("  ·  "), {
    x: 0.42, y: 6.93, w: 12.1, h: 0.28,
    fontFace: "Aptos", fontSize: 6.4, color: "667085", margin: 0, fit: "shrink",
  });
  pages.forEach((rows, page) => addSupplement(pptx, rows, page));
  const output = await pptx.write({ outputType: "nodebuffer" });
  return validateAndNormalizePptx(Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array));
}

export function exportEntityPnlPdf(report: EntityPnlExportReport): Buffer {
  const payload = payloadFrom(report);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 9;
  const tableWidth = pageWidth - margin * 2;
  const headers = ["Line item", ...payload.columns, `${payload.comparison.toUpperCase()} variance`, `${payload.comparison.toUpperCase()} %`];
  const widths = [42, ...Array.from({ length: headers.length - 1 }, () => (tableWidth - 42) / (headers.length - 1))];
  const rowHeight = 7.1;
  const tableTop = 35;
  const lines = exportRows(payload);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 59, 69);
  doc.text(`Entity P&L – ${payload.entity}`, margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(85, 98, 104);
  doc.text(`${payload.currentLabel} · ${payload.comparison.toUpperCase()} versus ${payload.comparisonLabel} · Values in ${payload.currency}`, margin, 21);
  if (report.result?.summary) {
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(report.result.summary, tableWidth), margin, 27);
  }

  let x = margin;
  doc.setFillColor(38, 111, 116);
  doc.setDrawColor(214, 222, 225);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  headers.forEach((header, index) => {
    doc.rect(x, tableTop, widths[index], rowHeight, "FD");
    const alignment = index === 0 ? "left" : "right";
    doc.text(header, alignment === "left" ? x + 1.5 : x + widths[index] - 1.5, tableTop + 4.7, { align: alignment, maxWidth: widths[index] - 3 });
    x += widths[index];
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  lines.forEach((row, rowIndex) => {
    const y = tableTop + rowHeight * (rowIndex + 1);
    const lineLabel = String(row[0]);
    const subtotal = ["Total Expenses", "EBIT", "Total End", "Total Average"].includes(lineLabel);
    doc.setFillColor(...(subtotal ? [239, 244, 244] as [number, number, number] : [255, 255, 255] as [number, number, number]));
    doc.setTextColor(31, 41, 55);
    x = margin;
    row.forEach((cell, index) => {
      doc.rect(x, y, widths[index], rowHeight, "FD");
      if (subtotal && index === 0) doc.setFont("helvetica", "bold");
      const text = String(cell ?? "—");
      const alignment = index === 0 ? "left" : "right";
      doc.text(text, alignment === "left" ? x + 1.5 : x + widths[index] - 1.5, y + 4.7, { align: alignment, maxWidth: widths[index] - 3 });
      if (subtotal && index === 0) doc.setFont("helvetica", "normal");
      x += widths[index];
    });
  });

  const footerY = tableTop + rowHeight * (lines.length + 1) + 4;
  const footnotes = [...(payload.warnings ?? []), ...(payload.evidence ?? [])].slice(0, 3);
  doc.setFontSize(6);
  doc.setTextColor(102, 112, 133);
  doc.text(doc.splitTextToSize(footnotes.join(" · "), tableWidth).slice(0, 2), margin, Math.min(footerY, 202));
  const supplement = supplementalRows(payload);
  const pages = Array.from({ length: Math.ceil(supplement.length / 12) }, (_, index) => supplement.slice(index * 12, index * 12 + 12));
  for (let page = 0; page < pages.length; page++) {
    const rows = pages[page];
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Planning, CF comparisons and reconciliation — ${payload.entity} (${page + 1}/${pages.length})`, margin, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(payload.financialPlanSource
      ? `${payload.financialPlanSource.scenario} · ${payload.entity} · source mINR · confirmed YTD · display ${payload.currency}`
      : `${payload.planningForecast?.scenario ?? "Actual"} · ${payload.asOf} snapshot · Planning budgets in mUSD`, margin, 24);
    const supplementaryWidths = [90, 80, 25, tableWidth - 195];
    [["Source measure", "Value (Actual / CF / delta)", "Unit", "Availability"], ...rows].forEach((row, rowIndex) => {
      let x = margin;
      const y = 32 + rowIndex * 10;
      doc.setFontSize(8);
      row.forEach((cell, column) => {
        doc.rect(x, y, supplementaryWidths[column], 10);
        doc.text(doc.splitTextToSize(cell, supplementaryWidths[column] - 4).slice(0, 2), x + 2, y + 4, { maxWidth: supplementaryWidths[column] - 4 });
        x += supplementaryWidths[column];
      });
    });
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(supplementNotes(payload).join("\n"), tableWidth), margin, 32 + (rows.length + 1) * 10 + 8);
  }
  return Buffer.from(doc.output("arraybuffer"));
}