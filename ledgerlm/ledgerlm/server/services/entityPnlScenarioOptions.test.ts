import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../db";
import { getCubeVersions } from "./boardAnalysisService";
import type { EntityPnlFinancialPlan } from "../../shared/entityPnlPlanning";

test("Entity P&L options include only the selected cube/entity financial plan; generic versions stay unchanged", async () => {
  const plan: EntityPnlFinancialPlan = {
    version: 1, entity: "BGSW", sourceName: "fixture.xlsx", sourceUnit: "mINR", periodBasis: "ytd", usdExchangeRates: {},
    rows: [
      { year: 2026, month: 7, category: "Revenue", subcategory: "Revenue from services", scenario: "CF05 2026", value: 100 },
      { year: 2026, month: 7, category: "Revenue", subcategory: "Revenue from services", scenario: "CF02 2026", value: 90 },
      { year: 2026, month: 7, category: "Revenue", subcategory: "Revenue from services", scenario: "CF09 2026", value: null },
    ],
  };
  let financialReads = 0;
  let failure: unknown;
  const mocked = mock.method(db, "execute", async (query: any) => {
    const q = new PgDialect().sqlToQuery(query);
    if (q.sql.includes("cube_fact_data")) return { rows: [{ version: "Actual" }] };
    assert.match(q.sql, /FROM cube_entity_pnl_plan_data/);
    financialReads++;
    if (failure) throw failure;
    return { rows: q.params[0] === "july-cube" && q.params[1] === "bgsw"
      ? [{ plan_data: plan, revision: 1, updated_at: "2026-10-08" }] : [] };
  });
  try {
    assert.deepEqual(await getCubeVersions("july-cube"), ["Actual"]);
    assert.deepEqual(await getCubeVersions("july-cube", { entityPnlEntity: "  " }), ["Actual"]);
    assert.equal(financialReads, 0);
    assert.deepEqual(await getCubeVersions("july-cube", { entityPnlEntity: " BGSW " }), ["Actual", "CF02 2026", "CF05 2026"]);
    assert.deepEqual(await getCubeVersions("july-cube", { entityPnlEntity: "BGSV" }), ["Actual"]);
    assert.deepEqual(await getCubeVersions("another-cube", { entityPnlEntity: "BGSW" }), ["Actual"]);
    failure = { cause: { code: "42P01" } };
    assert.deepEqual(await getCubeVersions("july-cube", { entityPnlEntity: "BGSW" }), ["Actual"]);
    failure = new Error("storage connection failed");
    await assert.rejects(getCubeVersions("july-cube", { entityPnlEntity: "BGSW" }), /storage connection failed/);
    assert.deepEqual(await getCubeVersions("july-cube"), ["Actual"]);
  } finally { mocked.mock.restore(); }
});
