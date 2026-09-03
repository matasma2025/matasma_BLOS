import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration: Add sso_group_mappings JSONB column to domains table,
 * and status column to domain_users for deactivation support.
 */
export async function addSsoGroupMappings() {
  console.log("🔧 Running SSO group mappings migration...");

  try {
    // Add sso_group_mappings JSONB column to domains
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'domains' AND column_name = 'sso_group_mappings'
        ) THEN
          ALTER TABLE domains ADD COLUMN sso_group_mappings JSONB;
        END IF;
      END $$;
    `);
    console.log("✅ Added sso_group_mappings column to domains table");

    // Add status column to domain_users (active / inactive)
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'domain_users' AND column_name = 'status'
        ) THEN
          ALTER TABLE domain_users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
        END IF;
      END $$;
    `);
    console.log("✅ Added status column to domain_users table");

    // Index for quick lookup of active SSO users during background sync
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domain_users_status_idx ON domain_users(status);
    `);
    console.log("✅ Created index on domain_users.status");

    console.log("✨ SSO group mappings migration completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ SSO group mappings migration failed:", error);
    return false;
  }
}
