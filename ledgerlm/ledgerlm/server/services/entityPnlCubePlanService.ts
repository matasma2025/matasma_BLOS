import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { parseEntityPnlFinancialPlanWorkbook, validateEntityPnlFinancialPlan } from "./entityPnlFinancialPlanService";
import type { EntityPnlFinancialPlan } from "../../shared/entityPnlPlanning";
import type { EntityPnlCubePlanSummary } from "../../shared/entityPnlCubePlan";

export class EntityPnlCubePlanError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type Execute = (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>;
const execute: Execute = async (query) => db.execute(query) as Promise<{ rows: unknown[] }>;

export function summarizeCubePlan(plan: EntityPnlFinancialPlan, revision = 0, updatedAt: string | null = null): EntityPnlCubePlanSummary {
  const scenarios = Array.from(new Set(plan.rows.map((row) => row.scenario))).sort().map((scenario) => {
    const rows = plan.rows.filter((row) => row.scenario === scenario);
    return { scenario, populated: rows.filter((row) => row.value !== null).length,
      missing: rows.filter((row) => row.value === null).length, months: Array.from(new Set(rows.map((row) => row.month))).sort((a, b) => a - b) };
  });
  return {
    entity: plan.entity, sourceName: plan.sourceName, revision, updatedAt,
    previewHash: createHash("sha256").update(JSON.stringify(plan)).digest("hex"),
    sourceUnit: plan.sourceUnit, periodBasis: plan.periodBasis, records: plan.rows.length,
    scenarios, usdExchangeRates: plan.usdExchangeRates,
    warnings: [
      "Entity P&L only. Actuals, operational plans, other boards and saved reports are not modified.",
      "Entirely blank CF columns are excluded. Partial blanks remain missing, not zero. BP is not imported.",
      "All source months are retained; a July cube does not relabel other months as July.",
      "Supplied Average Capacity rows are retained for traceability; the board derives averages from monthly End Capacity.",
      plan.periodBasis === "mtd"
        ? "Financial amounts are monthly MTD: YoY sums January through the selected month; QoQ sums only the selected quarter. Capacity snapshots are not summed."
        : "Financial amounts are cumulative YTD: use the selected snapshot; do not sum monthly financial snapshots.",
      ...scenarios.filter((item) => !plan.usdExchangeRates[item.scenario])
        .map((item) => `${item.scenario}: no approved USD rate. INR and capacity remain available; USD financial comparisons are unavailable.`),
    ],
  };
}

/** Bound inflated ZIP size before ExcelJS loads an untrusted workbook. */
export function validateWorkbookArchive(bytes: Buffer): void {
  if (bytes.length > 10_000_000) throw new EntityPnlCubePlanError("Workbook exceeds 10 MB.", 413);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new EntityPnlCubePlanError("Upload a valid .xlsx workbook.");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  if (count > 1000 || count === 0) throw new EntityPnlCubePlanError("Workbook archive has too many entries.");
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new EntityPnlCubePlanError("Invalid workbook archive.");
    total += bytes.readUInt32LE(offset + 24);
    if (total > 50_000_000) throw new EntityPnlCubePlanError("Expanded workbook exceeds 50 MB.", 413);
    offset += 46 + bytes.readUInt16LE(offset + 28) + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  if (offset > end) throw new EntityPnlCubePlanError("Invalid workbook archive.");
}

export async function parseCubePlan(bytes: Buffer, options: { entity: string; sourceName: string; usdExchangeRates: Record<string, number>; periodBasis?: EntityPnlFinancialPlan["periodBasis"] }) {
  validateWorkbookArchive(bytes);
  const sourceName = options.sourceName.replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f<>]/g, "").slice(0, 200);
  if (!sourceName.toLowerCase().endsWith(".xlsx")) throw new EntityPnlCubePlanError("Only .xlsx financial workbooks are supported.");
  return parseEntityPnlFinancialPlanWorkbook(bytes, { ...options, sourceName });
}

function isMissingTable(error: unknown): boolean {
  let current = error as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; current && i < 4; i++, current = current.cause as typeof current) {
    if (current.code === "42P01") return true;
  }
  return false;
}

