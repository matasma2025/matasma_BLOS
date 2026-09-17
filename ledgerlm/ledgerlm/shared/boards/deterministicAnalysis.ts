import { z } from "zod";

/** Versioned wire contract for the server-owned, deterministic Board result. */
export const BOARD_DETERMINISTIC_SCHEMA_VERSION = 1;
export const BOARD_FORMULA_ENGINE_VERSION = "deterministic-board-v1";

export const measureAggregationSchema = z.enum([
  "sum", "average", "min", "max", "last", "latest", "count", "ratio",
]);
export const favorabilityRuleSchema = z.enum([
  "higher-is-favorable", "lower-is-favorable", "neutral",
]);

const finiteNumber = z.number().finite();
const boundedText = z.string().trim().min(1).max(200);

export const deterministicMeasureSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  label: boundedText,
  aggregation: measureAggregationSchema,
  valueType: z.enum(["currency", "percentage", "count", "ratio", "number"]),
  favorability: favorabilityRuleSchema.default("neutral"),
  numerator: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).optional(),
  denominator: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).optional(),
  materiality: finiteNumber.nonnegative().max(1e15).optional(),
  filters: z.array(z.object({
    column: boundedText,
    values: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
  }).strict()).max(50).default([]),
}).strict().superRefine((measure, ctx) => {
  if (measure.aggregation === "ratio" && (!measure.numerator || !measure.denominator)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ratios require explicit numerator and denominator", path: ["numerator"] });
  }
  if (measure.aggregation !== "ratio" && (measure.numerator || measure.denominator)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Numerator and denominator are only valid for ratios", path: ["numerator"] });
  }
});

export const deterministicAnalysisRequestSchema = z.object({
  schemaVersion: z.literal(BOARD_DETERMINISTIC_SCHEMA_VERSION).default(BOARD_DETERMINISTIC_SCHEMA_VERSION),
  measures: z.array(deterministicMeasureSchema).min(1).max(50),
  materiality: finiteNumber.nonnegative().max(1e15).optional(),
  contributorLimit: z.number().int().min(1).max(5000).default(500),
}).strict();

export const deterministicEvidenceSchema = z.object({
  sourceId: boundedText,
  sourceType: boundedText,
  queryFingerprint: z.string().regex(/^[A-Za-z0-9_.:-]{1,200}$/),
  period: boundedText,
  rowCount: z.number().int().nonnegative().max(10_000_000),
}).strict();

export const deterministicMeasureResultSchema = z.object({
  measureId: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  actual: finiteNumber,
  budget: finiteNumber,
  variance: finiteNumber,
  variancePct: finiteNumber.nullable(),
  comparisonActual: finiteNumber.optional(),
  comparisonBudget: finiteNumber.optional(),
  comparisonVariance: finiteNumber.optional(),
  contribution: finiteNumber.nullable(),
  favorable: z.boolean().nullable(),
  material: z.boolean(),
}).strict();

export const deterministicContributorSchema = z.object({
  key: z.string().max(1000),
  measures: z.array(deterministicMeasureResultSchema).max(50),
}).strict();

export const deterministicAnalysisResultSchema = z.object({
  schemaVersion: z.literal(BOARD_DETERMINISTIC_SCHEMA_VERSION),
  formulaEngineVersion: z.string().max(100),
  measures: z.array(deterministicMeasureResultSchema).max(50),
  contributors: z.array(deterministicContributorSchema).max(5000),
  evidence: z.array(deterministicEvidenceSchema).max(20),
}).strict();

export type DeterministicMeasure = z.infer<typeof deterministicMeasureSchema>;
export type DeterministicAnalysisRequest = z.infer<typeof deterministicAnalysisRequestSchema>;
export type DeterministicMeasureResult = z.infer<typeof deterministicMeasureResultSchema>;
export type DeterministicAnalysisResult = z.infer<typeof deterministicAnalysisResultSchema>;
export type DeterministicEvidence = z.infer<typeof deterministicEvidenceSchema>;