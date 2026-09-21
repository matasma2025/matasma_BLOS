import PptxGenJS from "pptxgenjs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

interface KpiMetric {
  label: string;
  actual: number | null;
  forecast?: number | null;
  variance?: number | null;
  variancePercent?: number | null;
  breakdowns?: Array<{
    label: string;
    actual: number | null;
    forecast?: number | null;
    variance?: number | null;
  }>;
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
type MetricViewKey = "budget" | "internal" | "external" | "capacity";
type ScopeViewPolicy = Record<MetricViewKey, readonly string[] | null>;

const STANDARD_UTILIZATION_VIEWS = ["MS", "MM"] as const;
const STANDARD_CAPACITY_VIEWS = ["MS", "MM", "SDS", "Integrated Service"] as const;
const SCOPE_VIEW_POLICIES: Record<string, ScopeViewPolicy> = {
  ww: {
    budget: ["MS", "MM", "SDS", "MS-External", "Integrated Service"],
    internal: STANDARD_UTILIZATION_VIEWS,
    external: STANDARD_UTILIZATION_VIEWS,
    capacity: STANDARD_CAPACITY_VIEWS,
  },
  in: {
    budget: ["MS", "MM", "SDS", "MS-External", "Integrated Service"],
    internal: STANDARD_UTILIZATION_VIEWS,
    external: STANDARD_UTILIZATION_VIEWS,
    capacity: STANDARD_CAPACITY_VIEWS,
  },
  vn: {
    budget: ["MS", "MM", "SDS", "Integrated Service"],
    internal: STANDARD_UTILIZATION_VIEWS,
    external: STANDARD_UTILIZATION_VIEWS,
    capacity: STANDARD_CAPACITY_VIEWS,
  },
  mx: {
    budget: ["MS", "MM", "SDS"],
    internal: STANDARD_UTILIZATION_VIEWS,
    external: null,
    capacity: ["MS", "MM", "SDS"],
  },
};

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

function templatePeriodLabel(period: string) {
  const match = period.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return period;
  const month = new Date(`${match[1]} 1, ${match[2]}`).getMonth() + 1;
  return `YTD ${String(month).padStart(2, "0")}.${match[2].slice(-2)}`;
}

function templateMetricText(
  metric: KpiMetric | undefined,
  period: string,
  allowedBreakdowns: readonly string[] | null,
) {
  if (allowedBreakdowns === null) return { summary: "", detail: "" };
  if (!metric) return { summary: "", detail: `1) no governed Actual or Forecast value is available for ${period}.` };
  const label = metric.label.toLowerCase();
  const display = (value: number | null | undefined) => {
    const formatted = metricValue(metric, value);
    return label.includes("capacity") && formatted !== "—" ? `${formatted} HC` : formatted;
  };
  const comparisonLine = (
    prefix: string,
    actual: number | null | undefined,
    forecast: number | null | undefined,
    variance: number | null | undefined,
  ) => {
    if (actual !== null && actual !== undefined && forecast !== null && forecast !== undefined) {
      const direction = variance !== null && variance !== undefined && variance >= 0 ? "higher" : "lower";
      return `${prefix}${period} Actual ${display(actual)} is ${direction} by ${display(Math.abs(variance ?? 0))} compared with Forecast ${display(forecast)}.`;
    }
    if (label.includes("utilization") && actual !== null && actual !== undefined) {
      return `${prefix}${period} Actual is ${display(actual)}; governed Forecast is unavailable.`;
    }
    if (actual !== null && actual !== undefined) {
      return `${prefix}${period} Actual ${display(actual)}; governed Forecast is unavailable.`;
    }
    if (forecast !== null && forecast !== undefined) {
      return `${prefix}${period} Forecast is ${display(forecast)}; governed Actual is unavailable.`;
    }
    return `${prefix}no governed Actual or Forecast value is available for ${period}.`;
  };
  const lines = [
    comparisonLine("1) ", metric.actual, metric.forecast, metric.variance),
    ...(metric.breakdowns ?? [])
      .filter((breakdown) => allowedBreakdowns.includes(breakdown.label))
      .map((breakdown) =>
      comparisonLine(`${breakdown.label}: `, breakdown.actual, breakdown.forecast, breakdown.variance)),
  ];
  return { summary: "", detail: lines.join("\n") };
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
  const policy = SCOPE_VIEW_POLICIES[prefix] ?? SCOPE_VIEW_POLICIES.ww;
  const displayPeriod = templatePeriodLabel(kpiReport.periodLabel ?? report.periodLabel ?? "Selected period");
  const budgetRevenue = templateMetricText(findMetric(scope, "budget", "revenue"), displayPeriod, policy.budget);
  const internalUtilization = templateMetricText(findMetric(scope, "internal utilization", "internal"), displayPeriod, policy.internal);
  const externalUtilization = templateMetricText(findMetric(scope, "external utilization", "external"), displayPeriod, policy.external);
  const capacity = templateMetricText(findMetric(scope, "capacity"), displayPeriod, policy.capacity);
  const source = "Governed green scope";
  const period = displayPeriod;
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
    [`{{${prefix}_entity_label}}`]: scope.entity || scope.label,
  };
  const replaced = Object.entries(replacements).reduce(
    (result, [token, value]) => result.split(token).join(escapeXml(value)),
    xml,
  );
  return policy.external === null
    ? replaced.replace(/<a:t>External Utilization:<\/a:t>/g, "<a:t></a:t>")
    : replaced;
}

