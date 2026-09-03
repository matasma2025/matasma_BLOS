import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function addVarianceDataColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE cube_board_reports
      ADD COLUMN IF NOT EXISTS variance_data JSONB,
      ADD COLUMN IF NOT EXISTS comparison_period_label TEXT
  `);
  console.log('✅ cube_board_reports: variance_data + comparison_period_label columns ready');
}
