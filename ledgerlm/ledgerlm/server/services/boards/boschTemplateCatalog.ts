import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { domainBoardTemplateOverrides as masters, boardTemplates } from "../../../shared/schema";
import { BoardTemplateError, boardTemplateHash } from "./boardTemplateGovernance";

export const BOSCH_TEMPLATE_DEFINITIONS = [
  { templateSlug: "kpi-metrics", name: "KPI Metrics" },
  { templateSlug: "balance-sheet-tracker", name: "Balance Sheet Tracker" },
  { templateSlug: "entity-pnl", name: "Entity P&L" },
] as const;
export type BoschTemplateSlug = typeof BOSCH_TEMPLATE_DEFINITIONS[number]["templateSlug"];
export type BoschMaster = typeof masters.$inferSelect;

export function isBoschTemplateSlug(value: unknown): value is BoschTemplateSlug {
  return BOSCH_TEMPLATE_DEFINITIONS.some((definition) => definition.templateSlug === value);
}

/** Defaults come only from the catalog, never from an arbitrary user's My Board. */
export async function initializeBoschMasterTemplates(): Promise<void> {
  await db.execute(sql`
    INSERT INTO domain_board_template_overrides
      (domain_id, template_slug, report_template, report_template_pptx_base64)
    SELECT d.id, t.slug,
      CASE WHEN t.slug = 'balance-sheet-tracker' THEN ''
        ELSE coalesce(t.default_config->'boardFlow'->>'reportTemplate', '') END,
      CASE WHEN t.slug = 'balance-sheet-tracker' THEN NULL
        ELSE nullif(t.default_config->'boardFlow'->>'reportTemplatePptxBase64', '') END
    FROM domains d CROSS JOIN board_templates t
    WHERE lower(d.name) = 'bosch.com'
      AND t.slug IN ('kpi-metrics', 'balance-sheet-tracker', 'entity-pnl')
    ON CONFLICT (domain_id, template_slug) DO NOTHING
  `);
}

export async function getBoschMasterTemplates(domainId: string): Promise<BoschMaster[]> {
  let rows = await db.select().from(masters).where(eq(masters.domainId, domainId));
  if (rows.length !== BOSCH_TEMPLATE_DEFINITIONS.length) {
    await initializeBoschMasterTemplates();
    rows = await db.select().from(masters).where(eq(masters.domainId, domainId));
  }
  if (rows.length !== BOSCH_TEMPLATE_DEFINITIONS.length) {
    throw new BoardTemplateError("Bosch template definitions are not ready. Please retry after initialization.", 503);
  }
  return BOSCH_TEMPLATE_DEFINITIONS.map(({ templateSlug }) => rows.find((row) => row.templateSlug === templateSlug)!);
}

function masterSettings(master: BoschMaster) {
  return { boardFlow: { reportTemplate: master.reportTemplate,
    reportTemplatePptxBase64: master.reportTemplatePptxBase64 ?? "" },
  boardTemplateAdministration: { revision: master.revision } };
}

export function boschMasterMetadata(master: BoschMaster) {
  const definition = BOSCH_TEMPLATE_DEFINITIONS.find((item) => item.templateSlug === master.templateSlug);
  if (!definition) throw new BoardTemplateError("Unsupported Bosch template.", 400);
  return { ...definition, templateKey: master.templateSlug,
    hasPptx: !!master.reportTemplatePptxBase64, fileName: master.fileName,
    revision: master.revision, updatedAt: master.updatedAt?.toISOString() ?? null };
}

export function boschMasterDetail(master: BoschMaster) {
  return { ...boschMasterMetadata(master), reportTemplate: master.reportTemplate,
    expectedHash: boardTemplateHash(masterSettings(master)) };
}

export async function getBoschMasterTemplate(domainId: string, slug: string): Promise<BoschMaster> {
  if (!isBoschTemplateSlug(slug)) throw new BoardTemplateError("Select one of the three Bosch templates, not a user Board.", 400);
  return (await getBoschMasterTemplates(domainId)).find((row) => row.templateSlug === slug)!;
}

export async function saveBoschMasterTemplate(master: BoschMaster, input: {
  expectedHash: string; reportTemplate?: string; reportTemplatePptxBase64?: string;
  clearPptx?: boolean; fileName?: string;
}, userId: string): Promise<BoschMaster> {
  if (master.templateSlug === "balance-sheet-tracker") {
    throw new BoardTemplateError("Balance Sheet uses the corrected built-in renderer and cannot be overridden.", 400);
  }
  if (input.expectedHash !== boschMasterDetail(master).expectedHash) {
    throw new BoardTemplateError("The template changed. Discard changes and reload before saving.", 409);
  }
  if (input.clearPptx && input.reportTemplatePptxBase64 !== undefined) {
    throw new BoardTemplateError("Choose a replacement PowerPoint or remove it, not both.", 400);
  }
  const rows = await db.update(masters).set({
    ...(input.reportTemplate !== undefined ? { reportTemplate: input.reportTemplate } : {}),
    ...(input.reportTemplatePptxBase64 !== undefined
      ? { reportTemplatePptxBase64: input.reportTemplatePptxBase64, fileName: input.fileName ?? null }
      : input.clearPptx ? { reportTemplatePptxBase64: null, fileName: null } : {}),
    revision: master.revision + 1, updatedBy: userId, updatedAt: new Date(),
  }).where(and(eq(masters.domainId, master.domainId), eq(masters.templateSlug, master.templateSlug),
    eq(masters.revision, master.revision))).returning();
  if (!rows[0]) throw new BoardTemplateError("The template changed while saving. Reload and try again.", 409);
  return rows[0];
}

/** Copy-on-creation only. Never call this on ordinary edits or report runs. */
export function inheritBoschMasterTemplate(settings: unknown, master: BoschMaster) {
  const current = settings && typeof settings === "object" ? settings as Record<string, any> : {};
  const flow = current.boardFlow && typeof current.boardFlow === "object" ? current.boardFlow : {};
  return { ...current, templateKey: master.templateSlug, boardFlow: {
    ...flow,
    reportTemplate: master.templateSlug === "balance-sheet-tracker" ? "" : master.reportTemplate,
    reportTemplatePptxBase64: master.templateSlug === "balance-sheet-tracker"
      ? undefined : master.reportTemplatePptxBase64 ?? undefined,
  } };
}

/** Read-only wizard defaults: show text/metadata without sending large PowerPoint files. */
export async function boschTemplateDefaults(domainId: string, templates: typeof boardTemplates.$inferSelect[]) {
  const catalog = await getBoschMasterTemplates(domainId);
  return templates.map((template) => {
    const master = catalog.find((row) => row.templateSlug === template.slug);
    if (!master) return template;
    const config = (template.defaultConfig ?? {}) as Record<string, any>;
    return { ...template, defaultConfig: { ...config,
      boardFlow: { ...(config.boardFlow ?? {}), reportTemplate: master.reportTemplate,
        reportTemplatePptxBase64: undefined },
      managedReportTemplate: boschMasterMetadata(master),
    } };
  });
}
