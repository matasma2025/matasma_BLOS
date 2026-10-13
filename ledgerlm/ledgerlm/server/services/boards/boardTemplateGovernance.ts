import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { unzipSync, strFromU8 } from "fflate";
import { XMLValidator } from "fast-xml-parser";

export const TEMPLATE_ADMIN_KEY = "boardTemplateAdministration";
const TEMPLATE_FIELDS = ["reportTemplate", "reportTemplatePptxBase64"] as const;
type Settings = Record<string, any>;
const object = (value: unknown): Settings =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Settings : {};

export class BoardTemplateError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}

export function isBoschDomain(name: unknown): boolean {
  return typeof name === "string" && name.toLowerCase() === "bosch.com";
}

/** Never expose the server-owned legacy export baseline to ordinary editors. */
export function publicBoardSettings(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { [TEMPLATE_ADMIN_KEY]: _private, ...settings } = object(value);
  return settings;
}

function templateFields(value: unknown) {
  const flow = object(object(value).boardFlow);
  return {
    reportTemplate: typeof flow.reportTemplate === "string" ? flow.reportTemplate : "",
    reportTemplatePptxBase64: typeof flow.reportTemplatePptxBase64 === "string" ? flow.reportTemplatePptxBase64 : "",
  };
}

/** Ordinary saves may echo unchanged fields or omit them, but cannot mutate them. */
export function protectBoardTemplateSettings(current: unknown, proposed: unknown): unknown {
  if (proposed === undefined) return current;
  const prior = object(current);
  const next = object(proposed);
  if (Object.hasOwn(next, TEMPLATE_ADMIN_KEY)) {
    throw new BoardTemplateError("Template administration is only available in Board Administration.");
  }
  const oldFlow = object(prior.boardFlow);
  const newFlow = object(next.boardFlow);
  const existing = templateFields(prior);
  if (proposed === null && TEMPLATE_FIELDS.some((key) => existing[key])) {
    throw new BoardTemplateError("The locked report template cannot be removed through Board settings.");
  }
  for (const key of TEMPLATE_FIELDS) {
    if (Object.hasOwn(newFlow, key) && newFlow[key] !== undefined
      && (newFlow[key] ?? "") !== existing[key]) {
      throw new BoardTemplateError("Report templates are locked. Use Board Administration to change them.");
    }
  }
  // Preserve only protected template fields, not unrelated period/source settings.
  const protectedFlow = Object.fromEntries(TEMPLATE_FIELDS
    .filter((key) => Object.hasOwn(oldFlow, key)).map((key) => [key, oldFlow[key]]));
  if (proposed === null && !Object.keys(protectedFlow).length && !prior[TEMPLATE_ADMIN_KEY]
    && !Object.hasOwn(prior, "entityPnlFinancialPlan")) return null;
  return {
    ...next,
    ...(Object.hasOwn(prior, "entityPnlFinancialPlan") ? { entityPnlFinancialPlan: prior.entityPnlFinancialPlan } : {}),
    ...((next.boardFlow || Object.keys(protectedFlow).length) ? {
      boardFlow: { ...newFlow, ...protectedFlow },
    } : {}),
    ...(prior[TEMPLATE_ADMIN_KEY] ? { [TEMPLATE_ADMIN_KEY]: prior[TEMPLATE_ADMIN_KEY] } : {}),
  };
}

/** Older editors echo server-owned financial plan metadata; accept echoes, not edits. */
export function stripUnchangedFinancialPlanEcho(current: unknown, body: unknown): unknown {
  const input = object(body);
  const settings = object(input.settings);
  if (!Object.hasOwn(settings, "entityPnlFinancialPlan")) return body;
  const prior = object(current);
  if (!Object.hasOwn(prior, "entityPnlFinancialPlan")
    || !isDeepStrictEqual(settings.entityPnlFinancialPlan, prior.entityPnlFinancialPlan)) {
    throw new BoardTemplateError("Financial plans must be changed through financial plan upload, not ordinary Board settings.");
  }
  const { entityPnlFinancialPlan: _plan, ...rest } = settings;
  return { ...input, settings: rest };
}

export function boardTemplateHash(settings: unknown): string {
  return createHash("sha256").update(JSON.stringify({
    ...templateFields(settings),
    revision: object(object(settings)[TEMPLATE_ADMIN_KEY]).revision ?? 0,
  })).digest("hex");
}

