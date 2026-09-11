import { z } from "zod";

const chartSchema = z.object({
  type: z.enum(["bar", "line", "pie", "area", "table"]).optional(),
  title: z.string().max(200).optional(),
  data: z.array(z.record(z.union([z.string(), z.number(), z.null()]))).max(100).optional(),
  config: z.record(z.string().max(200)).optional(),
}).strict();

export const boardAnalysisResultSchema = z.object({
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
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).max(100),
  }).strict()).max(20).default([]),
  actions: z.array(z.object({ label: z.string().max(200), owner: z.string().max(200).optional(), detail: z.string().max(2_000) }).strict()).max(30).default([]),
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