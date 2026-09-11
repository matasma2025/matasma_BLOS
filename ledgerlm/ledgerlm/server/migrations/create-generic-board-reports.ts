import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createGenericBoardReportsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS board_reports (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id VARCHAR NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      run_id VARCHAR NOT NULL UNIQUE REFERENCES board_analysis_runs(id) ON DELETE CASCADE,
      template_key VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      period_label TEXT,
      result JSONB NOT NULL DEFAULT '{}',
      deterministic_metrics JSONB,
      source_snapshot JSONB NOT NULL DEFAULT '{}',
      config_snapshot JSONB NOT NULL DEFAULT '{}',
      raw_model_output TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'complete',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_reports_board_idx ON board_reports(board_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_reports_template_idx ON board_reports(template_key)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_reports_created_at_idx ON board_reports(created_at)`);
  console.log("✅ board_reports table ready");
}