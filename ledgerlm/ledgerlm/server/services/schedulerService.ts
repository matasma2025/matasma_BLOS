import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SchedulerSettings {
  backupUtcHour: number;
  blobConnectionString: string | null;
  blobContainer: string;
  updatedAt: string;
}

export interface SchedulerLog {
  id: string;
  jobType: "backup" | "retention";
  triggeredBy: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  details: Record<string, any> | null;
  errorMessage: string | null;
}

// ── Table bootstrap ──────────────────────────────────────────────────────────

export async function ensureSchedulerTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scheduler_settings (
      id                     VARCHAR PRIMARY KEY DEFAULT 'singleton',
      backup_utc_hour        INT NOT NULL DEFAULT 2,
      blob_connection_string TEXT,
      blob_container         VARCHAR NOT NULL DEFAULT 'ledgerlm-backups',
      updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  // Seed default row if not present
  await db.execute(sql`
    INSERT INTO scheduler_settings (id) VALUES ('singleton')
    ON CONFLICT (id) DO NOTHING
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scheduler_logs (
      id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      job_type       VARCHAR(20) NOT NULL,
      triggered_by   VARCHAR NOT NULL DEFAULT 'scheduler',
      status         VARCHAR(20) NOT NULL DEFAULT 'running',
      started_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at   TIMESTAMP,
      duration_ms    BIGINT,
      details        JSONB,
      error_message  TEXT
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS scheduler_logs_started_at_idx ON scheduler_logs (started_at DESC)
  `);
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSchedulerSettings(): Promise<SchedulerSettings> {
  await ensureSchedulerTables();
  const rows = await db.execute(sql`
    SELECT backup_utc_hour, blob_connection_string, blob_container, updated_at
    FROM scheduler_settings WHERE id = 'singleton'
  `);
  const r = rows.rows[0] as any;
  return {
    backupUtcHour: Number(r?.backup_utc_hour ?? 2),
    blobConnectionString: r?.blob_connection_string ?? process.env.AZURE_STORAGE_CONNECTION_STRING ?? null,
    blobContainer: r?.blob_container ?? "ledgerlm-backups",
    updatedAt: r?.updated_at ?? new Date().toISOString(),
  };
}

export async function updateSchedulerSettings(patch: {
  backupUtcHour?: number;
  blobConnectionString?: string | null;
  blobContainer?: string;
}): Promise<SchedulerSettings> {
  await ensureSchedulerTables();
  const sets: string[] = ["updated_at = NOW()"];
  if (patch.backupUtcHour !== undefined) sets.push(`backup_utc_hour = ${Number(patch.backupUtcHour)}`);
  if (patch.blobConnectionString !== undefined) {
    const val = patch.blobConnectionString === null ? "NULL" : `'${patch.blobConnectionString.replace(/'/g, "''")}'`;
    sets.push(`blob_connection_string = ${val}`);
  }
  if (patch.blobContainer !== undefined) sets.push(`blob_container = '${patch.blobContainer.replace(/'/g, "''")}'`);

  await db.execute(sql.raw(`
    UPDATE scheduler_settings SET ${sets.join(", ")} WHERE id = 'singleton'
  `));
  return getSchedulerSettings();
}

export async function testBlobConnection(connStr: string, container: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { BlobServiceClient } = await import("@azure/storage-blob");
    const client = BlobServiceClient.fromConnectionString(connStr);
    const cc = client.getContainerClient(container);
    await cc.createIfNotExists();
    // Write + delete a tiny probe file to verify write access
    const probe = cc.getBlockBlobClient(".ledgerlm-probe");
    await probe.upload("ok", 2);
    await probe.delete();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ── Scheduler Logs ────────────────────────────────────────────────────────────

export async function createSchedulerLog(
  jobType: "backup" | "retention",
  triggeredBy: string
): Promise<string> {
  await ensureSchedulerTables();
  const rows = await db.execute(sql`
    INSERT INTO scheduler_logs (job_type, triggered_by, status, started_at)
    VALUES (${jobType}, ${triggeredBy}, 'running', NOW())
    RETURNING id
  `);
  return (rows.rows[0] as any).id as string;
}

export async function completeSchedulerLog(
  id: string,
  status: "success" | "failed",
  details: Record<string, any> | null = null,
  errorMessage: string | null = null
): Promise<void> {
  const detailsJson = details ? JSON.stringify(details) : null;
  await db.execute(sql`
    UPDATE scheduler_logs
    SET
      status        = ${status},
      completed_at  = NOW(),
      duration_ms   = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
      details       = ${detailsJson}::jsonb,
      error_message = ${errorMessage}
    WHERE id = ${id}
  `);
}

export async function listSchedulerLogs(limit = 50): Promise<SchedulerLog[]> {
  try {
    await ensureSchedulerTables();
    const rows = await db.execute(sql`
      SELECT id, job_type, triggered_by, status, started_at, completed_at,
             duration_ms, details, error_message
      FROM scheduler_logs
      ORDER BY started_at DESC
      LIMIT ${limit}
    `);
    return (rows.rows as any[]).map((r) => ({
      id: r.id,
      jobType: r.job_type,
      triggeredBy: r.triggered_by,
      status: r.status,
      startedAt: new Date(r.started_at).toISOString(),
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
      durationMs: r.duration_ms ? Number(r.duration_ms) : null,
      details: r.details ?? null,
      errorMessage: r.error_message ?? null,
    }));
  } catch {
    return [];
  }
}
