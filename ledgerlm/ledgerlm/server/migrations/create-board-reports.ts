import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function createBoardReportsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cube_board_reports (
      id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id    VARCHAR NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      period_label TEXT NOT NULL,
      year        INTEGER NOT NULL,
      months      JSONB NOT NULL DEFAULT '[]',
      column_mapping JSONB NOT NULL DEFAULT '{}',
      dimensions  JSONB,
      user_prompt_final TEXT,
      raw_analysis TEXT,
      status      VARCHAR(20) NOT NULL DEFAULT 'complete',
      error_message TEXT,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS cube_board_reports_board_id_idx ON cube_board_reports(board_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS cube_board_reports_created_at_idx ON cube_board_reports(created_at)
  `);
  console.log('✅ cube_board_reports table ready');
}
