import PptxGenJS from "pptxgenjs";
import { jsPDF } from "jspdf";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

interface EntityPnlExportPayload {
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
  sourceRowCount?: number;
  forecastSourceRowCount?: number;
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

const BOSCH_TEMPLATE_LINE_MAP: Array<{ label: string; sourceLabel: string }> = [
  { label: "Revenue", sourceLabel: "Revenue" },
  { label: "Employee Benefits", sourceLabel: "Employee Benefits" },
  { label: "Outsourcing Cost", sourceLabel: "Outsourcing Cost" },
  { label: "Consultancy Charges", sourceLabel: "Consultancy Charges" },
  { label: "CI Charges & Other Revenue", sourceLabel: "CI Charges & Other Revenue" },
  { label: "Facilities Cost", sourceLabel: "Facilities Cost" },
  { label: "Other Expenses", sourceLabel: "Other Expenses" },
  { label: "Total Expenses", sourceLabel: "Total Expenses" },
  { label: "EBIT", sourceLabel: "EBIT" },
  { label: "EBIT% of TNS", sourceLabel: "EBIT%" },
  { label: "End capacity onroll", sourceLabel: "End Capacity On-roll" },
  { label: "End capacity outsourcing", sourceLabel: "End Capacity Outsourcing" },
  { label: "Total End", sourceLabel: "Total End" },
  { label: "Avg Capacity onroll", sourceLabel: "Avg Capacity On-roll" },
  { label: "Avg Capacity outsourcing", sourceLabel: "Avg Capacity Outsourcing" },
  { label: "Total Average", sourceLabel: "Total Average" },
];

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS_FULL.map((month) => month.slice(0, 3));

function decodeXmlText(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shapeText(shapeXml: string): string {
  return Array.from(shapeXml.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g), (match) => decodeXmlText(match[1]))
    .join(" ");
}

function replaceTextNodes(xml: string, text: string): string {
  let textNodeCount = 0;
  const updated = xml.replace(/<a:t\b([^>]*)>[\s\S]*?<\/a:t>/g, (_match, attributes: string) => {
    const replacement = textNodeCount++ === 0 ? escapeXmlText(text) : "";
    return `<a:t${attributes}>${replacement}</a:t>`;
  });
  if (!textNodeCount) throw new Error("Bosch PowerPoint template contains a text box without editable text.");
  return updated;
}

function replaceShapeTextXml(shapeXml: string, text: string): string {
  let foundTextBody = false;
  const updated = shapeXml.replace(/<p:txBody\b[\s\S]*?<\/p:txBody>/, (textBody) => {
    foundTextBody = true;
    let paragraphIndex = 0;
    return textBody.replace(/<a:p\b[\s\S]*?<\/a:p>/g, (paragraphXml) => {
      if (paragraphIndex++ > 0) return "";
      return replaceTextNodes(paragraphXml, text);
    });
  });
  if (!foundTextBody) throw new Error("Bosch PowerPoint template text box is missing its text body.");
  return updated;
}

function replaceShapeText(
  slideXml: string,
  matches: (text: string) => boolean,
  replacement: string,
  description: string,
): string {
  let matchCount = 0;
  const updated = slideXml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, (shapeXml) => {
    if (!matches(shapeText(shapeXml))) return shapeXml;
    matchCount += 1;
    return replaceShapeTextXml(shapeXml, replacement);
  });
  if (matchCount !== 1) {
    throw new Error(`Bosch PowerPoint template must contain exactly one ${description} text box; found ${matchCount}.`);
  }
  return updated;
}

function replaceTemplateTokens(slideXml: string, tokens: Record<string, string>): string {
  return slideXml.replace(/<a:t\b([^>]*)>([\s\S]*?)<\/a:t>/g, (_match, attributes: string, content: string) => {
    let text = decodeXmlText(content);
    for (const [token, value] of Object.entries(tokens)) text = text.replaceAll(token, value);
    return `<a:t${attributes}>${escapeXmlText(text)}</a:t>`;
  });
}

