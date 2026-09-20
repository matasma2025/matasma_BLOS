import { sql } from "drizzle-orm";
import { db } from "../db";

export async function addBoardPhaseOneFoundation(): Promise<void> {
  await db.execute(sql`ALTER TABLE board_analysis_configs ADD COLUMN IF NOT EXISTS scope_config JSONB NOT NULL DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE board_analysis_configs ADD COLUMN IF NOT EXISTS time_config JSONB NOT NULL DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE board_analysis_configs ADD COLUMN IF NOT EXISTS forecast_config JSONB NOT NULL DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE board_analysis_configs ADD COLUMN IF NOT EXISTS fiscal_calendar JSONB NOT NULL DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE board_analysis_configs ADD COLUMN IF NOT EXISTS variance_threshold TEXT`);
  await db.execute(sql`ALTER TABLE board_analysis_configs ADD COLUMN IF NOT EXISTS report_instructions TEXT`);

  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200)`);
  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS config_snapshot JSONB NOT NULL DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS result_schema_version INTEGER NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS formula_engine_version VARCHAR(100)`);
  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(100)`);
  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS worker_heartbeat_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE board_analysis_runs ADD COLUMN IF NOT EXISTS failure_category VARCHAR(100)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS board_analysis_runs_idempotency_idx ON board_analysis_runs(idempotency_key)`);

  await db.execute(sql`ALTER TABLE board_reports ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE board_reports ADD COLUMN IF NOT EXISTS evidence_manifest JSONB NOT NULL DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE board_reports ADD COLUMN IF NOT EXISTS formula_engine_version VARCHAR(100)`);
  await db.execute(sql`ALTER TABLE board_reports ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(100)`);
  await db.execute(sql`ALTER TABLE board_reports ADD COLUMN IF NOT EXISTS model_metadata JSONB NOT NULL DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE board_reports ADD COLUMN IF NOT EXISTS supersedes_report_id VARCHAR`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_reports_supersedes_idx ON board_reports(supersedes_report_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS board_schedules (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id VARCHAR NOT NULL UNIQUE REFERENCES boards(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 0,
      frequency VARCHAR(30) NOT NULL,
      interval INTEGER,
      interval_unit VARCHAR(20),
      timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
      start_at TIMESTAMP NOT NULL,
      next_run_at TIMESTAMP,
      last_run_at TIMESTAMP,
      last_run_status VARCHAR(30),
      retry_policy JSONB NOT NULL DEFAULT '{}',
      created_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_schedules_board_idx ON board_schedules(board_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_schedules_enabled_next_run_idx ON board_schedules(enabled, next_run_at)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS board_exports (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      report_id VARCHAR NOT NULL REFERENCES board_reports(id) ON DELETE CASCADE,
      format VARCHAR(20) NOT NULL,
      template_file_id VARCHAR,
      status VARCHAR(30) NOT NULL DEFAULT 'queued',
      storage_key TEXT,
      error_category VARCHAR(100),
      created_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `);
  await db.execute(sql`ALTER TABLE board_exports ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_exports_report_idx ON board_exports(report_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_exports_creator_idx ON board_exports(created_by)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_exports_status_idx ON board_exports(status)`);
}