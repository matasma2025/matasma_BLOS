import { z } from "zod";
import { boardSourceReferenceSchema } from "./boardSources";

export const BOARD_CONFIG_SCHEMA_VERSION = 2;

export const boardMetricSelectionSchema = z.object({
  column: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  aggregation: z.enum(["sum", "last", "average", "min", "max"]).optional(),
  valueType: z.enum(["currency", "percentage", "count", "ratio"]).optional(),
  dimension: z.string().trim().min(1).max(200).optional(),
  dimensionValues: z.array(z.string().trim().min(1).max(500)).max(500).optional(),
}).strict();

export const boardDimensionFilterSchema = z.object({
  column: z.string().trim().min(1).max(200),
  values: z.array(z.string().trim().min(1).max(500)).min(1).max(500),
}).strict();

export const boardScopeSchema = z.object({
  mode: z.enum(["all", "selected", "all-except"]).default("all"),
  keyColumns: z.array(boardMetricSelectionSchema).max(100).default([]),
  excludedColumns: z.array(z.string().trim().min(1).max(200)).max(500).default([]),
  filters: z.array(boardDimensionFilterSchema).max(100).default([]),
}).strict();

export const boardTimeConfigurationSchema = z.object({
  granularity: z.enum(["auto", "monthly", "quarterly", "yearly"]).default("auto"),
  year: z.number().int().min(1900).max(2200).optional(),
  months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
}).strict();

export const boardComparisonConfigurationSchema = z.object({
  basis: z.enum(["previous", "opening", "year-ago", "specific"]).optional(),
  year: z.number().int().min(1900).max(2200).optional(),
  months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  label: z.string().trim().max(200).optional(),
}).strict();

export const boardAnalysisConfigContractSchema = z.object({
  schemaVersion: z.literal(BOARD_CONFIG_SCHEMA_VERSION).default(BOARD_CONFIG_SCHEMA_VERSION),
  templateSlug: z.string().trim().min(1).max(100),
  source: boardSourceReferenceSchema,
  scope: boardScopeSchema.default({ mode: "all", keyColumns: [], excludedColumns: [], filters: [] }),
  time: boardTimeConfigurationSchema.default({ granularity: "auto" }),
  comparison: boardComparisonConfigurationSchema.default({}),
  forecast: z.object({
    scenarios: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  }).strict().optional(),
  fiscalCalendar: z.object({
    startMonth: z.number().int().min(1).max(12).default(1),
  }).strict().optional(),
  varianceThreshold: z.number().finite().min(0).max(100_000).optional(),
  reportInstructions: z.string().max(10_000).optional(),
}).strict();

export type BoardAnalysisConfigContract = z.infer<typeof boardAnalysisConfigContractSchema>;
export type BoardMetricSelection = z.infer<typeof boardMetricSelectionSchema>;
export type BoardScope = z.infer<typeof boardScopeSchema>;