/** Keep template identity stable without breaking old clients that echo a null templateId. */
export function protectBoardTemplateIdentity<T extends { templateId?: string | null; settings?: unknown }>(
  current: { templateId: string | null; settings: unknown }, changes: T,
): T {
  const next = { ...changes };
  if (next.templateId === null && current.templateId) next.templateId = current.templateId;
  if (next.templateId !== undefined && next.templateId !== current.templateId) {
    throw new BoardTemplateError("A Board's template type cannot be changed through ordinary editing.");
  }
  const key = object(next.settings).templateKey;
  if (key !== undefined && key !== object(current.settings).templateKey) {
    throw new BoardTemplateError("A Board's template type cannot be changed through ordinary editing.");
  }
  return next;
}

export function boardTemplateMetadata(board: { id: string; title: string; settings: unknown }) {
  const settings = object(board.settings);
  const admin = object(settings[TEMPLATE_ADMIN_KEY]);
  return {
    id: board.id, title: board.title,
    templateKey: settings.templateKey ?? "variance-analysis",
    hasPptx: !!templateFields(settings).reportTemplatePptxBase64,
    fileName: typeof admin.fileName === "string" ? admin.fileName : null,
    revision: typeof admin.revision === "number" ? admin.revision : 0,
    updatedAt: typeof admin.updatedAt === "string" ? admin.updatedAt : null,
  };
}

export function boardTemplateDetail(board: { id: string; title: string; settings: unknown }) {
  return { ...boardTemplateMetadata(board), reportTemplate: templateFields(board.settings).reportTemplate,
    expectedHash: boardTemplateHash(board.settings) };
}

/** Existing uploads stay in the existing Board settings storage; no storage migration. */
export function administerBoardTemplate(current: unknown, input: {
  reportTemplate?: string; reportTemplatePptxBase64?: string; clearPptx?: boolean;
  fileName?: string; expectedHash: string;
}, userId: string, now = new Date().toISOString()) {
  if (input.expectedHash !== boardTemplateHash(current)) {
    throw new BoardTemplateError("The template changed. Reload it before saving.", 409);
  }
  if (input.clearPptx && input.reportTemplatePptxBase64) {
    throw new BoardTemplateError("Choose a replacement PowerPoint or clear it, not both.", 400);
  }
  const settings = object(current);
  const admin = object(settings[TEMPLATE_ADMIN_KEY]);
  const old = templateFields(settings);
  return {
    ...settings,
    boardFlow: {
      ...object(settings.boardFlow),
      ...(input.reportTemplate !== undefined ? { reportTemplate: input.reportTemplate } : {}),
      ...(input.reportTemplatePptxBase64 !== undefined
        ? { reportTemplatePptxBase64: input.reportTemplatePptxBase64 }
        : input.clearPptx ? { reportTemplatePptxBase64: undefined } : {}),
    },
    [TEMPLATE_ADMIN_KEY]: {
      ...admin,
      // Freeze only the old template, without changing old report records.
      legacyTemplate: admin.legacyTemplate ?? old,
      revision: (typeof admin.revision === "number" ? admin.revision : 0) + 1,
      updatedAt: now, updatedBy: userId,
      fileName: input.clearPptx ? null : input.fileName ?? admin.fileName ?? null,
    },
  };
}

/** Queue-time report snapshots win; pre-snapshot reports use their frozen legacy baseline. */
export function reportTemplateForExport(report: { configSnapshot?: unknown }, boardSettings: unknown) {
  const snapshot = object(report.configSnapshot);
  if (Object.hasOwn(snapshot, "boardSettings")) {
    return templateFields(snapshot.boardSettings).reportTemplatePptxBase64 || undefined;
  }
  const settings = object(boardSettings);
  const legacy = object(settings[TEMPLATE_ADMIN_KEY]).legacyTemplate;
  return (legacy ? object(legacy).reportTemplatePptxBase64
    : templateFields(settings).reportTemplatePptxBase64) || undefined;
}

export function validateBoardTemplatePptx(base64: string): void {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) {
    throw new BoardTemplateError("Upload a valid PowerPoint (.pptx) file up to 5 MB.", 400);
  }
  try {
    let expanded = 0, count = 0;
    const files = unzipSync(bytes, { filter: (file) => {
      expanded += file.originalSize; count++;
      if (expanded > 50 * 1024 * 1024 || count > 2048
        || file.name.startsWith("/") || file.name.split("/").includes("..")
        || /vbaProject|activeX/i.test(file.name)) throw new Error("Unsafe PowerPoint archive");
      return true;
    } });
    if (!files["[Content_Types].xml"] || !files["ppt/presentation.xml"]
      || !Object.keys(files).some((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
      throw new Error("Missing PowerPoint parts");
    }
    for (const [name, data] of Object.entries(files)) {
      if (!/\.(xml|rels)$/.test(name)) continue;
      const xml = strFromU8(data);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
        throw new Error("Invalid PowerPoint XML");
      }
    }
  } catch {
    throw new BoardTemplateError("The PowerPoint template is invalid, unsafe, or exceeds the expanded-size limit.", 400);
  }
}