function findPeriod(label: string): { month: number; year: number } | undefined {
  const match = /^([A-Za-z]{3})\s+(\d{4})\b/.exec(label);
  if (!match) return undefined;
  const month = MONTHS_SHORT.findIndex((name) => name.toLowerCase() === match[1].toLowerCase()) + 1;
  return month > 0 ? { month, year: Number(match[2]) } : undefined;
}

function titlePeriod(label: string): string {
  const period = findPeriod(label);
  if (!period) return label;
  return `${MONTHS_FULL[period.month - 1]}'${String(period.year).slice(-2)}`;
}

function tablePeriod(label: string, comparison: "qoq" | "yoy", prior: boolean): string {
  const period = findPeriod(label);
  if (!period) return label;
  const shortYear = String(period.year).slice(-2);
  if (comparison === "yoy") return `YTD${String(period.month).padStart(2, "0")}'${shortYear}`;
  const monthName = prior ? MONTHS_SHORT[period.month - 1] : MONTHS_FULL[period.month - 1];
  return `${monthName}'${shortYear}`;
}

function templateTitle(payload: EntityPnlExportPayload): string {
  const current = findPeriod(payload.currentLabel);
  const prior = findPeriod(payload.comparisonLabel);
  if (!current || !prior) throw new Error("Entity P&L period labels are not valid for the Bosch PowerPoint template.");
  const shortYear = String(current.year).slice(-2);
  const periodPrefix = payload.comparison === "qoq"
    ? `Q${Math.floor((current.month - 1) / 3) + 1}`
    : current.month === 6
      ? "H1"
      : current.month === 12
        ? "FY"
        : "YTD";
  return `P&L ${periodPrefix}'${shortYear} – ${payload.comparison.toUpperCase()} : ${titlePeriod(payload.currentLabel)} v ${titlePeriod(payload.comparisonLabel)}`;
}

function formatBoschHeader(label: string | undefined, kind: "yearEnd" | "forecast"): string {
  if (!label) return kind === "yearEnd" ? "Year-end" : "Forecast";
  if (kind === "yearEnd") {
    const year = /\b(20\d{2})\b/.exec(label)?.[1];
    return year ? `YE ${year}` : "Year-end";
  }
  const scenario = /\b(CF\d{2})[\s.]+(20\d{2})\b/i.exec(label);
  return scenario ? `${scenario[1].toUpperCase()}.${scenario[2]}` : label.replace(/\s+(YTD|MTD)$/i, "");
}

function lineForBoschTemplate(payload: EntityPnlExportPayload, sourceLabel: string) {
  const directLine = payload.lines.find((line) => line.label === sourceLabel);
  if (directLine || sourceLabel !== "Avg Capacity On-roll") return directLine;

  // Older saved reports expose only overall and outsourcing averages. Their
  // difference is the on-roll average; use it rather than mislabeling totals.
  const overall = payload.lines.find((line) => line.label === "Avg Capacity Overall");
  const outsourcing = payload.lines.find((line) => line.label === "Avg Capacity Outsourcing");
  if (!overall || !outsourcing) return undefined;
  const labels = new Set([...Object.keys(overall.values), ...Object.keys(outsourcing.values)]);
  const values = Object.fromEntries(Array.from(labels, (label) => {
    const total = overall.values[label];
    const outsourced = outsourcing.values[label];
    return [label, total === null || total === undefined || outsourced === null || outsourced === undefined
      ? null
      : total - outsourced];
  }));
  const current = values[payload.currentLabel] ?? null;
  const prior = values[payload.comparisonLabel] ?? null;
  const variance = current === null || prior === null ? null : current - prior;
  return {
    label: sourceLabel,
    values,
    variance,
    variancePercent: variance === null || prior === 0 ? null : (variance / Math.abs(prior)) * 100,
  };
}

