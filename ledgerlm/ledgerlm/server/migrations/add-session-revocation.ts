import { sql } from "drizzle-orm";
import { db } from "../db";

export async function addSessionRevocationTimestamp(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMP
  `);
}