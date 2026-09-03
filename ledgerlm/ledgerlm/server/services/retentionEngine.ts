import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";
import { writeAuditLog } from "./auditLogger";
import { createSchedulerLog, completeSchedulerLog } from "./schedulerService";

const ALLOWED_TABLES = new Set([
  "messages",
  "audit_logs",
  "backup_logs",
  "otp_codes",
  "enterprise_document_chunks",
  "enterprise_document_embeddings",
]);

export interface RetentionPolicy {
  id: string;
  tableName: string;
  label: string;
  retainDays: number;
  enabled: boolean;
  lastRun: string | null;
  lastDeleted: number;
  createdAt: string;
  updatedAt: string;
}

export async function listRetentionPolicies(): Promise<RetentionPolicy[]> {
  const rows = await db.execute(sql`
    SELECT id, table_name, label, retain_days, enabled, last_run, last_deleted, created_at, updated_at
    FROM retention_policies
    ORDER BY table_name
  `);
  return (rows.rows as any[]).map(mapPolicy);
}

export async function updateRetentionPolicy(
  id: string,
  patch: { retainDays?: number; enabled?: boolean }
): Promise<RetentionPolicy | null> {
  const sets: string[] = ["updated_at = NOW()"];
  if (patch.retainDays !== undefined) sets.push(`retain_days = ${Number(patch.retainDays)}`);
  if (patch.enabled !== undefined) sets.push(`enabled = ${patch.enabled}`);

  const rows = await db.execute(sql.raw(`
    UPDATE retention_policies SET ${sets.join(", ")} WHERE id = '${id}' RETURNING *
  `));
  const r = rows.rows[0] as any;
  return r ? mapPolicy(r) : null;
}

export async function runRetentionEngine(
  triggeredBy = "scheduler"
): Promise<{ policies: number; totalDeleted: number }> {
  const rows = await db.execute(sql`
    SELECT id, table_name, retain_days FROM retention_policies WHERE enabled = true
  `);

  const policies = rows.rows as any[];
  let totalDeleted = 0;

  // Create scheduler log entry
  const logId = await createSchedulerLog("retention", triggeredBy);
  const tableResults: Record<string, number> = {};

  for (const policy of policies) {
    const tableName: string = policy.table_name;
    const retainDays: number = policy.retain_days;

    if (!ALLOWED_TABLES.has(tableName)) {
      logger.warn({ tableName }, "Retention policy table not in allowlist — skipping");
      continue;
    }

    try {
      const result = await db.execute(sql.raw(`
        WITH deleted AS (
          DELETE FROM ${tableName}
          WHERE created_at < NOW() - INTERVAL '${retainDays} days'
          RETURNING id
        )
        SELECT COUNT(*) AS cnt FROM deleted
      `));

      const cnt = Number((result.rows[0] as any)?.cnt ?? 0);
      totalDeleted += cnt;
      tableResults[tableName] = cnt;

      await db.execute(sql`
        UPDATE retention_policies
        SET last_run = NOW(), last_deleted = ${cnt}, updated_at = NOW()
        WHERE id = ${policy.id}
      `);

      writeAuditLog({
        action: "RETENTION_PURGE",
        status: "success",
        details: { table: tableName, retainDays, rowsDeleted: cnt, triggeredBy },
      }).catch(() => {});

      logger.info({ tableName, retainDays, rowsDeleted: cnt }, "Retention purge completed");
    } catch (err: any) {
      logger.error({ tableName, err: err.message }, "Retention purge failed");
      writeAuditLog({
        action: "RETENTION_PURGE",
        status: "failed",
        details: { table: tableName, error: err.message },
      }).catch(() => {});
    }
  }

  await completeSchedulerLog(logId, "success", {
    policiesRun: policies.length,
    totalRowsDeleted: totalDeleted,
    tableResults,
  });

  return { policies: policies.length, totalDeleted };
}

function mapPolicy(r: any): RetentionPolicy {
  return {
    id: r.id,
    tableName: r.table_name,
    label: r.label,
    retainDays: Number(r.retain_days),
    enabled: r.enabled,
    lastRun: r.last_run ? new Date(r.last_run).toISOString() : null,
    lastDeleted: Number(r.last_deleted),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
