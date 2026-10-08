import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { EntityPnlCubePlanError, parseCubePlan, readCubeEntityPnlPlan, saveCubeEntityPnlPlan, selectFinancialPlan, summarizeCubePlan, validateWorkbookArchive } from "./entityPnlCubePlanService";
import type { EntityPnlFinancialPlan } from "../../shared/entityPnlPlanning";
import { entityPnlCubePlanUploadSchema } from "../../shared/entityPnlCubePlan";

const plan: EntityPnlFinancialPlan = {
  version: 1, entity: "BGSW", sourceName: "plan.xlsx", sourceUnit: "mINR", periodBasis: "ytd",
  usdExchangeRates: { "CF05 2026": 86.96 },
  rows: [{ year: 2026, month: 7, category: "Revenue", subcategory: "Revenue from services", scenario: "CF05 2026", value: 100 }],
};

test("requires explicit unit/basis confirmation and finite approved rates", () => {
  assert.equal(entityPnlCubePlanUploadSchema.safeParse({ entity: "BGSW" }).success, false);
  assert.equal(entityPnlCubePlanUploadSchema.safeParse({ entity: "BGSW", confirmedBasis: "mINR-ytd", usdExchangeRates: { "CF05 2026": -1 } }).success, false);
  assert.equal(entityPnlCubePlanUploadSchema.safeParse({ entity: "BGSW", confirmedBasis: "mINR-ytd" }).success, true);
});
test("hash binds the validated plan, FX settings and source identity", () => {
  const summary = summarizeCubePlan(plan);
  assert.equal(summary.previewHash, summarizeCubePlan(structuredClone(plan)).previewHash);
  assert.notEqual(summary.previewHash, summarizeCubePlan({ ...plan, usdExchangeRates: {} }).previewHash);
  assert.equal(summary.scenarios[0].populated, 1);
});
test("cube plan supersedes board attachment; legacy fallback only without cube plan", () => {
  const old = { ...plan, sourceName: "older.xlsx" };
  assert.equal(selectFinancialPlan("bgsw", plan, old), plan);
  assert.equal(selectFinancialPlan("BGSW", undefined, old)?.sourceName, "older.xlsx");
  assert.equal(selectFinancialPlan(undefined, undefined, undefined), undefined);
  assert.throws(() => selectFinancialPlan("BGSV", plan, old), /mismatch/);
});
test("reader is entity/cube scoped and only absent-table errors preserve legacy deployments", async () => {
  const saved = await readCubeEntityPnlPlan("cube-id", " BGSW ", async (query) => {
    const q = new PgDialect().sqlToQuery(query);
    assert.deepEqual(q.params, ["cube-id", "bgsw"]);
    assert.match(q.sql, /FROM cube_entity_pnl_plan_data/);
    assert.doesNotMatch(q.sql, /cube_fact_data|cube_plan_data/);
    return { rows: [{ plan_data: plan, revision: 2, updated_at: "2026-10-08" }] };
  });
  assert.equal(saved?.revision, 2);
  assert.equal(await readCubeEntityPnlPlan("cube", "BGSW", async () => { throw { cause: { code: "42P01" } }; }), undefined);
  await assert.rejects(readCubeEntityPnlPlan("cube", "BGSW", async () => { throw new Error("network failed"); }), /network failed/);
});
test("import uses one conditional statement and never writes shared datasets or boards", async () => {
  let calls = 0;
  const saved = await saveCubeEntityPnlPlan("cube", plan, 2, summarizeCubePlan(plan).previewHash, "admin", async (query) => {
    calls++;
    const q = new PgDialect().sqlToQuery(query);
    assert.match(q.sql, /INSERT INTO cube_entity_pnl_plan_data/);
    assert.match(q.sql, /ON CONFLICT \(cube_id, entity_key\) DO UPDATE/);
    assert.match(q.sql, /WHERE cube_entity_pnl_plan_data.revision =/);
    assert.doesNotMatch(q.sql, /\bDELETE\b|cube_fact_data|cube_plan_data|\bboards\b/);
    assert.ok(q.params.includes("cube")); assert.ok(q.params.includes("bgsw"));
    return { rows: [{ revision: 3, updated_at: "2026-10-08" }] };
  });
  assert.equal(calls, 1); assert.equal(saved.revision, 3);
});
test("changed preview and concurrent imports fail explicitly without overwriting", async () => {
  let calls = 0;
  await assert.rejects(saveCubeEntityPnlPlan("cube", plan, 0, "0".repeat(64), "admin", async () => { calls++; return { rows: [] }; }), /Preview again/);
  assert.equal(calls, 0);
  await assert.rejects(saveCubeEntityPnlPlan("cube", plan, 0, summarizeCubePlan(plan).previewHash, "admin", async () => ({ rows: [] })), (error: unknown) => error instanceof EntityPnlCubePlanError && error.status === 409);
});
test("invalid archives are rejected before ExcelJS parses them", () => {
  assert.throws(() => validateWorkbookArchive(Buffer.from("not Excel")), /valid .xlsx/);
  assert.throws(() => validateWorkbookArchive(Buffer.alloc(10_000_001)), /10 MB/);
});
test("new uploaded workbook retains July and other months, partial blanks and excludes empty scenarios", async (context) => {
  let bytes: Buffer;
  try { bytes = await readFile("../../attached_assets/Plan_EntityPL_Board_1791440004190.xlsx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    context.skip("Optional user-uploaded workbook is not included in code-only checkouts.");
    return;
  }
  const parsed = await parseCubePlan(bytes, { entity: "BGSW", sourceName: "Plan_EntityPL_Board.xlsx", usdExchangeRates: {} });
  const summary = summarizeCubePlan(parsed);
  assert.deepEqual(summary.scenarios.map((s) => s.scenario), ["CF02 2026", "CF05 2026"]);
  assert.deepEqual(summary.scenarios[0].months, Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(parsed.rows.filter((r) => r.month === 7 && r.scenario === "CF05 2026" && r.value !== null).length, 39);
  assert.equal(parsed.rows.filter((r) => r.month === 7 && r.scenario === "CF02 2026" && r.value === null).length, 3);
  await assert.rejects(parseCubePlan(bytes, { entity: "BGSV", sourceName: "plan.xlsx", usdExchangeRates: {} }), /not BGSV/);
});
