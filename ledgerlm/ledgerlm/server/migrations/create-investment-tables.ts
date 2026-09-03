/**
 * Migration: Investment / CAPEX / PMO tables
 *
 * Creates cube_investment_data for the new Investment/CAPEX/PMO schema type
 * and adds a schema_type discriminator column to the cubes table so the system
 * knows which fact table to use for each cube.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runInvestmentTablesMigration() {
  console.log("🔧 Running Investment/CAPEX/PMO tables migration...");

  try {
    // 1. Add schema_type column to cubes (default 'kpi' so existing cubes are untouched)
    await db.execute(sql`
      ALTER TABLE cubes
      ADD COLUMN IF NOT EXISTS schema_type VARCHAR(50) NOT NULL DEFAULT 'kpi'
    `);
    console.log("✅ Added schema_type column to cubes table");

    // 2. Create the Investment / CAPEX / PMO fact table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_investment_data (
        id            BIGSERIAL PRIMARY KEY,
        cube_id       VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,

        -- Dimension columns
        fiscal_year         VARCHAR(10),
        month               VARCHAR(5),
        dept                VARCHAR(255),
        proj_display_id     VARCHAR(255),
        project_name        VARCHAR(500),
        category            VARCHAR(255),
        grouping            VARCHAR(255),
        type                VARCHAR(100),   -- 'Cost' | 'CAPEX' | 'PMO' | 'Bosch Actuals' | 'Total Funds'

        -- Metric columns (thousands USD)
        yearly_approved_tusd    DECIMAL(18,6),
        monthly_approved_tusd   DECIMAL(18,6),
        actual_tusd             DECIMAL(18,6),
        balance_tusd            DECIMAL(18,6),
        expenses_tusd           DECIMAL(18,6),
        travel_tusd             DECIMAL(18,6),

        -- Metric columns (millions INR)
        yearly_approved_minr    DECIMAL(18,6),
        monthly_approved_minr   DECIMAL(18,6),
        actual_minr             DECIMAL(18,6),
        expenses_minr           DECIMAL(18,6),
        travel_minr             DECIMAL(18,6),
        balance_minr            DECIMAL(18,6),

        ingested_at       TIMESTAMP DEFAULT NOW(),
        source_row_number INTEGER
      )
    `);
    console.log("✅ Created cube_investment_data table");

    // 3. Indexes for fast filtering
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inv_cube_id   ON cube_investment_data(cube_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inv_cube_type ON cube_investment_data(cube_id, type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inv_period    ON cube_investment_data(cube_id, fiscal_year, month)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inv_dept      ON cube_investment_data(cube_id, dept)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inv_project   ON cube_investment_data(cube_id, proj_display_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inv_category  ON cube_investment_data(cube_id, category)`);
    console.log("✅ Created cube_investment_data indexes");

    console.log("✨ Investment/CAPEX/PMO migration completed successfully!");
  } catch (error: any) {
    console.error("Error running Investment migration:", error.message);
  }
}
