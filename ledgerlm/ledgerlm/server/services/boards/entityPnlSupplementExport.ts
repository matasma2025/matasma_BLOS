import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import type { EntityPnlExportPayload } from "./entityPnlExportService";

export function supplementalRows(payload: EntityPnlExportPayload): string[][] {
  const rows = (payload.planningForecast?.entityBreakdowns ?? (payload.planningForecast ? [payload.planningForecast] : []))
    .flatMap((source) => source.metrics.map((metric) => [
    payload.planningForecast?.entityBreakdowns ? `${source.entity} — ${metric.label}` : metric.label,
    metric.value === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 })
      .format(metric.unit === "USD" ? metric.value / 1_000_000 : metric.value),
    metric.unit === "USD" ? "mUSD" : "Capacity",
    metric.status === "conflicting" ? "Conflicting records" : metric.status === "missing" ? "Not supplied" : "Available",
  ]));
  if (payload.forecastComparison) {
    const format = (value: number | null) => value === null ? "—"
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
    for (const row of payload.forecastComparison.rows) {
      const monetary = !row.label.includes("Capacity") && !["Total End", "Total Average", "EBIT%"].includes(row.label);
      const scale = monetary ? 1_000_000 : 1;
      const scaled = (value: number | null) => format(value === null ? null : value / scale);
      rows.push([
        `Actual vs ${payload.forecastComparison.scenario} — ${row.label}`,
        `${scaled(row.actual)} / ${scaled(row.forecast)} / Δ ${scaled(row.variance)}`,
        row.label === "EBIT%" ? "% / pp" : monetary ? `m${payload.currency}` : "Capacity",
        row.reason ? (row.forecast === null ? "No comparable CF snapshot" : "Actual snapshot unavailable")
          : row.label === "EBIT%" ? "Margin delta in pp" : `Δ% ${row.variancePercent === null ? "N/A" : `${format(row.variancePercent)}%`}`,
      ]);
    }
  }
  if (payload.expenseReconciliation?.some((item) => item.amount !== null && Math.abs(item.amount) > 0.01)) {
    rows.push(...payload.expenseReconciliation.map((item) => [
      `Undisplayed expenses — ${item.period}`,
      item.amount === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(item.amount / 1_000_000),
      `m${payload.currency}`,
      "Already in Total Expenses",
    ]));
  }
  return rows;
}

export const SUPPLEMENT_NOTES = [
  "Planning budget period basis is unconfirmed; budget is not substituted for P&L revenue. USD is not converted to INR without an approved rate.",
  "Capacity averages are supplied planning values, not assumed YTD averages. Offshore and Onsite are not automatically combined into On-roll.",
  "Undisplayed expenses are already included in Total Expenses. Do not add them again. Conflicting planning values are unavailable, not summed or selected by row order.",
  "Actual / CF / delta comparisons require matching scope, period and currency. Missing comparisons stay unavailable. Source entity planning totals are separate and must not be added to World Wide.",
];

export function supplementNotes(payload: EntityPnlExportPayload): string[] {
  const source = payload.financialPlanSource;
  if (!source) return SUPPLEMENT_NOTES;
  return [
    `Financial source: ${source.sourceName}, ${source.entity} only. Financial amounts are mINR; ${
      source.periodBasis === "mtd"
        ? "monthly MTD basis is user-confirmed. Sum January through the selected month for YTD, or the selected quarter for QoQ; capacity remains point-in-time."
        : "cumulative YTD basis is user-confirmed. Do not sum monthly financial snapshots."}`,
    payload.currency === "USD"
      ? source.usdExchangeRate
        ? `${source.scenario}: source mINR × 1,000,000 ÷ ${source.usdExchangeRate} INR/USD. Actual uses its own existing cube USD amounts. Capacity is never currency-converted.`
        : `${source.scenario}: no approved INR/USD rate. Financial USD cells remain unavailable; capacities are not currency-converted.`
      : "Financial amounts are normalized once from mINR to INR. Capacity is not scaled. Signed credits reduce expenses.",
    "End capacity is point-in-time. Average capacity uses monthly end snapshots: YTD for YoY, three months for QoQ. Missing cells are not zero.",
    "Actual / CF / delta is independent of YoY/QoQ. EBIT margin changes are pp only. Undisplayed expenses are already in Total Expenses; do not add them again.",
  ];
}

/** Append a text/table-only slide, preserving the uploaded template and its existing assets. */
export function appendSupplementSlide(template: Buffer, supplement: Buffer): Buffer {
  const files = unzipSync(new Uint8Array(template));
  const extra = unzipSync(new Uint8Array(supplement));
  const read = (name: string) => {
    if (!files[name]) throw new Error(`PowerPoint supplement requires ${name}`);
    return strFromU8(files[name]);
  };
  const presentationName = "ppt/presentation.xml";
  const relationshipName = "ppt/_rels/presentation.xml.rels";
  const presentation = read(presentationName);
  const relationships = read(relationshipName);
  const slideNumbers = Object.keys(files).flatMap((name) => {
    const match = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    return match ? [Number(match[1])] : [];
  });
  const slideNumber = Math.max(0, ...slideNumbers) + 1;
  const slideId = Math.max(255, ...Array.from(presentation.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g), (match) => Number(match[1]))) + 1;
  const rId = `rId${Math.max(0, ...Array.from(relationships.matchAll(/\bId="rId(\d+)"/g), (match) => Number(match[1]))) + 1}`;
  const firstSlideRels = read(`ppt/slides/_rels/slide${Math.min(...slideNumbers)}.xml.rels`);
  const layout = firstSlideRels.match(/<Relationship\b[^>]*Type="[^"]*\/slideLayout"[^>]*\/>/)?.[0];
  const layoutTarget = layout?.match(/\bTarget="([^"]+)"/)?.[1];
  if (!layoutTarget || !extra["ppt/slides/slide1.xml"] || !presentation.includes("</p:sldIdLst>")) {
    throw new Error("Cannot append planning data to this PowerPoint template.");
  }
  const slideXml = strFromU8(extra["ppt/slides/slide1.xml"]);
  if (/\br:(?:embed|link|id)=/.test(slideXml)) throw new Error("Supplement slide must contain only text and tables.");
  files[`ppt/slides/slide${slideNumber}.xml`] = strToU8(slideXml);
  files[`ppt/slides/_rels/slide${slideNumber}.xml.rels`] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="${layoutTarget}"/></Relationships>`);
  files[presentationName] = strToU8(presentation.replace("</p:sldIdLst>", `<p:sldId id="${slideId}" r:id="${rId}"/></p:sldIdLst>`));
  files[relationshipName] = strToU8(relationships.replace("</Relationships>", `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNumber}.xml"/></Relationships>`));
  files["[Content_Types].xml"] = strToU8(read("[Content_Types].xml").replace("</Types>", `<Override PartName="/ppt/slides/slide${slideNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`));
  return Buffer.from(zipSync(files));
}
