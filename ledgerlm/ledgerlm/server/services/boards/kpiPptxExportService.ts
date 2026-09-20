import PptxGenJS from "pptxgenjs";

interface KpiMetric {
  label: string;
  actual: number | null;
  forecast?: number | null;
  variance?: number | null;
  variancePercent?: number | null;
}

interface KpiScope {
  id: string;
  code: string;
  label: string;
  entity: string;
  metrics: KpiMetric[];
}

interface KpiReport {
  scope?: string;
  periodLabel?: string;
  forecastScenario?: string;
  actualSourceLabel?: string;
  forecastSourceLabel?: string;
  metrics: KpiMetric[];
  scopeBadges?: KpiScope[];
  warnings?: string[];
}

interface BoardReportForExport {
  title: string;
  periodLabel?: string | null;
  sourceSnapshot?: { name?: string; sourceType?: string } | null;
  result?: { kpiReport?: KpiReport } | null;
}

const SCOPE_COLORS = [
  { accent: "0F766E", soft: "CCFBF1", surface: "F0FDFA", text: "115E59" },
  { accent: "DB2777", soft: "FCE7F3", surface: "FDF2F8", text: "9D174D" },
  { accent: "D97706", soft: "FEF3C7", surface: "FFFBEB", text: "92400E" },
  { accent: "7C3AED", soft: "EDE9FE", surface: "F5F3FF", text: "5B21B6" },
];

function numberValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function metricValue(metric: KpiMetric, value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const label = metric.label.toLowerCase();
  if (label.includes("utilization")) return `${numberValue(Math.abs(value) <= 1.5 ? value * 100 : value)}%`;
  if (label.includes("revenue")) return `${numberValue(value)} mUSD`;
  return numberValue(value);
}

function getKpiReport(report: BoardReportForExport) {
  const kpiReport = report.result?.kpiReport;
  if (!kpiReport) throw new Error("This report does not contain an imported KPI presentation");
  return kpiReport;
}

function getScopes(kpiReport: KpiReport): KpiScope[] {
  return kpiReport.scopeBadges?.length
    ? kpiReport.scopeBadges
    : [{ id: "aggregate", code: "ALL", label: "All entities", entity: "", metrics: kpiReport.metrics }];
}

// The development loader exposes the CommonJS package as the default class,
// while the bundled server can expose a nested default. Normalize both shapes.
const PptxConstructor = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS);

