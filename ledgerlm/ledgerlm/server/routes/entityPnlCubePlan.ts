import type { Express, RequestHandler } from "express";
import multer from "multer";
import { storage } from "../storage";
import { entityPnlCubePlanUploadSchema } from "../../shared/entityPnlCubePlan";
import { EntityPnlCubePlanError, parseCubePlan, readCubeEntityPnlPlan, saveCubeEntityPnlPlan, summarizeCubePlan } from "../services/entityPnlCubePlanService";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10_000_000, files: 1, fields: 2, fieldSize: 10_000 } }).single("file");

export function registerEntityPnlCubePlanRoutes(app: Express, requireAdmin: RequestHandler, requireStepUp: RequestHandler) {
  const base = "/api/domain-admin/cubes/:cubeId/entity-pnl-plan";
  const authorize: RequestHandler = async (req, res, next) => {
    try {
      const cube = await storage.getCube(req.params.cubeId);
      if (!cube) return void res.status(404).json({ error: "Cube not found" });
      if (!(req as any).isSuperAdmin && cube.domainId !== (req as any).domain?.id) {
        return void res.status(403).json({ error: "Cannot access another domain's cube" });
      }
      if (cube.schemaType && cube.schemaType !== "kpi") return void res.status(400).json({ error: "Entity P&L plans require a KPI/financial Actual cube, not a Balance Sheet or investment cube." });
      next();
    } catch { res.status(500).json({ error: "Unable to verify cube access" }); }
  };
  const multipart: RequestHandler = (req, res, next) => upload(req, res, (error) => {
    if (error) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Upload one .xlsx file, at most 10 MB." });
    next();
  });
  const fail = (res: any, error: unknown) => {
    if (error instanceof EntityPnlCubePlanError) return res.status(error.status).json({ error: error.message });
    if ((error as any)?.name === "ZodError") return res.status(400).json({ error: "Invalid Entity P&L workbook or upload settings." });
    if ((error as any)?.code || (error as any)?.cause?.code) return res.status(503).json({ error: "Entity P&L planning storage is unavailable. Verify its additive migration; no shared data was changed." });
    return res.status(400).json({ error: (error as Error)?.message || "Unable to process Entity P&L workbook." });
  };

  app.get(base, requireAdmin, authorize, async (req, res) => {
    try {
      const entity = String(req.query.entity ?? "").trim();
      if (!entity || entity.length > 200) throw new EntityPnlCubePlanError("Specify an entity.");
      const saved = await readCubeEntityPnlPlan(req.params.cubeId, entity);
      res.json({ plan: saved ? summarizeCubePlan(saved.plan, saved.revision, saved.updatedAt) : null });
    } catch (error) { fail(res, error); }
  });

  for (const action of ["preview", "import"] as const) {
    const middlewares = action === "import" ? [requireAdmin, authorize, requireStepUp, multipart] : [requireAdmin, authorize, multipart];
    app.post(`${base}/${action}`, ...middlewares, async (req, res) => {
      try {
        if (!req.file) throw new EntityPnlCubePlanError("Select an Entity P&L .xlsx workbook.");
        let options;
        try { options = entityPnlCubePlanUploadSchema.parse(JSON.parse(req.body.options)); }
        catch { throw new EntityPnlCubePlanError("Confirm mINR and the monthly MTD or cumulative YTD source basis; provide valid upload settings."); }
        const plan = await parseCubePlan(req.file.buffer, {
          periodBasis: options.confirmedBasis === "mINR-mtd" ? "mtd" : "ytd",
          entity: options.entity, sourceName: req.file.originalname, usdExchangeRates: options.usdExchangeRates,
        });
        if (action === "preview") {
          const current = await readCubeEntityPnlPlan(req.params.cubeId, plan.entity);
          res.json(summarizeCubePlan(plan, current?.revision ?? 0, current?.updatedAt ?? null));
        } else {
          if (options.expectedRevision === undefined || !options.previewHash) throw new EntityPnlCubePlanError("Preview before importing.");
          const result = await saveCubeEntityPnlPlan(req.params.cubeId, plan, options.expectedRevision, options.previewHash, req.session.userId!);
          res.status(201).json(result);
        }
      } catch (error) { fail(res, error); }
    });
  }
}
