import { z } from "zod";
import { BOARD_RESULT_SCHEMA_VERSION } from "@shared/boards/boardRun";

const boundedRecord = <T extends z.ZodTypeAny>(valueSchema: T, maxEntries: number) =>
  z.record(valueSchema).superRefine((value, context) => {
    const keys = Object.keys(value);
    if (keys.length > maxEntries) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Record cannot contain more than ${maxEntries} entries` });
    }
    if (keys.some((key) => key.length > 200)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Record keys cannot exceed 200 characters" });
    }
  });

const chartDatumSchema = boundedRecord(z.union([z.string().max(1_000), z.number().finite(), z.null()]), 50);

const chartSchema = z.object({
  type: z.enum(["bar", "line", "pie", "area", "table"]).optional(),
  title: z.string().max(200).optional(),
  data: z.array(chartDatumSchema).max(100).optional(),
  config: boundedRecord(z.string().max(200), 50).optional(),
}).strict();

const kpiMetricBreakdownSchema = z.object({
  label: z.string().max(100),
  actual: z.number().finite().nullable(),
  forecast: z.number().finite().nullable().optional(),
  variance: z.number().finite().nullable().optional(),
}).strict();

const kpiMetricSchema = z.object({
  label: z.string().max(200),
  actual: z.number().finite().nullable(),
  forecast: z.number().finite().nullable().optional(),
  variance: z.number().finite().nullable().optional(),
  variancePercent: z.number().finite().nullable().optional(),
  breakdowns: z.array(kpiMetricBreakdownSchema).max(10).optional(),
}).strict();

const kpiScopeSchema = z.object({
  id: z.string().max(100),
  code: z.string().max(20),
  label: z.string().max(200),
  entity: z.string().max(200),
  metrics: z.array(kpiMetricSchema).max(20),
}).strict();

export const boardAnalysisResultSchema = z.object({
  schemaVersion: z.literal(BOARD_RESULT_SCHEMA_VERSION).default(BOARD_RESULT_SCHEMA_VERSION),
  summary: z.string().max(4_000).default(""),
  kpis: z.array(z.object({
    label: z.string().max(200),
    value: z.string().max(200),
    change: z.string().max(200).optional(),
    direction: z.enum(["up", "down", "flat"]).optional(),
  }).strict()).max(20).default([]),
  charts: z.array(chartSchema).max(20).default([]),
  insights: z.array(z.string().max(1_000)).max(30).default([]),
  commentary: z.array(z.object({ label: z.string().max(200), text: z.string().max(2_000) }).strict()).max(30).default([]),
  risks: z.array(z.string().max(1_000)).max(30).default([]),
  tables: z.array(z.object({
    title: z.string().max(200).optional(),
    columns: z.array(z.string().max(200)).max(30),
    rows: z.array(z.array(z.union([z.string().max(4_000), z.number().finite(), z.null()])).max(30)).max(100),
  }).strict()).max(20).default([]),
  actions: z.array(z.object({ label: z.string().max(200), owner: z.string().max(200).optional(), detail: z.string().max(2_000) }).strict()).max(30).default([]),
  balanceSheet: z.object({
    balanced: z.boolean(),
    difference: z.number().finite(),
    totals: boundedRecord(z.number().finite(), 100).default({}),
    ratios: boundedRecord(z.number().finite().nullable(), 100).default({}),
    unmappedRows: z.array(z.string().max(500)).max(500).default([]),
  }).strict().optional(),
  entityPnl: z.object({
    entity: z.string().max(200),
    currency: z.string().max(20),
    metrics: boundedRecord(z.number().finite().nullable(), 100).default({}),
    warnings: z.array(z.string().max(1_000)).max(100).default([]),
  }).strict().optional(),
  kpiReport: z.object({
    scope: z.string().max(500).optional(),
    periodLabel: z.string().max(100).optional(),
    forecastScenario: z.string().max(100).optional(),
    actualSourceLabel: z.string().max(300).optional(),
    forecastSourceLabel: z.string().max(300).optional(),
    metrics: z.array(kpiMetricSchema).max(100),
    scopeBadges: z.array(kpiScopeSchema).max(10).optional(),
    warnings: z.array(z.string().max(1_000)).max(100).default([]),
  }).strict().optional(),
}).strict();

export type BoardAnalysisResult = z.infer<typeof boardAnalysisResultSchema>;

export function parseBoardAnalysisResult(value: unknown): BoardAnalysisResult {
  return boardAnalysisResultSchema.parse(value);
}

export function markdownToBoardAnalysisResult(raw: string, varianceData: unknown): BoardAnalysisResult {
  const summary = raw.trim().slice(0, 4_000);
  const rows = Array.isArray(varianceData) ? varianceData.slice(0, 100) as Array<Record<string, unknown>> : [];
  return parseBoardAnalysisResult({
    summary,
    insights: raw.split(/\n+/).filter((line) => /^[-*]\s+/.test(line)).slice(0, 30).map((line) => line.replace(/^[-*]\s+/, "").trim()),
    tables: rows.length ? [{
      title: "Deterministic variance data",
      columns: ["Dimension", "Actual", "Budget", "Variance", "Variance %"],
      rows: rows.map((row) => [row.k ?? "", row.a ?? null, row.b ?? null, row.v ?? null, row.vp ?? null]),
    }] : [],
  });
}