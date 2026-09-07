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