import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { parseEntityPnlFinancialPlanWorkbook } from "../server/services/entityPnlFinancialPlanService";

/** Explicit, board-local import. Dry run by default; never writes cube facts or schema. */
async function main() {
  const { values } = parseArgs({
    options: {
      workbook: { type: "string" }, "board-id": { type: "string" },
      "cube-id": { type: "string" }, apply: { type: "boolean", default: false },
    },
  });
  if (!values.workbook || !values["board-id"] || !values["cube-id"]) {
    throw new Error("Provide --workbook, --board-id, --cube-id; add --apply only for the approved board-local import.");
  }
  const plan = await parseEntityPnlFinancialPlanWorkbook(await readFile(values.workbook), {
    entity: "BGSW",
    sourceName: basename(values.workbook).replace(/_\d{10,}(?=\.xlsx$)/i, ""),
    usdExchangeRates: { "CF05 2026": 86.96 },
  });
  const result = await db.execute(sql`SELECT settings FROM boards WHERE id = ${values["board-id"]}`);
  const board = result.rows[0] as { settings?: Record<string, any> } | undefined;
  if (!board?.settings || board.settings.templateKey !== "entity-pnl"
    || board.settings.cubeId !== values["cube-id"]) {
    throw new Error("Board must be the explicitly selected Entity P&L board linked to the expected cube.");
  }
  const summary = {
    entity: plan.entity, source: plan.sourceName, records: plan.rows.length,
    scenarios: Array.from(new Set(plan.rows.map((row) => row.scenario))),
    unit: plan.sourceUnit, periodBasis: plan.periodBasis, rates: plan.usdExchangeRates,
    changedScope: "BGSW only", writesSharedCube: false,
  };
  console.log(JSON.stringify(summary));
  if (!values.apply) return console.log("Dry run only; no data changed.");
  const oldSettings = board.settings;
  const newSettings = {
    ...oldSettings,
    entityPnlFinancialPlan: plan,
    boardFlow: {
      ...oldSettings.boardFlow,
      scope: { ...oldSettings.boardFlow?.scope, entity: "BGSW" },
    },
  };
  // Optimistic guard protects concurrent edits. Change only this board's configuration.
  const updated = await db.execute(sql`
    UPDATE boards SET settings = ${JSON.stringify(newSettings)}::jsonb
    WHERE id = ${values["board-id"]} AND settings = ${JSON.stringify(oldSettings)}::jsonb
    RETURNING id
  `);
  if (updated.rows.length !== 1) throw new Error("Board changed during import; no update applied. Re-read before retrying.");
  console.log("Financial plan attached to this Entity P&L board; BGSW selected. Existing reports and shared cube data were preserved.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Financial plan import failed.");
  process.exitCode = 1;
});
