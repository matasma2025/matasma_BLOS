import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createBoardAnalysisRunsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS board_analysis_runs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id VARCHAR NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      requested_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trigger VARCHAR(20) NOT NULL DEFAULT 'manual',
      status VARCHAR(20) NOT NULL DEFAULT 'queued',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      progress_stage TEXT,
      cancel_requested INTEGER NOT NULL DEFAULT 0,
      template_key VARCHAR(100) NOT NULL,
      request_config JSONB NOT NULL DEFAULT '{}',
      source_snapshot JSONB NOT NULL DEFAULT '{}',
      error_message TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      duration_ms INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_analysis_runs_board_idx ON board_analysis_runs(board_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_analysis_runs_requester_idx ON board_analysis_runs(requested_by)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_analysis_runs_status_idx ON board_analysis_runs(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_analysis_runs_created_at_idx ON board_analysis_runs(created_at)`);
  console.log("✅ board_analysis_runs table ready");
}