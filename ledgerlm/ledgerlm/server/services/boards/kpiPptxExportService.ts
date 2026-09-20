import PptxGenJS from "pptxgenjs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

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

type TemplateZip = Record<string, Uint8Array>;

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

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function findMetric(scope: KpiScope, ...terms: string[]) {
  return scope.metrics.find((metric) => {
    const label = metric.label.toLowerCase();
    return terms.some((term) => label.includes(term));
  });
}

function templateMetricText(metric: KpiMetric | undefined) {
  if (!metric) return { summary: "—", detail: "No value available" };
  const detail = [
    metric.forecast !== undefined && metric.forecast !== null
      ? `Forecast: ${metricValue(metric, metric.forecast)}`
      : "",
    metric.variance !== undefined && metric.variance !== null
      ? `Variance: ${metricValue(metric, metric.variance)}`
      : "",
  ].filter(Boolean).join(" | ");
  return {
    summary: metricValue(metric, metric.actual),
    detail: detail || "No forecast or variance available",
  };
}

function templateScopePrefix(scope: KpiScope, index: number) {
  const code = scope.code.toLowerCase();
  if (code === "ww" || code === "worldwide" || code === "all") return "ww";
  if (code === "in" || code === "india") return "in";
  if (code === "vn" || code === "vietnam") return "vn";
  if (code === "mx" || code === "mexico") return "mx";
  return ["ww", "in", "vn", "mx"][index] ?? `scope${index + 1}`;
}

function replaceTemplateTokens(xml: string, report: BoardReportForExport, kpiReport: KpiReport, scope: KpiScope, index: number, total: number) {
  const prefix = templateScopePrefix(scope, index);
  const budgetRevenue = templateMetricText(findMetric(scope, "budget", "revenue"));
  const internalUtilization = templateMetricText(findMetric(scope, "internal utilization", "internal"));
  const externalUtilization = templateMetricText(findMetric(scope, "external utilization", "external"));
  const capacity = templateMetricText(findMetric(scope, "capacity"));
  const source = report.sourceSnapshot?.name ?? "Governed enterprise source";
  const period = kpiReport.periodLabel ?? report.periodLabel ?? "Selected period";
  const actualSource = kpiReport.actualSourceLabel ?? "Governed actuals";
  const forecastSource = kpiReport.forecastSourceLabel ?? "Configured forecast";
  const warningText = kpiReport.warnings?.join(" | ") || "None";
  const replacements: Record<string, string> = {
    "{{report_month}}": period,
    [`{{${prefix}_budget_revenue_summary}}`]: budgetRevenue.summary,
    [`{{${prefix}_budget_revenue_detail}}`]: budgetRevenue.detail,
    [`{{${prefix}_internal_utilization_summary}}`]: internalUtilization.summary,
    [`{{${prefix}_internal_utilization_detail}}`]: internalUtilization.detail,
    [`{{${prefix}_external_utilization_summary}}`]: externalUtilization.summary,
    [`{{${prefix}_external_utilization_detail}}`]: externalUtilization.detail,
    [`{{${prefix}_capacity_summary}}`]: capacity.summary,
    [`{{${prefix}_capacity_detail}}`]: capacity.detail,
    [`{{${prefix}_source_note}}`]: source,
    [`{{${prefix}_actual_source_label}}`]: actualSource,
    [`{{${prefix}_forecast_source_label}}`]: forecastSource,
    [`{{${prefix}_period_label}}`]: period,
    [`{{${prefix}_warnings}}`]: warningText,
    "{{entity_label}}": scope.entity || scope.label,
  };
  return Object.entries(replacements).reduce(
    (result, [token, value]) => result.split(token).join(escapeXml(value)),
    xml,
  ).replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, (slideList) => slideList);
}

function renderUploadedTemplate(
  templateBytesBase64: string,
  report: BoardReportForExport,
  kpiReport: KpiReport,
  scopes: KpiScope[],
  selectedScopes: KpiScope[],
) {
  const templateBytes = Buffer.from(templateBytesBase64, "base64");
  const files: TemplateZip = unzipSync(new Uint8Array(templateBytes));
  const slideNames = Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => Number(left.match(/slide(\d+)/i)?.[1]) - Number(right.match(/slide(\d+)/i)?.[1]));
  if (!slideNames.length || slideNames.length < selectedScopes.length) {
    throw new Error("The uploaded PowerPoint template does not contain enough slides for this KPI report");
  }

  const selectedIndexes = selectedScopes.map((scope) => {
    const scopeIndex = scopes.indexOf(scope);
    return scopeIndex >= 0 ? scopeIndex : selectedScopes.indexOf(scope);
  });
  const slidesToRender = selectedScopes.map((scope, selectedIndex) => {
    const sourceIndex = selectedIndexes[selectedIndex];
    const slideName = slideNames[sourceIndex];
    if (!slideName) throw new Error("The uploaded PowerPoint template is missing a KPI section slide");
    const xml = strFromU8(files[slideName]);
    files[slideName] = strToU8(replaceTemplateTokens(xml, report, kpiReport, scope, sourceIndex, selectedScopes.length));
    return sourceIndex;
  });

  if (slidesToRender.length !== slideNames.length) {
    const presentationName = "ppt/presentation.xml";
    const presentationXml = files[presentationName] ? strFromU8(files[presentationName]) : "";
    if (presentationXml) {
      const slideListMatch = presentationXml.match(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/);
      const ids = slideListMatch?.[0].match(/<p:sldId\b[^>]*\/>/g) ?? [];
      const selectedIds = slidesToRender.map((index) => ids[index]).filter(Boolean);
      if (slideListMatch && selectedIds.length === slidesToRender.length) {
        files[presentationName] = strToU8(
          presentationXml.replace(slideListMatch[0], `<p:sldIdLst>${selectedIds.join("")}</p:sldIdLst>`),
        );
      }
    }
    const appName = "docProps/app.xml";
    if (files[appName]) {
      files[appName] = strToU8(
        strFromU8(files[appName]).replace(/<Slides>\d+<\/Slides>/, `<Slides>${slidesToRender.length}</Slides>`),
      );
    }
  }

  return Buffer.from(zipSync(files));
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

export async function exportKpiReportPptx(
  report: BoardReportForExport,
  scopeCode?: string,
  templateBytesBase64?: string,
): Promise<Buffer> {
  const kpiReport = getKpiReport(report);
  const scopes = getScopes(kpiReport);
  const selectedScopes = scopeCode
    ? scopes.filter((scope) => scope.code.toLowerCase() === scopeCode.toLowerCase())
    : scopes;
  if (!selectedScopes.length) throw new Error("Requested KPI section was not found");
  if (templateBytesBase64) {
    return renderUploadedTemplate(templateBytesBase64, report, kpiReport, scopes, selectedScopes);
  }

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