function formatBoschValue(label: string, value: number | null | undefined, currency: "USD" | "INR"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (label === "EBIT%") return `${value.toFixed(1)}%`;
  if (MONEY_LINES.has(label)) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value / 1_000_000);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function boschLineRows(payload: EntityPnlExportPayload) {
  const yearEndLabel = payload.yearEndLabel ?? payload.columns.find((label) => /\bYE\b/i.test(label));
  const forecastLabel = payload.forecastLabel
    ?? payload.columns.find((label) => label !== payload.currentLabel && label !== payload.comparisonLabel && label !== yearEndLabel);
  const currentHeader = tablePeriod(payload.currentLabel, payload.comparison, false);
  const priorHeader = tablePeriod(payload.comparisonLabel, payload.comparison, true);
  const rows: string[][] = [[
    payload.entity,
    formatBoschHeader(yearEndLabel, "yearEnd"),
    formatBoschHeader(forecastLabel, "forecast"),
    currentHeader,
    priorHeader,
    "Variance",
    "%",
  ]];

  for (const item of BOSCH_TEMPLATE_LINE_MAP) {
    const line = lineForBoschTemplate(payload, item.sourceLabel);
    const valueAt = (label: string | undefined) => label && line ? line.values[label] : null;
    const variance = line?.variance ?? null;
    const varianceText = variance === null
      ? "—"
      : item.sourceLabel === "EBIT%"
        ? `${variance.toFixed(1)}%`
        : formatBoschValue(item.sourceLabel, variance, payload.currency);
    rows.push([
      item.label,
      formatBoschValue(item.sourceLabel, valueAt(yearEndLabel), payload.currency),
      formatBoschValue(item.sourceLabel, valueAt(forecastLabel), payload.currency),
      formatBoschValue(item.sourceLabel, valueAt(payload.currentLabel), payload.currency),
      formatBoschValue(item.sourceLabel, valueAt(payload.comparisonLabel), payload.currency),
      varianceText,
      line?.variancePercent === null || line?.variancePercent === undefined
        ? "—"
        : `${line.variancePercent.toFixed(1)}%`,
    ]);
  }
  return rows;
}

function narrativeForLine(payload: EntityPnlExportPayload, sourceLabel: string): string {
  const line = lineForBoschTemplate(payload, sourceLabel);
  const current = line?.values[payload.currentLabel];
  const prior = line?.values[payload.comparisonLabel];
  if (!line || current === null || current === undefined || prior === null || prior === undefined) {
    return "Comparison unavailable because one or more source snapshots are missing.";
  }
  const unit = `m${payload.currency}`;
  const currentText = MONEY_LINES.has(sourceLabel)
    ? `${formatBoschValue(sourceLabel, current, payload.currency)} ${unit}`
    : formatBoschValue(sourceLabel, current, payload.currency);
  const variance = line.variance;
  const varianceText = variance === null
    ? "variance unavailable"
    : `${variance >= 0 ? "+" : "−"}${formatBoschValue(sourceLabel, Math.abs(variance), payload.currency)}${MONEY_LINES.has(sourceLabel) ? ` ${unit}` : ""}`;
  const percentText = line.variancePercent === null ? "" : ` (${line.variancePercent.toFixed(1)}%)`;
  return `${currentText}; variance ${varianceText}${percentText} vs ${tablePeriod(payload.comparisonLabel, payload.comparison, true)}.`;
}

