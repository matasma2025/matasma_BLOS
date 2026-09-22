import PptxGenJS from "pptxgenjs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { BalanceSheetReport } from "@shared/boards/balanceSheet";

interface BalanceSheetExportReport {
  title: string;
  periodLabel?: string | null;
  sourceSnapshot?: { name?: string; sourceType?: string } | null;
  result?: { balanceSheet?: BalanceSheetReport } | null;
}

function money(value: number, currency: string) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} ${currency}`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function replaceTokens(templateBytesBase64: string, report: BalanceSheetExportReport, balanceSheet: BalanceSheetReport) {
  const files = unzipSync(new Uint8Array(Buffer.from(templateBytesBase64, "base64")));
  const tokens: Record<string, string> = {
    "{{report_title}}": report.title,
    "{{period_label}}": balanceSheet.periodLabel,
    "{{currency}}": balanceSheet.currency,
    "{{balance_status}}": balanceSheet.balanced ? "Balanced" : `Difference ${money(balanceSheet.difference, balanceSheet.currency)}`,
    "{{assets}}": money(balanceSheet.totals.assets, balanceSheet.currency),
    "{{liabilities}}": money(balanceSheet.totals.liabilities, balanceSheet.currency),
    "{{equity}}": money(balanceSheet.totals.equity, balanceSheet.currency),
    "{{liabilities_and_equity}}": money(balanceSheet.totals.liabilitiesAndEquity, balanceSheet.currency),
    "{{current_ratio}}": balanceSheet.ratios.currentRatio === null ? "—" : `${balanceSheet.ratios.currentRatio.toFixed(2)}x`,
    "{{quick_ratio}}": balanceSheet.ratios.quickRatio === null ? "—" : `${balanceSheet.ratios.quickRatio.toFixed(2)}x`,
    "{{debt_to_equity}}": balanceSheet.ratios.debtToEquity === null ? "—" : `${balanceSheet.ratios.debtToEquity.toFixed(2)}x`,
    "{{equity_ratio}}": balanceSheet.ratios.equityRatio === null ? "—" : `${(balanceSheet.ratios.equityRatio * 100).toFixed(1)}%`,
    "{{warnings}}": balanceSheet.warnings.join(" | ") || "None",
  };
  for (const name of Object.keys(files)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/i.test(name)) continue;
    let xml = strFromU8(files[name]);
    for (const [token, value] of Object.entries(tokens)) xml = xml.split(token).join(escapeXml(value));
    files[name] = strToU8(xml);
  }
  return Buffer.from(zipSync(files));
}

const PptxConstructor = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS);

function addBalanceSheetSlide(pptx: InstanceType<typeof PptxGenJS>, report: BalanceSheetExportReport, balanceSheet: BalanceSheetReport, title: string) {
  const slide = pptx.addSlide();
  slide.background = { color: "F8FAFC" };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 1.25, fill: { color: "073B4C" }, line: { color: "073B4C" } });
  slide.addText("BALANCE SHEET ANALYSIS", { x: 0.6, y: 0.22, w: 5, h: 0.2, fontFace: "Aptos", fontSize: 8, bold: true, charSpacing: 1.5, color: "CCFBF1", margin: 0 });
  slide.addText(title, { x: 0.6, y: 0.5, w: 8.5, h: 0.35, fontFace: "Aptos Display", fontSize: 22, bold: true, color: "FFFFFF", margin: 0, fit: "shrink" });
  slide.addText(`${balanceSheet.periodLabel} · ${report.sourceSnapshot?.name ?? "Dedicated Balance Sheet cube"}`, { x: 0.6, y: 0.93, w: 9, h: 0.16, fontFace: "Aptos", fontSize: 8, color: "E6FFFB", margin: 0 });
  const cards = [["Assets", balanceSheet.totals.assets], ["Liabilities", balanceSheet.totals.liabilities], ["Equity", balanceSheet.totals.equity], ["Liabilities + Equity", balanceSheet.totals.liabilitiesAndEquity]] as const;
  cards.forEach(([label, value], index) => {
    const x = 0.6 + index * 3.08;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.65, w: 2.8, h: 1.0, rectRadius: 0.06, fill: { color: "FFFFFF" }, line: { color: "D7E3E8" } });
    slide.addText(label, { x: x + 0.2, y: 1.86, w: 2.4, h: 0.16, fontFace: "Aptos", fontSize: 8, color: "64748B", margin: 0 });
    slide.addText(money(value, balanceSheet.currency), { x: x + 0.2, y: 2.15, w: 2.4, h: 0.23, fontFace: "Aptos Display", fontSize: 16, bold: true, color: "0F172A", margin: 0, fit: "shrink" });
  });
  slide.addText(`Balance status: ${balanceSheet.balanced ? "Balanced" : `Difference ${money(balanceSheet.difference, balanceSheet.currency)}`}`, { x: 0.6, y: 2.95, w: 6, h: 0.2, fontFace: "Aptos", fontSize: 10, bold: true, color: balanceSheet.balanced ? "166534" : "B91C1C", margin: 0 });
  slide.addText("Liquidity & leverage", { x: 7.2, y: 2.95, w: 3, h: 0.2, fontFace: "Aptos", fontSize: 10, bold: true, color: "0F172A", margin: 0 });
  slide.addText([
    `Current ratio: ${balanceSheet.ratios.currentRatio?.toFixed(2) ?? "—"}`,
    `Quick ratio: ${balanceSheet.ratios.quickRatio?.toFixed(2) ?? "—"}`,
    `Debt / equity: ${balanceSheet.ratios.debtToEquity?.toFixed(2) ?? "—"}`,
    `Equity ratio: ${balanceSheet.ratios.equityRatio === null ? "—" : `${(balanceSheet.ratios.equityRatio * 100).toFixed(1)}%`}`,
  ].join("\n"), { x: 7.2, y: 3.25, w: 4.8, h: 0.9, fontFace: "Aptos", fontSize: 10, color: "334155", margin: 0.02, breakLine: false });
  slide.addText("Material movements", { x: 0.6, y: 3.45, w: 3, h: 0.2, fontFace: "Aptos", fontSize: 10, bold: true, color: "0F172A", margin: 0 });
  balanceSheet.movements.slice(0, 8).forEach((movement, index) => {
    const y = 3.78 + index * 0.34;
    slide.addText(movement.accountName, { x: 0.6, y, w: 3.5, h: 0.16, fontFace: "Aptos", fontSize: 8.5, color: "334155", margin: 0, fit: "shrink" });
    slide.addText(movement.category, { x: 4.2, y, w: 2.8, h: 0.16, fontFace: "Aptos", fontSize: 8.5, color: "64748B", margin: 0, fit: "shrink" });
    slide.addText(money(movement.change, balanceSheet.currency), { x: 7.2, y, w: 2.4, h: 0.16, fontFace: "Aptos", fontSize: 8.5, color: movement.change < 0 ? "B91C1C" : "166534", margin: 0, fit: "shrink" });
  });
  slide.addText("INTERNAL · GOVERNED ENTERPRISE DATA", { x: 8.8, y: 6.95, w: 3.9, h: 0.16, fontFace: "Aptos", fontSize: 7.5, bold: true, color: "64748B", align: "right", margin: 0 });
}

export async function exportBalanceSheetPptx(report: BalanceSheetExportReport, templateBytesBase64?: string): Promise<Buffer> {
  const balanceSheet = report.result?.balanceSheet;
  if (!balanceSheet) throw new Error("This report does not contain Balance Sheet data");
  if (templateBytesBase64) return replaceTokens(templateBytesBase64, report, balanceSheet);
  const pptx = new PptxConstructor();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "LedgerLM";
  pptx.company = "LedgerLM";
  pptx.subject = "Balance Sheet report";
  pptx.title = report.title;
  addBalanceSheetSlide(pptx, report, balanceSheet, "Balance Sheet");
  addBalanceSheetSlide(pptx, report, balanceSheet, "Balance Sheet — Liabilities & Equity");
  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}