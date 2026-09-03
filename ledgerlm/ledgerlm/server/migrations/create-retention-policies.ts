import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

export async function createRetentionPoliciesTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS retention_policies (
        id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name   VARCHAR(100) NOT NULL,
        label        VARCHAR(200) NOT NULL,
        retain_days  INTEGER NOT NULL DEFAULT 90,
        enabled      BOOLEAN NOT NULL DEFAULT false,
        last_run     TIMESTAMP,
        last_deleted INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS retention_policies_table_name_idx ON retention_policies (table_name)
    `);

    // Seed default policies if table is empty
    await db.execute(sql`
      INSERT INTO retention_policies (table_name, label, retain_days, enabled)
      VALUES
        ('messages',   'Chat Messages',      90,   false),
        ('audit_logs', 'Audit Logs',         730,  false),
        ('backup_logs','Backup Records Log', 365,  false),
        ('otp_codes',  'OTP Codes',          7,    true)
      ON CONFLICT (table_name) DO NOTHING
    `);

    logger.info("retention_policies table ready");
  } catch (err) {
    logger.error({ err }, "createRetentionPoliciesTable failed");
  }
}
