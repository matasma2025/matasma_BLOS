import { spawn } from "child_process";
import { logger } from "../logger";
import { writeAuditLog } from "./auditLogger";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getSchedulerSettings, createSchedulerLog, completeSchedulerLog } from "./schedulerService";
import { getEntraToken } from "../utils/entraToken";

export interface BackupRecord {
  id: string;
  filename: string;
  sizeBytes: number;
  status: "success" | "failed";
  triggeredBy: string;
  blobUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
}

async function ensureBackupLogTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS backup_logs (
      id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      filename      VARCHAR NOT NULL,
      size_bytes    BIGINT NOT NULL DEFAULT 0,
      status        VARCHAR(20) NOT NULL DEFAULT 'success',
      triggered_by  VARCHAR NOT NULL DEFAULT 'scheduler',
      blob_url      VARCHAR,
      error_message TEXT,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS backup_logs_created_at_idx ON backup_logs (created_at DESC)
  `);
}

export async function listBackups(limit = 20): Promise<BackupRecord[]> {
  try {
    await ensureBackupLogTable();
    const rows = await db.execute(sql`
      SELECT id, filename, size_bytes, status, triggered_by, blob_url, error_message, created_at
      FROM backup_logs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    return (rows.rows as any[]).map((r) => ({
      id: r.id,
      filename: r.filename,
      sizeBytes: Number(r.size_bytes),
      status: r.status,
      triggeredBy: r.triggered_by,
      blobUrl: r.blob_url,
      errorMessage: r.error_message,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function runBackup(
  triggeredBy: string = "scheduler"
): Promise<{ success: boolean; filename?: string; sizeBytes?: number; error?: string }> {
  await ensureBackupLogTable();

  const authMode = (process.env.DB_AUTH_MODE || "").toLowerCase();

  // Build pg_dump args + env based on the active auth mode so backup works
  // across all deployment targets (Neon, local, Azure password, Azure Entra).
  let pgDumpArgs: string[];
  let pgDumpEnv: NodeJS.ProcessEnv;

  if (authMode === "entra" || authMode === "hybrid") {
    // Azure Managed Identity — fetch a short-lived token and pass it as PGPASSWORD.
    const dbHost = process.env.DB_HOST || "";
    const dbUser = process.env.DB_USER || "";
    const dbName = process.env.DB_NAME || "";
    if (!dbHost || !dbUser || !dbName) {
      const error = "DB_AUTH_MODE=entra requires DB_HOST, DB_USER, DB_NAME for backup";
      logger.error(error);
      await db.execute(sql`
        INSERT INTO backup_logs (filename, size_bytes, status, triggered_by, error_message)
        VALUES ('none', 0, 'failed', ${triggeredBy}, ${error})
      `);
      return { success: false, error };
    }
    const token = await getEntraToken();
    pgDumpArgs = [
      "--no-password", "--format=plain", "--no-owner", "--no-acl",
      `--host=${dbHost}`, `--username=${dbUser}`, `--dbname=${dbName}`,
    ];
    pgDumpEnv = { ...process.env, PGPASSWORD: token, PGSSLMODE: "require" };

  } else if (authMode === "postgres-azure") {
    const dbHost = process.env.DB_HOST || "";
    const dbUser = process.env.DB_USER || "";
    const dbName = process.env.DB_NAME || "";
    const dbPass = process.env.DB_PASSWORD || "";
    if (!dbHost || !dbUser || !dbName || !dbPass) {
      const error = "DB_AUTH_MODE=postgres-azure requires DB_HOST, DB_USER, DB_NAME, DB_PASSWORD for backup";
      logger.error(error);
      await db.execute(sql`
        INSERT INTO backup_logs (filename, size_bytes, status, triggered_by, error_message)
        VALUES ('none', 0, 'failed', ${triggeredBy}, ${error})
      `);
      return { success: false, error };
    }
    pgDumpArgs = [
      "--no-password", "--format=plain", "--no-owner", "--no-acl",
      `--host=${dbHost}`, `--username=${dbUser}`, `--dbname=${dbName}`,
    ];
    pgDumpEnv = { ...process.env, PGPASSWORD: dbPass, PGSSLMODE: "require" };

  } else {
    // Default: Neon cloud or local Postgres — use the connection URL directly.
    const dbUrl =
      process.env.NEON_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.AZURE_POSTGRESQL_URL;

    if (!dbUrl) {
      const error = "No database URL configured for backup";
      logger.error(error);
      await db.execute(sql`
        INSERT INTO backup_logs (filename, size_bytes, status, triggered_by, error_message)
        VALUES ('none', 0, 'failed', ${triggeredBy}, ${error})
      `);
      return { success: false, error };
    }
    pgDumpArgs = ["--no-password", "--format=plain", "--no-owner", "--no-acl", dbUrl];
    pgDumpEnv = { ...process.env, PGPASSWORD: "" };
  }

  // Read blob config from DB (falls back to env var inside getSchedulerSettings)
  const settings = await getSchedulerSettings();
  const connStr = settings.blobConnectionString;
  const containerName = settings.blobContainer;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `ledgerlm-backup-${timestamp}.sql`;

  logger.info({ filename, triggeredBy }, "Starting database backup");

  // Create scheduler log entry
  const logId = await createSchedulerLog("backup", triggeredBy);

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let errorOutput = "";

    const pgDump = spawn("pg_dump", pgDumpArgs, { env: pgDumpEnv });

    pgDump.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    pgDump.stderr.on("data", (d: Buffer) => { errorOutput += d.toString(); });

    pgDump.on("close", async (code) => {
      if (code !== 0) {
        const msg = `pg_dump exited with code ${code}: ${errorOutput.slice(0, 500)}`;
        logger.error({ msg }, "Backup failed");
        try {
          await ensureBackupLogTable();
          await db.execute(sql`
            INSERT INTO backup_logs (filename, size_bytes, status, triggered_by, error_message)
            VALUES (${filename}, 0, 'failed', ${triggeredBy}, ${msg})
          `);
        } catch (dbErr: any) {
          logger.warn({ dbErr: dbErr.message }, "Could not write backup failure to backup_logs");
        }
        writeAuditLog({ action: "BACKUP_TRIGGERED", status: "failed", details: { error: msg, triggeredBy } }).catch(() => {});
        completeSchedulerLog(logId, "failed", null, msg).catch(() => {});
        resolve({ success: false, error: msg });
        return;
      }

      const dumpBuffer = Buffer.concat(chunks);
      const sizeBytes = dumpBuffer.length;
      let blobUrl: string | null = null;

      // Upload to Azure Blob if connection string is configured
      if (connStr) {
        try {
          const { BlobServiceClient } = await import("@azure/storage-blob");
          const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
          const containerClient = blobServiceClient.getContainerClient(containerName);
          await containerClient.createIfNotExists();
          const blockBlobClient = containerClient.getBlockBlobClient(filename);
          await blockBlobClient.upload(dumpBuffer, sizeBytes, {
            blobHTTPHeaders: { blobContentType: "application/sql" },
          });
          blobUrl = blockBlobClient.url.split("?")[0];
          logger.info({ filename, sizeBytes, blobUrl }, "Backup uploaded to Azure Blob");
        } catch (err: any) {
          logger.warn({ err: err.message }, "Blob upload failed — backup stored locally only");
        }
      } else {
        logger.warn("No blob connection string configured — backup not uploaded to Azure");
      }

      await db.execute(sql`
        INSERT INTO backup_logs (filename, size_bytes, status, triggered_by, blob_url)
        VALUES (${filename}, ${sizeBytes}, 'success', ${triggeredBy}, ${blobUrl})
      `);

      writeAuditLog({
        action: "BACKUP_TRIGGERED",
        status: "success",
        details: { filename, sizeBytes, blobUrl, triggeredBy },
      }).catch(() => {});

      await completeSchedulerLog(logId, "success", {
        filename,
        sizeBytes,
        blobUrl,
        uploadedToAzure: !!blobUrl,
      });

      logger.info({ filename, sizeBytes }, "Backup completed successfully");
      resolve({ success: true, filename, sizeBytes });
    });

    pgDump.on("error", async (err) => {
      const msg = `pg_dump not found or failed to start: ${err.message}`;
      logger.error({ msg }, "Backup error");
      try {
        await ensureBackupLogTable();
        await db.execute(sql`
          INSERT INTO backup_logs (filename, size_bytes, status, triggered_by, error_message)
          VALUES (${filename}, 0, 'failed', ${triggeredBy}, ${msg})
        `);
      } catch (dbErr: any) {
        logger.warn({ dbErr: dbErr.message }, "Could not write backup error to backup_logs");
      }
      writeAuditLog({ action: "BACKUP_TRIGGERED", status: "failed", details: { error: msg } }).catch(() => {});
      completeSchedulerLog(logId, "failed", null, msg).catch(() => {});
      resolve({ success: false, error: msg });
    });
  });
}
