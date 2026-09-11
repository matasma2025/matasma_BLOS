import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createBoardAnalysisConfigsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS board_analysis_configs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id VARCHAR NOT NULL UNIQUE REFERENCES boards(id) ON DELETE CASCADE,
      template_key VARCHAR(100) NOT NULL,
      system_prompt TEXT,
      analysis_prompt TEXT,
      source_type VARCHAR(30) NOT NULL DEFAULT 'enterprise',
      source_config JSONB NOT NULL DEFAULT '{}',
      scope_mode VARCHAR(20) NOT NULL DEFAULT 'all',
      key_columns JSONB NOT NULL DEFAULT '[]',
      excluded_columns JSONB NOT NULL DEFAULT '[]',
      time_granularity VARCHAR(20) NOT NULL DEFAULT 'auto',
      comparison_basis JSONB NOT NULL DEFAULT '{}',
      settings_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_analysis_configs_board_idx ON board_analysis_configs(board_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_analysis_configs_template_idx ON board_analysis_configs(template_key)`);
  console.log("✅ board_analysis_configs table ready");
}