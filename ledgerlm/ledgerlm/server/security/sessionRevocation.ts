import { sql } from "drizzle-orm";
import { db } from "../db";

export async function revokeUserSessions(userId: string): Promise<void> {
  await db.execute(
    sql`UPDATE users SET sessions_revoked_at = NOW() WHERE id = ${userId}`,
  );
  await db.execute(
    sql`DELETE FROM "session" WHERE (sess::jsonb)->>'userId' = ${userId}`,
  );
}