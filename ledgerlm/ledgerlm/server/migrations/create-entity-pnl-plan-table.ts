import { db } from "../db";
import { sql } from "drizzle-orm";

/** Explicit additive migration. No startup reconciliation and no shared-data writes. */
export async function runEntityPnlPlanMigration() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cube_entity_pnl_plan_data (
      cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
      entity_key VARCHAR(200) NOT NULL,
      plan_data JSONB NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
      uploaded_by VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT now(),
      PRIMARY KEY (cube_id, entity_key)
    )
  `);
}