function replaceTemplateTable(slideXml: string, rows: string[][]): string {
  const tables = Array.from(slideXml.matchAll(/<a:tbl\b[\s\S]*?<\/a:tbl>/g));
  if (tables.length !== 1) {
    throw new Error(`Bosch PowerPoint template must contain exactly one table; found ${tables.length}.`);
  }
  const tableXml = tables[0][0];
  const tableRows = Array.from(tableXml.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g));
  if (tableRows.length !== rows.length) {
    throw new Error(`Bosch PowerPoint table needs ${rows.length} rows; found ${tableRows.length}.`);
  }
  let rowIndex = 0;
  const updatedTable = tableXml.replace(/<a:tr\b[\s\S]*?<\/a:tr>/g, (rowXml) => {
    const expectedCells = rows[rowIndex];
    let cellIndex = 0;
    const updatedRow = rowXml.replace(/<a:tc\b[\s\S]*?<\/a:tc>/g, (cellXml) => {
      const value = expectedCells[cellIndex];
      cellIndex += 1;
      return replaceTextNodes(cellXml, value ?? "");
    });
    if (cellIndex !== 7) {
      throw new Error(`Bosch PowerPoint table row ${rowIndex + 1} needs 7 columns; found ${cellIndex}.`);
    }
    rowIndex += 1;
    return updatedRow;
  });
  return slideXml.replace(tableXml, updatedTable);
}

function keepOnlyTemplateSlide(files: Record<string, Uint8Array>, slideNames: string[], selectedSlide: string): void {
  if (slideNames.length <= 1) return;
  const selectedNumber = selectedSlide.match(/slide(\d+)\.xml$/i)?.[1];
  if (!selectedNumber) throw new Error("The selected Bosch PowerPoint slide has an invalid name.");

  const presentationRelsPath = "ppt/_rels/presentation.xml.rels";
  const presentationPath = "ppt/presentation.xml";
  const relsXml = files[presentationRelsPath] ? strFromU8(files[presentationRelsPath]) : "";
  const relationships = Array.from(relsXml.matchAll(/<Relationship\b[^>]*\/>/g), (match) => match[0]);
  const slideRelationship = relationships.find((relationship) =>
    new RegExp(`Target="slides/slide${selectedNumber}\\.xml"`).test(relationship));
  const relationshipId = slideRelationship?.match(/\bId="([^"]+)"/)?.[1];
  if (!relationshipId || !files[presentationPath]) {
    throw new Error("The selected Bosch PowerPoint slide is not linked from the presentation.");
  }

  const presentationXml = strFromU8(files[presentationPath]);
  const slideListPattern = /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/;
  const slideList = presentationXml.match(slideListPattern)?.[0];
  const selectedSlideId = slideList
    ? Array.from(slideList.matchAll(/<p:sldId\b[^>]*\/>/g), (match) => match[0])
      .find((entry) => new RegExp(`r:id="${relationshipId}"`).test(entry))
    : undefined;
  if (!slideList || !selectedSlideId) throw new Error("The selected Bosch PowerPoint slide is missing from the slide list.");

  files[presentationPath] = strToU8(presentationXml.replace(slideList, `<p:sldIdLst>${selectedSlideId}</p:sldIdLst>`));
  files[presentationRelsPath] = strToU8(relsXml.replace(
    /<Relationship\b[^>]*Target="slides\/slide\d+\.xml"[^>]*\/>/g,
    (relationship) => relationship === slideRelationship ? relationship : "",
  ));
  const contentTypesPath = "[Content_Types].xml";
  if (files[contentTypesPath]) {
    files[contentTypesPath] = strToU8(strFromU8(files[contentTypesPath]).replace(
      /<Override\b[^>]*PartName="\/ppt\/slides\/slide(\d+)\.xml"[^>]*\/>/g,
      (override, slideNumber: string) => slideNumber === selectedNumber ? override : "",
    ));
  }
  for (const slideName of slideNames) {
    if (slideName === selectedSlide) continue;
    const slideNumber = slideName.match(/slide(\d+)\.xml$/i)?.[1];
    delete files[slideName];
    if (slideNumber) {
      delete files[`ppt/slides/_rels/slide${slideNumber}.xml.rels`];
      delete files[`ppt/notesSlides/notesSlide${slideNumber}.xml`];
      delete files[`ppt/notesSlides/_rels/notesSlide${slideNumber}.xml.rels`];
    }
  }
  const appPropertiesPath = "docProps/app.xml";
  if (files[appPropertiesPath]) {
    files[appPropertiesPath] = strToU8(strFromU8(files[appPropertiesPath]).replace(/<Slides>\d+<\/Slides>/, "<Slides>1</Slides>"));
  }
}

