import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

/**
 * Creates only the Terms acceptance table required by the legal acceptance
 * flow. This is intentionally separate from drizzle-kit push so an existing
 * Bosch database is never reconciled destructively at application startup.
 */
export async function createTermsAcceptancesTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS terms_acceptances (
      id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      terms_version VARCHAR(20) NOT NULL,
      accepted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address    VARCHAR(45),
      user_agent    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'terms_acceptances_user_version_unique'
      ) THEN
        ALTER TABLE terms_acceptances
          ADD CONSTRAINT terms_acceptances_user_version_unique
          UNIQUE (user_id, terms_version);
      END IF;
    END $$;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS terms_acceptances_user_id_idx
      ON terms_acceptances (user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS terms_acceptances_version_idx
      ON terms_acceptances (terms_version)
  `);

  logger.info("terms_acceptances table ready");
}