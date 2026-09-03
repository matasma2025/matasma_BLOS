import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

export async function createAuditLogTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     VARCHAR,
        action      VARCHAR(50)  NOT NULL,
        resource    VARCHAR(100),
        resource_id VARCHAR,
        ip_address  VARCHAR(45),
        status      VARCHAR(20)  NOT NULL DEFAULT 'success',
        details     JSONB,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx   ON audit_logs (user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS audit_logs_action_idx    ON audit_logs (action)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC)
    `);

    logger.info("audit_logs table ready");
  } catch (err) {
    logger.error({ err }, "createAuditLogTable failed");
  }
}