function metricViewKey(metric: KpiMetric): MetricViewKey {
  const label = metric.label.toLowerCase();
  if (label.includes("internal utilization")) return "internal";
  if (label.includes("external utilization")) return "external";
  if (label.includes("capacity")) return "capacity";
  return "budget";
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
    const selectedSlideNames = new Set(slidesToRender.map((index) => slideNames[index]));
    for (const slideName of slideNames) {
      if (selectedSlideNames.has(slideName)) continue;
      const slideNumber = slideName.match(/slide(\d+)\.xml$/i)?.[1];
      delete files[slideName];
      if (slideNumber) {
        delete files[`ppt/slides/_rels/slide${slideNumber}.xml.rels`];
        delete files[`ppt/notesSlides/notesSlide${slideNumber}.xml`];
        delete files[`ppt/notesSlides/_rels/notesSlide${slideNumber}.xml.rels`];
      }
    }
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
    const presentationRelsName = "ppt/_rels/presentation.xml.rels";
    if (files[presentationRelsName]) {
      const presentationRels = strFromU8(files[presentationRelsName]);
      files[presentationRelsName] = strToU8(
        presentationRels.replace(
          /<Relationship\b[^>]*Target="slides\/slide(\d+)\.xml"[^>]*\/>/g,
          (relationship, slideNumber) => selectedSlideNames.has(`ppt/slides/slide${slideNumber}.xml`) ? relationship : "",
        ),
      );
    }
    const contentTypesName = "[Content_Types].xml";
    if (files[contentTypesName]) {
      const contentTypes = strFromU8(files[contentTypesName]);
      files[contentTypesName] = strToU8(
        contentTypes.replace(
          /<Override\b[^>]*PartName="\/ppt\/slides\/slide(\d+)\.xml"[^>]*\/>/g,
          (override, slideNumber) => selectedSlideNames.has(`ppt/slides/slide${slideNumber}.xml`) ? override : "",
        ),
      );
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

  const prefix = templateScopePrefix(scope, index);
  const policy = SCOPE_VIEW_POLICIES[prefix] ?? SCOPE_VIEW_POLICIES.ww;
  const metrics = scope.metrics
    .filter((metric) => policy[metricViewKey(metric)] !== null)
    .slice(0, 8);
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