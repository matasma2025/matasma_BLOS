import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addCustomerColumns(): Promise<void> {
  try {
    console.log("🔧 Adding project_type and customer columns to cube_fact_data...");

    await db.execute(sql`
      ALTER TABLE cube_fact_data
        ADD COLUMN IF NOT EXISTS project_type VARCHAR(255)
    `);

    await db.execute(sql`
      ALTER TABLE cube_fact_data
        ADD COLUMN IF NOT EXISTS customer VARCHAR(500)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cube_fact_data_customer_idx
        ON cube_fact_data(customer)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cube_fact_data_project_type_idx
        ON cube_fact_data(project_type)
    `);

    await db.execute(sql`
      ALTER TABLE cube_fact_data
        ADD COLUMN IF NOT EXISTS bill_to_party_legal_entity_full_name VARCHAR(500)
    `);

    console.log("✅ Added project_type column to cube_fact_data");
    console.log("✅ Added customer column to cube_fact_data");
    console.log("✅ Added bill_to_party_legal_entity_full_name column to cube_fact_data");
    console.log("✅ Created indexes on project_type and customer");
    console.log("✨ Customer columns migration completed!");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("✅ customer columns already exist, skipping");
    } else {
      console.error("❌ Error adding customer columns:", error.message);
      throw error;
    }
  }
}