function renderBoschTemplate(report: EntityPnlExportReport, payload: EntityPnlExportPayload, templateBase64: string): Buffer {
  const files = unzipSync(new Uint8Array(Buffer.from(templateBase64, "base64")));
  const slideNames = Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => Number(left.match(/slide(\d+)/i)?.[1]) - Number(right.match(/slide(\d+)/i)?.[1]));
  if (!slideNames.length) throw new Error("The uploaded PowerPoint template does not contain a slide.");

  const modePattern = payload.comparison === "yoy" ? /\byoy\b/i : /\bqoq\b/i;
  const selectedSlide = slideNames.find((name) => modePattern.test(shapeText(strFromU8(files[name])))) ?? slideNames[0];
  keepOnlyTemplateSlide(files, slideNames, selectedSlide);

  let slideXml = strFromU8(files[selectedSlide]);
  const rows = boschLineRows(payload);
  slideXml = replaceTemplateTable(slideXml, rows);
  slideXml = replaceShapeText(slideXml, (text) => text.startsWith("P&L "), templateTitle(payload), "report title");
  slideXml = replaceShapeText(slideXml, (text) => text.includes("Revenue: Driven by the below key factors"), "Key movements from the selected comparison", "highlights heading");
  const narrativeBindings = [
    { marker: "Rate increase +1%", sourceLabel: "Revenue" },
    { marker: "Employee benefit increase is primarily", sourceLabel: "Employee Benefits" },
    { marker: "Higher by +15% due YOY", sourceLabel: "Outsourcing Cost" },
    { marker: "Higher by +658mINR", sourceLabel: "Consultancy Charges" },
    { marker: "Largely on account of price increase", sourceLabel: "CI Charges & Other Revenue" },
    { marker: "Reduction in cost is on account of recovery", sourceLabel: "Facilities Cost" },
    { marker: "Reduction is due to customer claim reversal", sourceLabel: "Other Expenses" },
  ];
  for (const binding of narrativeBindings) {
    slideXml = replaceShapeText(
      slideXml,
      (text) => text.includes(binding.marker),
      narrativeForLine(payload, binding.sourceLabel),
      `${binding.sourceLabel} commentary`,
    );
  }

  const yearEndLabel = payload.yearEndLabel ?? payload.columns.find((label) => /\bYE\b/i.test(label));
  const forecastLabel = payload.forecastLabel
    ?? payload.columns.find((label) => label !== payload.currentLabel && label !== payload.comparisonLabel && label !== yearEndLabel);
  const date = findPeriod(payload.currentLabel);
  const evidenceNote = (payload.warnings?.[0] ?? payload.evidence?.[0] ?? "Actual and forecast scenarios remain separate.").slice(0, 150);
  const sourceNote = report.sourceSnapshot?.name
    ? `Source: ${report.sourceSnapshot.name} · Actual and CF scenarios remain separate.`
    : "Source: authorized Enterprise Data cube. Actual and CF scenarios remain separate.";
  slideXml = replaceTemplateTokens(slideXml, {
    "{{entity}}": payload.entity,
    "{{comparison_label}}": payload.comparison.toUpperCase(),
    "{{as_of_month}}": date ? `${MONTHS_FULL[date.month - 1]} ${date.year}` : payload.asOf,
    "{{currency}}": payload.currency,
    "{{evidence_note}}": evidenceNote,
  });
  slideXml = replaceShapeText(slideXml, (text) => text.startsWith("Source: authorized Enterprise Data cube"), sourceNote, "source note");
  files[selectedSlide] = strToU8(slideXml);
  return Buffer.from(zipSync(files));
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

export async function exportEntityPnlPptx(report: EntityPnlExportReport, templateBase64?: string): Promise<Buffer> {
  const payload = payloadFrom(report);
  if (templateBase64) return renderBoschTemplate(report, payload, templateBase64);
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