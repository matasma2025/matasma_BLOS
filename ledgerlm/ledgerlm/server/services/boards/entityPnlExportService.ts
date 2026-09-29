import PptxGenJS from "pptxgenjs";
import { jsPDF } from "jspdf";

interface EntityPnlExportPayload {
  entity: string;
  asOf: string;
  comparison: "qoq" | "yoy";
  currency: "USD" | "INR";
  columns: string[];
  currentLabel: string;
  comparisonLabel: string;
  lines: Array<{
    label: string;
    values: Record<string, number | null>;
    variance: number | null;
    variancePercent: number | null;
  }>;
  evidence: string[];
  warnings: string[];
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
      line.variancePercent === null ? "—" : `${line.variancePercent.toFixed(1)}%`,
    ];
  });
}

function addPptxTable(slide: any, payload: EntityPnlExportPayload) {
  const headers = ["Line item", ...payload.columns, "Variance", "%"];
  const rows = [headers, ...exportRows(payload)];
  const columnCount = headers.length;
  const tableX = 0.42;
  const tableY = 1.14;
  const tableWidth = 12.25;
  const tableHeight = 5.68;
  const lineColumnWidth = 2.05;
  const remainingWidth = tableWidth - lineColumnWidth;
  const columnWidths = [
    lineColumnWidth,
    ...Array.from({ length: columnCount - 1 }, () => remainingWidth / (columnCount - 1)),
  ];
  const rowHeight = tableHeight / rows.length;
  const fontSize = columnCount > 7 ? 6 : 7;
  const padding = 0.035;

  // Use standard DrawingML shapes instead of a native PowerPoint table.
  // The native table opens in LibreOffice but is rejected by Microsoft PowerPoint.
  rows.forEach((row, rowIndex) => {
    let cellX = tableX;
    const cellY = tableY + rowIndex * rowHeight;

    row.forEach((cell, columnIndex) => {
      const cellWidth = columnWidths[columnIndex];
      slide.addShape("rect", {
        x: cellX,
        y: cellY,
        w: cellWidth,
        h: rowHeight,
        fill: { color: "FFFFFF" },
        line: { color: "D8DEE4", width: 0.4 },
      });
      slide.addText(String(cell ?? ""), {
        x: cellX + padding,
        y: cellY + padding,
        w: cellWidth - padding * 2,
        h: rowHeight - padding * 2,
        fontFace: "Aptos",
        fontSize,
        color: "1F2937",
        margin: 0,
        valign: "mid",
        align: "right",
      });
      cellX += cellWidth;
    });
  });
}

export async function exportEntityPnlPptx(report: EntityPnlExportReport): Promise<Buffer> {
  const payload = payloadFrom(report);
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
  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}

export function exportEntityPnlPdf(report: EntityPnlExportReport): Buffer {
  const payload = payloadFrom(report);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 9;
  const tableWidth = pageWidth - margin * 2;
  const headers = ["Line item", ...payload.columns, "Variance", "%"];
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
  return Buffer.from(doc.output("arraybuffer"));
}