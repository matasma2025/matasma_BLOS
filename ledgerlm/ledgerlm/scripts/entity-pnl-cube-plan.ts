import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { runEntityPnlPlanMigration } from "../server/migrations/create-entity-pnl-plan-table";
import { parseCubePlan, readCubeEntityPnlPlan, saveCubeEntityPnlPlan, summarizeCubePlan } from "../server/services/entityPnlCubePlanService";

async function main() {
  const { values } = parseArgs({ options: {
    migrate: { type: "boolean" }, apply: { type: "boolean" }, workbook: { type: "string" },
    "cube-id": { type: "string" }, "cube-name": { type: "string" }, entity: { type: "string" },
    "confirmed-basis": { type: "string" }, "rates-json": { type: "string" },
  } });
  if (values.migrate) { await runEntityPnlPlanMigration(); console.log("Entity P&L-only additive migration completed."); return; }
  if (!values.workbook || !values["cube-id"] || !values["cube-name"] || !values.entity || values["confirmed-basis"] !== "mINR-ytd") {
    throw new Error("Provide --workbook --cube-id --cube-name --entity --confirmed-basis mINR-ytd. Dry run by default.");
  }
  const cube = (await db.execute(sql`SELECT name, schema_type FROM cubes WHERE id = ${values["cube-id"]} LIMIT 1`)).rows[0] as any;
  if (!cube || cube.name !== values["cube-name"] || cube.schema_type !== "kpi") throw new Error("Expected cube identity/type does not match.");
  const plan = await parseCubePlan(await readFile(values.workbook), {
    entity: values.entity, sourceName: basename(values.workbook), usdExchangeRates: JSON.parse(values["rates-json"] || "{}"),
  });
  const current = await readCubeEntityPnlPlan(values["cube-id"], plan.entity);
  const summary = summarizeCubePlan(plan, current?.revision ?? 0);
  console.log(JSON.stringify(summary, null, 2));
  if (!values.apply) return console.log("Dry run only; nothing changed.");
  const result = await saveCubeEntityPnlPlan(values["cube-id"], plan, summary.revision, summary.previewHash, "explicit-cli-import");
  console.log(JSON.stringify({ imported: true, cubeId: values["cube-id"], entity: result.entity, revision: result.revision }));
}
main().then(() => process.exit(0)).catch((error) => { console.error(error.message); process.exit(1); });