export async function readCubeEntityPnlPlan(cubeId: string, entity: string, runQuery: Execute = execute) {
  try {
    const result = await runQuery(sql`
      SELECT plan_data, revision, updated_at FROM cube_entity_pnl_plan_data
      WHERE cube_id = ${cubeId} AND entity_key = ${entity.trim().toLowerCase()} LIMIT 1
    `);
    const row = result.rows[0] as { plan_data: unknown; revision: number; updated_at: string | Date } | undefined;
    return row ? { plan: validateEntityPnlFinancialPlan(row.plan_data), revision: row.revision,
      updatedAt: new Date(row.updated_at).toISOString() } : undefined;
  } catch (error) {
    // Older deployments preserve the pre-existing board-local/cube-fact flow.
    // Connectivity and corrupted data errors are never silently ignored.
    if (isMissingTable(error)) return undefined;
    throw error;
  }
}

export async function saveCubeEntityPnlPlan(
  cubeId: string, rawPlan: unknown, expectedRevision: number, previewHash: string, uploadedBy: string,
  runQuery: Execute = execute,
) {
  const plan = validateEntityPnlFinancialPlan(rawPlan);
  const summary = summarizeCubePlan(plan);
  if (summary.previewHash !== previewHash) throw new EntityPnlCubePlanError("Workbook or settings changed. Preview again before importing.", 409);
  // One atomic conditional UPSERT works on both Neon HTTP and Azure PostgreSQL.
  // No shared fact/operational tables are touched. Stale previews cannot overwrite.
  const result = await runQuery(sql`
    INSERT INTO cube_entity_pnl_plan_data (cube_id, entity_key, plan_data, content_hash, revision, uploaded_by)
    SELECT ${cubeId}, ${plan.entity.trim().toLowerCase()}, ${JSON.stringify(plan)}::jsonb,
      ${summary.previewHash}, 1, ${uploadedBy}
    WHERE ${expectedRevision} = 0 OR EXISTS (
      SELECT 1 FROM cube_entity_pnl_plan_data
      WHERE cube_id = ${cubeId} AND entity_key = ${plan.entity.trim().toLowerCase()} AND revision = ${expectedRevision}
    )
    ON CONFLICT (cube_id, entity_key) DO UPDATE SET
      plan_data = EXCLUDED.plan_data, content_hash = EXCLUDED.content_hash,
      revision = CASE WHEN cube_entity_pnl_plan_data.content_hash = EXCLUDED.content_hash
        THEN cube_entity_pnl_plan_data.revision ELSE cube_entity_pnl_plan_data.revision + 1 END,
      uploaded_by = CASE WHEN cube_entity_pnl_plan_data.content_hash = EXCLUDED.content_hash
        THEN cube_entity_pnl_plan_data.uploaded_by ELSE EXCLUDED.uploaded_by END,
      updated_at = CASE WHEN cube_entity_pnl_plan_data.content_hash = EXCLUDED.content_hash
        THEN cube_entity_pnl_plan_data.updated_at ELSE now() END
    WHERE cube_entity_pnl_plan_data.revision = ${expectedRevision}
    RETURNING revision, updated_at
  `);
  const row = result.rows[0] as { revision: number; updated_at: string | Date } | undefined;
  if (!row) throw new EntityPnlCubePlanError("Planning data changed since preview. Preview again; nothing was replaced.", 409);
  return summarizeCubePlan(plan, row.revision, new Date(row.updated_at).toISOString());
}

export function selectFinancialPlan(
  entity: string | undefined, cubePlan: EntityPnlFinancialPlan | undefined, boardPlan: unknown,
): EntityPnlFinancialPlan | undefined {
  if (cubePlan) {
    if (cubePlan.entity.trim().toLowerCase() !== entity?.trim().toLowerCase()) throw new Error("Cube financial plan entity mismatch.");
    return cubePlan; // Authoritative for this entity; never add/fall back to stale board-local CF.
  }
  return boardPlan ? validateEntityPnlFinancialPlan(boardPlan) : undefined;
}
