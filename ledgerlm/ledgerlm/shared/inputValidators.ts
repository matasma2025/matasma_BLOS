import { z } from "zod";

// Display text is rendered by React, but these checks also keep dangerous values out
// of stored names and prompts used by downstream services.
const CONTROL_OR_BIDI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;
const MARKUP_OR_TEMPLATE = /<\s*\/?\s*[a-z!][^>]*>|<\/?(?:script|style|iframe|object|embed)\b|\{\{|\}\}|\$\{|<%|%>/i;
const UNSAFE_PROTOCOL = /\b(?:javascript|data|vbscript)\s*:/i;

function decodedVariants(value: string): string[] {
  const variants = [value];
  let decoded = value;
  // A small bounded decode catches normal and double-encoded transport payloads.
  for (let i = 0; i < 2; i += 1) {
    try {
      decoded = decodeURIComponent(decoded.replace(/\+/g, "%20"));
    } catch {
      break;
    }
    if (variants.includes(decoded)) break;
    variants.push(decoded);
  }
  return variants;
}

export function isSafeDisplayText(value: string): boolean {
  return decodedVariants(value).every(
    (candidate) =>
      !CONTROL_OR_BIDI.test(candidate) &&
      !MARKUP_OR_TEMPLATE.test(candidate) &&
      !UNSAFE_PROTOCOL.test(candidate),
  );
}

export const safeDisplayText = (label: string, max: number, trim = false) =>
  z.string()
    .max(max, `${label} must be at most ${max} characters`)
    .transform((value) => {
      const normalized = value.normalize("NFC");
      return trim ? normalized.trim() : normalized;
    })
    .refine(isSafeDisplayText, `${label} contains unsafe characters or content`);

const BOARD_PROMPT_PLACEHOLDER = /\{\{(?:#comparison|\/comparison|period|actuals_column|budget_column|forecast_column|variance_table|actuals_table|budget_table|total_actual|total_budget|total_variance|total_variance_pct|top_unfavorable|top_favorable|dimensions|data_rows_count|comparison_period|comparison_table|comparison_total_variance|yoy_change|extra_context)\}\}/g;

export const boardPromptTemplateSchema = z.string()
  .max(20_000, "Analysis prompt must be at most 20000 characters")
  .transform((value) => value.normalize("NFC"))
  .refine((value) => {
    const withoutKnownPlaceholders = value.replace(BOARD_PROMPT_PLACEHOLDER, "");
    return !withoutKnownPlaceholders.includes("{{")
      && !withoutKnownPlaceholders.includes("}}")
      && isSafeDisplayText(withoutKnownPlaceholders);
  }, "Analysis prompt contains an unsupported placeholder or unsafe content");

export const boardTitleSchema = z.string()
  .max(200, "Board title must be at most 200 characters")
  .transform((value) => value.normalize("NFC").trim())
  .refine((value) => value.length > 0, "Board title is required")
  .refine(isSafeDisplayText, "Board title contains unsafe characters or content");
export const boardDescriptionSchema = safeDisplayText("Board description", 2000, true)
  .nullable()
  .optional();

const boardSettingText = safeDisplayText("Board setting", 5000);
const boardVersionName = safeDisplayText("Board version", 255);

export const boardSettingsSchema = z.object({
  analysisPrompts: boardSettingText.optional(),
  templateKey: z.enum([
    "entity-pnl",
    "kpi-metrics",
    "variance-analysis",
    "trend-analysis",
    "balance-sheet-tracker",
    "audit-preparation",
    "cashflow-monitoring",
    "company-research",
    "custom-kpi-board",
    "financial-ratios-dashboard",
    "investor-updates",
    "quarterly-pnl-review",
  ]).optional(),
  cubeId: z.string().uuid("cubeId must be a UUID").optional(),
  columnMapping: z.object({
    actuals: boardVersionName.optional(),
    budget: boardVersionName.optional(),
    forecast: boardVersionName.optional(),
    rollingForecasts: z.array(boardVersionName).max(100).optional(),
  }).strict().optional(),
  dataSources: z.object({
    enterprise: z.boolean().optional(),
    vault: z.boolean().optional(),
    webApis: z.boolean().optional(),
    financialApis: z.boolean().optional(),
  }).strict().optional(),
  boardFlow: z.object({
    comparisonBasis: z.enum([
      "previous-period",
      "same-period-last-year",
      "opening-position",
      "specific-period",
    ]).optional(),
    scope: z.object({
      entity: boardVersionName.optional(),
      version: boardVersionName.optional(),
      year: z.string().regex(/^\d{4}$/, "Scope year must be four digits").optional(),
      month: z.string().regex(/^(?:[1-9]|1[0-2])$/, "Scope month must be 1-12").optional(),
      forecastScenario: boardVersionName.optional(),
    }).strict().optional(),
    reportTemplate: boardSettingText.optional(),
  }).strict().optional(),
}).strict();

const boardFields = {
  title: boardTitleSchema,
  description: boardDescriptionSchema,
  templateId: z.string().uuid("templateId must be a UUID").nullable().optional(),
  settings: boardSettingsSchema.nullable().optional(),
};

export const createBoardDtoSchema = z.object({
  ...boardFields,
  title: boardTitleSchema,
}).strict();

export const updateBoardDtoSchema = z.object(boardFields).strict()
  .refine((value) => Object.keys(value).length > 0, "At least one board field is required");

export const boardSourceSelectionSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("enterprise"),
    cubeId: z.string().min(1).max(255),
    version: safeDisplayText("Source version", 200, true).optional(),
    entity: safeDisplayText("Source entity", 200, true).optional(),
  }).strict(),
  z.object({
    sourceType: z.literal("vault"),
    documentId: z.string().min(1).max(255),
  }).strict(),
]);

