import type { Express, RequestHandler } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { storage } from "../storage";
import { boards, users, domainUsers, domains } from "../../shared/schema";
import { boardSettingsSchema } from "../../shared/inputValidators";
import { requireRecentAdminStepUp } from "../middleware/adminStepUp";
import { writeAuditLog, extractIp } from "../services/auditLogger";
import {
  BoardTemplateError, isBoschDomain, validateBoardTemplatePptx,
} from "../services/boards/boardTemplateGovernance";
import {
  getBoschMasterTemplates, getBoschMasterTemplate, boschMasterMetadata,
  boschMasterDetail, saveBoschMasterTemplate,
} from "../services/boards/boschTemplateCatalog";

const flowSchema = boardSettingsSchema.shape.boardFlow.unwrap();
const editSchema = flowSchema.pick({ reportTemplate: true, reportTemplatePptxBase64: true }).extend({
  expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
  clearPptx: z.boolean().optional(),
  fileName: z.string().min(1).max(255).refine((value) => !/[\u0000-\u001f]/.test(value)).optional(),
}).strict();

export async function getBoschBoardDomain(userId: string): Promise<string | null> {
  const rows = await db.select({ id: domains.id }).from(users)
    .innerJoin(domainUsers, sql`lower(${users.username}) = lower(${domainUsers.email})`)
    .innerJoin(domains, eq(domainUsers.domainId, domains.id))
    .where(and(eq(users.id, userId), sql`lower(${domains.name}) = 'bosch.com'`)).limit(1);
  return rows[0]?.id ?? null;
}

export async function isBoschBoardUser(userId: string): Promise<boolean> {
  return !!await getBoschBoardDomain(userId);
}

async function boschAdminDomain(req: any) {
  if (isBoschDomain(req.domain?.name)) return req.domain.id as string;
  if (req.isSuperAdmin) {
    const domain = await storage.getDomainByName("bosch.com");
    if (domain) return domain.id;
  }
  throw new BoardTemplateError("Board template administration is currently available for Bosch administrators only.");
}

/** Compare-and-swap prevents ordinary edits and admin uploads overwriting one another. */
export async function updateBoardIfUnchanged(board: typeof boards.$inferSelect,
  changes: Partial<typeof boards.$inferInsert>) {
  const rows = await db.update(boards).set(changes).where(and(eq(boards.id, board.id),
    sql`${boards.settings} IS NOT DISTINCT FROM ${board.settings == null ? null : JSON.stringify(board.settings)}::jsonb`,
    eq(boards.title, board.title),
    sql`${boards.description} IS NOT DISTINCT FROM ${board.description}`,
    sql`${boards.templateId} IS NOT DISTINCT FROM ${board.templateId}`,
  )).returning();
  if (!rows[0]) throw new BoardTemplateError("The Board changed while you were editing. Reload it and try again.", 409);
  return rows[0];
}

function failure(res: any, error: unknown) {
  if (error instanceof BoardTemplateError) return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid template fields. Check the text length, file size, and template version." });
  console.error("Board template administration failed");
  return res.status(500).json({ error: "Unable to manage the Board template." });
}

export function registerBoardTemplateAdministration(app: Express, requireActiveAdmin: RequestHandler) {
  app.get("/api/domain-admin/board-templates", requireActiveAdmin, async (req, res) => {
    try {
      const domainId = await boschAdminDomain(req);
      const rows = await getBoschMasterTemplates(domainId);
      res.setHeader("Cache-Control", "no-store");
      res.json({ templates: rows.map(boschMasterMetadata), lockedDomain: "bosch.com" });
    } catch (error) { failure(res, error); }
  });
  app.get("/api/domain-admin/board-templates/:templateSlug", requireActiveAdmin, async (req, res) => {
    try {
      const master = await getBoschMasterTemplate(await boschAdminDomain(req), req.params.templateSlug);
      res.setHeader("Cache-Control", "no-store");
      res.json(boschMasterDetail(master));
    } catch (error) { failure(res, error); }
  });
  app.put("/api/domain-admin/board-templates/:templateSlug", requireActiveAdmin, requireRecentAdminStepUp, async (req, res) => {
    try {
      const domainId = await boschAdminDomain(req);
      const master = await getBoschMasterTemplate(domainId, req.params.templateSlug);
      const parsed = editSchema.parse(req.body);
      if (master.templateSlug === "balance-sheet-tracker") {
        throw new BoardTemplateError("Balance Sheet uses the managed built-in layout; uploaded PowerPoints cannot override it.", 400);
      }
      if (parsed.reportTemplatePptxBase64) validateBoardTemplatePptx(parsed.reportTemplatePptxBase64);
      const updated = await saveBoschMasterTemplate(master, parsed, req.session!.userId!);
      await writeAuditLog({ userId: req.session!.userId, action: "ADMIN_BOARD_TEMPLATE_UPDATE",
        resource: "bosch_template", resourceId: master.templateSlug, ipAddress: extractIp(req),
        details: { domainId, revision: updated.revision, hasPptx: !!updated.reportTemplatePptxBase64 } });
      res.json(boschMasterDetail(updated));
    } catch (error) { failure(res, error); }
  });
}
