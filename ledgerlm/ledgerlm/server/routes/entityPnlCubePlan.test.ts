import assert from "node:assert/strict";
import test, { mock } from "node:test";
import express from "express";
import ExcelJS from "exceljs";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../db";
import { storage } from "../storage";
import { registerEntityPnlCubePlanRoutes } from "./entityPnlCubePlan";
import { requireRecentAdminStepUp } from "../middleware/adminStepUp";

test("upload API protects domain/step-up, previews, persists, reloads, and rejects stale or changed imports", async () => {
  let saved: any;
  let queries = 0;
  const cubeMock = mock.method(storage, "getCube", async (id: string) => ({
    id, domainId: id === "other-domain" ? "domain-b" : "domain-a", name: "Test cube", schemaType: "kpi",
  }));
  const queryMock = mock.method(db, "execute", async (query: any) => {
    queries++;
    const q = new PgDialect().sqlToQuery(query);
    assert.doesNotMatch(q.sql, /\bDELETE\b|cube_fact_data|cube_plan_data|\bboards\b/);
    if (q.sql.includes("INSERT INTO")) {
      const expectedRevision = q.params.at(-1);
      if ((saved?.revision ?? 0) !== expectedRevision) return { rows: [] };
      const incoming = JSON.parse(String(q.params[2]));
      const hash = q.params[3];
      const revision = saved && saved.hash === hash ? saved.revision : (saved?.revision ?? 0) + 1;
      saved = { plan_data: incoming, revision, hash, updated_at: "2026-10-08T00:00:00Z" };
      return { rows: [saved] };
    }
    return { rows: saved ? [saved] : [] };
  });
  const app = express();
  registerEntityPnlCubePlanRoutes(app, (req, res, next) => {
    if (req.headers["x-test-admin"] !== "yes") return void res.status(401).json({ error: "Authentication required" });
    (req as any).domain = { id: "domain-a" };
    (req as any).session = { userId: "test-admin",
      ...(req.headers["x-test-step-up"] === "yes" ? { adminStepUp: { userId: "test-admin", verifiedAt: Date.now() } } : {}),
    };
    next();
  }, requireRecentAdminStepUp);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const path = "/api/domain-admin/cubes/test-cube/entity-pnl-plan";
  // Synthetic fixture: CI never requires private user-uploaded documents.
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plan Entity P&L");
  sheet.addRow(["Entity ", "FiscalYear", "Month", "Category", "Sub_Category", "BP", "CF02", "CF05", "CF09", "CF11"]);
  for (let month = 1; month <= 12; month++) {
    sheet.addRow(["BGSW", 2026, month, "Revenue", "Revenue from services", null, month === 7 ? null : month, month * 2, null, null]);
  }
  const bytes = await workbook.xlsx.writeBuffer();
  const settings = { entity: "BGSW", confirmedBasis: "mINR-ytd", usdExchangeRates: { "CF05 2026": 86.96 } };
  const send = (action: string, options: any, headers: Record<string, string> = {}, target = path) => {
    const body = new FormData();
    body.append("file", new Blob([new Uint8Array(bytes)]), "Plan_EntityPL_Board_1791440004190.xlsx");
    body.append("options", JSON.stringify(options));
    return fetch(`${origin}${target}/${action}`, { method: "POST", body, headers });
  };
  try {
    assert.equal((await send("preview", settings)).status, 401);
    assert.equal((await send("preview", settings, { "x-test-admin": "yes" }, "/api/domain-admin/cubes/other-domain/entity-pnl-plan")).status, 403);
    assert.equal((await send("import", settings, { "x-test-admin": "yes" })).status, 403);
    assert.equal(queries, 0);
    assert.equal((await send("preview", { ...settings, confirmedBasis: "unknown" }, { "x-test-admin": "yes" })).status, 400);
    const previewResponse = await send("preview", settings, { "x-test-admin": "yes" });
    assert.equal(previewResponse.status, 200);
    const preview: any = await previewResponse.json();
    assert.equal(preview.records, 24);
    assert.deepEqual(preview.scenarios.map((s: any) => s.scenario), ["CF02 2026", "CF05 2026"]);
    const importSettings = { ...settings, expectedRevision: preview.revision, previewHash: preview.previewHash };
    const headers = { "x-test-admin": "yes", "x-test-step-up": "yes" };
    const imported = await send("import", importSettings, headers);
    assert.equal(imported.status, 201);
    assert.equal((await imported.json() as any).revision, 1);
    const reload: any = await (await fetch(`${origin}${path}?entity=BGSW`, { headers })).json();
    assert.equal(reload.plan.revision, 1);
    assert.equal(reload.plan.records, 24);
    assert.equal((await send("import", importSettings, headers)).status, 409);
    const fresh: any = await (await send("preview", settings, headers)).json();
    const reimported = await send("import", { ...settings, expectedRevision: fresh.revision, previewHash: fresh.previewHash }, headers);
    assert.equal(reimported.status, 201);
    assert.equal((await reimported.json() as any).revision, 1);
    assert.equal((await send("import", { ...settings, usdExchangeRates: {}, expectedRevision: 1, previewHash: fresh.previewHash }, headers)).status, 409);
    assert.equal(saved.revision, 1);
    const monthlySettings = { ...settings, confirmedBasis: "mINR-mtd" };
    const monthlyPreview: any = await (await send("preview", monthlySettings, headers)).json();
    assert.equal(monthlyPreview.periodBasis, "mtd");
    assert.notEqual(monthlyPreview.previewHash, fresh.previewHash);
    // Changing the source basis invalidates the old preview; no mutation occurs.
    assert.equal((await send("import", { ...monthlySettings, expectedRevision: 1, previewHash: fresh.previewHash }, headers)).status, 409);
    const monthlyImport = await send("import", { ...monthlySettings, expectedRevision: monthlyPreview.revision, previewHash: monthlyPreview.previewHash }, headers);
    assert.equal(monthlyImport.status, 201);
    assert.equal((await monthlyImport.json() as any).periodBasis, "mtd");
    const monthlyReload: any = await (await fetch(`${origin}${path}?entity=BGSW`, { headers })).json();
    assert.equal(monthlyReload.plan.periodBasis, "mtd");
    assert.equal(monthlyReload.plan.revision, 2);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    cubeMock.mock.restore(); queryMock.mock.restore();
  }
});
