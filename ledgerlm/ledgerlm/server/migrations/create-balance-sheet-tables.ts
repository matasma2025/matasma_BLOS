import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Balance Sheet uses its own fact table. It must never be represented as a
 * statementType filter over cube_plan_data because those rows are planning
 * overrides and have different version semantics.
 */
export async function runBalanceSheetTablesMigration(): Promise<void> {
  console.log("Running Balance Sheet tables migration...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cube_balance_sheet_data (
      id BIGSERIAL PRIMARY KEY,
      cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
      fiscal_year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      period_label VARCHAR(100),
      entity VARCHAR(255),
      company_id VARCHAR(255),
      subsidiary VARCHAR(255),
      location VARCHAR(255),
      account_code VARCHAR(100),
      account_name VARCHAR(500) NOT NULL,
      section VARCHAR(30) NOT NULL CHECK (section IN ('assets', 'liabilities', 'equity')),
      category VARCHAR(255) NOT NULL,
      amount_local NUMERIC,
      amount_reporting NUMERIC NOT NULL,
      currency VARCHAR(20) NOT NULL DEFAULT 'USD',
      source_file VARCHAR(255),
      source_row_number INTEGER,
      ingested_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_bs_cube_id_idx ON cube_balance_sheet_data(cube_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_bs_period_idx ON cube_balance_sheet_data(cube_id, fiscal_year, month)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_bs_account_idx ON cube_balance_sheet_data(cube_id, account_code)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_bs_section_idx ON cube_balance_sheet_data(cube_id, section)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cube_bs_entity_idx ON cube_balance_sheet_data(cube_id, entity)`);
  console.log("Balance Sheet tables migration completed.");
}