export const boardKeyColumnSchema = z.object({
  column: safeDisplayText("Column", 200, true),
  label: safeDisplayText("Column label", 200, true),
  aggregation: z.enum(["sum", "last", "latest", "average", "min", "max", "count", "ratio"]).optional(),
  valueType: z.enum(["currency", "percentage", "count", "ratio", "number"]).optional(),
  favorability: z.enum(["higher-is-favorable", "lower-is-favorable", "neutral"]).optional(),
  numerator: safeDisplayText("Ratio numerator", 200, true).optional(),
  denominator: safeDisplayText("Ratio denominator", 200, true).optional(),
  dimension: safeDisplayText("Dimension", 200, true).nullable().optional(),
  dimensionValues: z.array(safeDisplayText("Dimension value", 200, true)).max(200).optional(),
}).strict();

export const boardAnalysisRequestSchema = z.object({
  year: z.number().int().min(1900).max(2200).optional(),
  months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  keyColumns: z.array(boardKeyColumnSchema).max(50).optional(),
  scopeMode: z.enum(["all", "selected", "exclude", "all-except"]).optional(),
  excludedColumns: z.array(safeDisplayText("Excluded column", 200, true)).max(200).optional(),
  comparison: z.object({
    year: z.number().int().min(1900).max(2200),
    months: z.array(z.number().int().min(1).max(12)).min(1).max(12),
    label: safeDisplayText("Comparison label", 200, true).optional(),
  }).strict().optional(),
  sourceSelection: boardSourceSelectionSchema.optional(),
  extraContext: safeDisplayText("Extra context", 10_000).optional(),
  userPromptTemplate: boardPromptTemplateSchema.optional(),
  dimensions: z.array(safeDisplayText("Dimension", 100, true)).max(20).optional(),
}).strict();

export const boardAnalysisConfigSchema = z.object({
  templateKey: safeDisplayText("Template key", 100, true),
  analysisPrompt: safeDisplayText("Analysis prompt", 20_000).nullable().optional(),
  sourceType: z.enum(["enterprise", "vault"]),
  sourceSelection: boardSourceSelectionSchema,
  scopeMode: z.enum(["all", "selected", "exclude", "all-except"]).optional(),
  keyColumns: z.array(boardKeyColumnSchema).max(50).optional(),
  excludedColumns: z.array(safeDisplayText("Excluded column", 200, true)).max(200).optional(),
  timeGranularity: z.enum(["auto", "monthly", "quarterly", "yearly"]).optional(),
  comparisonBasis: z.record(z.unknown()).optional(),
}).strict();

const CUBE_NAME_CHARACTERS = /^[A-Za-z0-9 _&().,/'-]+$/;

export const cubeNameSchema = z.string()
  .max(60, "Cube name must be at most 60 characters")
  .transform((value) => value.normalize("NFC").trim())
  .refine((value) => value.length > 0, "Cube name is required")
  .refine(isSafeDisplayText, "Cube name contains unsafe characters or content")
  .refine(
    (value) => CUBE_NAME_CHARACTERS.test(value),
    "Cube name may contain letters, numbers, spaces, and . , - _ & ( ) / ' only",
  );

export const cubeDescriptionSchema = safeDisplayText("Cube description", 280, true)
  .nullable()
  .optional();

const cubeMutableFields = {
  name: cubeNameSchema.optional(),
  description: cubeDescriptionSchema,
  sourceType: z.string().max(50).optional(),
  connectorId: z.string().max(255).nullable().optional(),
  ingestionConfig: z.union([z.record(z.unknown()), z.string()]).nullable().optional(),
};

export const createCubeDtoSchema = z.object({
  ...cubeMutableFields,
  name: cubeNameSchema,
  domainId: z.string().max(255).optional(),
  schemaType: z.enum(["kpi", "investment_capex_pmo"]).optional().default("kpi"),
  ingestionConfig: z.record(z.unknown()).nullable().optional(),
}).strict();

export const updateCubeDtoSchema = z.object(cubeMutableFields).strict()
  .refine((value) => Object.keys(value).length > 0, "At least one cube field is required");

export function validateEnterpriseDisplayName(name: string): string | null {
  if (!name || Buffer.byteLength(name, "utf8") > 255) {
    return "File name must be between 1 and 255 bytes.";
  }
  // Check raw, encoded, and double-encoded variants so traversal cannot be
  // hidden from validation and decoded by a later consumer.
  if (decodedVariants(name).some((candidate) => /[\\/]/.test(candidate))) {
    return "File name must not contain a path.";
  }
  if (!isSafeDisplayText(name)) return "File name contains unsafe characters or content.";
  if (name === "." || name === ".." || /^[.\s]+$/.test(name)) return "File name is not valid.";
  return null;
}