function addScopeSlide(
  pptx: InstanceType<typeof PptxGenJS>,
  report: BoardReportForExport,
  kpiReport: KpiReport,
  scope: KpiScope,
  index: number,
  total: number,
) {
  const colors = SCOPE_COLORS[index % SCOPE_COLORS.length];
  const period = kpiReport.periodLabel ?? report.periodLabel ?? "Selected period";
  const sourceName = report.sourceSnapshot?.name ?? "Governed enterprise source";
  const slide = pptx.addSlide();
  slide.background = { color: "F8FAFC" };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 1.28,
    fill: { color: "073B4C" }, line: { color: "073B4C" },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 1.28, w: 13.333, h: 0.12,
    fill: { color: colors.accent }, line: { color: colors.accent },
  });
  slide.addText("IMPORTED KPI PRESENTATION", {
    x: 0.58, y: 0.22, w: 4.5, h: 0.18, fontFace: "Aptos", fontSize: 8,
    bold: true, charSpacing: 1.6, color: "CCFBF1", margin: 0,
  });
  slide.addText(`Business Metrics ${period}`, {
    x: 0.58, y: 0.48, w: 8.5, h: 0.42, fontFace: "Aptos Display", fontSize: 23,
    bold: true, color: "FFFFFF", margin: 0, fit: "shrink",
  });
  slide.addText(`${report.title} · ${scope.label}`, {
    x: 0.6, y: 0.96, w: 8.5, h: 0.18, fontFace: "Aptos", fontSize: 9,
    color: "E6FFFB", margin: 0, fit: "shrink",
  });
  slide.addText(`${index + 1} / ${total}`, {
    x: 11.8, y: 0.52, w: 0.9, h: 0.3, align: "right",
    fontFace: "Aptos", fontSize: 12, bold: true, color: "FFFFFF", margin: 0,
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.58, y: 1.72, w: 12.17, h: 0.62, rectRadius: 0.08,
    fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 },
  });
  slide.addText("DECISION / INFO TO GLS", {
    x: 0.82, y: 1.88, w: 2.2, h: 0.14, fontFace: "Aptos", fontSize: 7.5,
    bold: true, charSpacing: 1.1, color: "64748B", margin: 0,
  });
  slide.addText(`${scope.entity || "Global scope"} · ${scope.code}`, {
    x: 3.05, y: 1.84, w: 2.8, h: 0.2, fontFace: "Aptos", fontSize: 10,
    bold: true, color: colors.text, margin: 0, fit: "shrink",
  });
  slide.addText(`${kpiReport.actualSourceLabel ?? "Actuals: governed enterprise source"}\n${kpiReport.forecastSourceLabel ?? "Forecast: configured planning source"}`, {
    x: 7.2, y: 1.82, w: 5.15, h: 0.27, fontFace: "Aptos", fontSize: 7.5,
    color: "64748B", align: "right", margin: 0, breakLine: false,
  });

  const metrics = scope.metrics.slice(0, 8);
  const columns = metrics.length <= 2 ? 2 : metrics.length <= 4 ? 2 : 4;
  const cardWidth = columns === 4 ? 2.88 : 5.85;
  const cardHeight = metrics.length <= columns ? 2.0 : 1.68;
  const gap = 0.24;
  const startY = 2.7;
  metrics.forEach((metric, metricIndex) => {
    const column = metricIndex % columns;
    const row = Math.floor(metricIndex / columns);
    const x = 0.58 + column * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap);
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cardWidth, h: cardHeight, rectRadius: 0.06,
      fill: { color: colors.surface }, line: { color: colors.accent, transparency: 78, width: 1 },
    });
    slide.addText(metric.label, {
      x: x + 0.22, y: y + 0.2, w: cardWidth - 0.44, h: 0.22,
      fontFace: "Aptos", fontSize: 9, color: "64748B", margin: 0, fit: "shrink",
    });
    slide.addText(metricValue(metric, metric.actual), {
      x: x + 0.22, y: y + 0.53, w: cardWidth - 0.44, h: 0.42,
      fontFace: "Aptos Display", fontSize: columns === 4 ? 21 : 26, bold: true,
      color: "0F172A", margin: 0, fit: "shrink",
    });
    const detail = [
      metric.forecast !== undefined ? `Forecast: ${metricValue(metric, metric.forecast)}` : "",
      metric.variance !== undefined && metric.variance !== null ? `Variance: ${metricValue(metric, metric.variance)}` : "",
    ].filter(Boolean).join("  ·  ");
    if (detail) {
      slide.addText(detail, {
        x: x + 0.22, y: y + cardHeight - 0.39, w: cardWidth - 0.44, h: 0.17,
        fontFace: "Aptos", fontSize: 7.5, color: "64748B", margin: 0, fit: "shrink",
      });
    }
  });

  const footerY = Math.min(6.82, startY + Math.ceil(metrics.length / columns) * (cardHeight + gap) + 0.18);
  slide.addText(`${scope.label} · ${period} · ${sourceName}`, {
    x: 0.6, y: footerY, w: 9.5, h: 0.16, fontFace: "Aptos", fontSize: 7.5,
    color: "64748B", margin: 0, fit: "shrink",
  });
  slide.addText("INTERNAL · GOVERNED ENTERPRISE DATA", {
    x: 9.2, y: footerY, w: 3.55, h: 0.16, fontFace: "Aptos", fontSize: 7.5,
    bold: true, color: colors.text, align: "right", margin: 0,
  });
}

export async function exportKpiReportPptx(report: BoardReportForExport, scopeCode?: string): Promise<Buffer> {
  const kpiReport = getKpiReport(report);
  const scopes = getScopes(kpiReport);
  const selectedScopes = scopeCode
    ? scopes.filter((scope) => scope.code.toLowerCase() === scopeCode.toLowerCase())
    : scopes;
  if (!selectedScopes.length) throw new Error("Requested KPI section was not found");

  const pptx = new PptxConstructor();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "LedgerLM";
  pptx.company = "LedgerLM";
  pptx.subject = `${report.title} KPI report`;
  pptx.title = scopeCode ? `${report.title} - ${selectedScopes[0].label}` : report.title;
  selectedScopes.forEach((scope, index) => addScopeSlide(pptx, report, kpiReport, scope, index, selectedScopes.length));
  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}