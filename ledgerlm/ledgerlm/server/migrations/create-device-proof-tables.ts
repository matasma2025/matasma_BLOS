import { db } from "../db";
import { sql } from "drizzle-orm";

/** Additive migration; safe to run on every startup. */
export async function createDeviceProofTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_device_credentials (
      id varchar PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key_jwk jsonb NOT NULL, fingerprint varchar(64) NOT NULL UNIQUE,
      status varchar(20) NOT NULL DEFAULT 'active', created_at timestamp NOT NULL DEFAULT now(),
      last_used_at timestamp, revoked_at timestamp
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS user_device_credentials_user_idx
    ON user_device_credentials(user_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS user_device_credentials_status_idx
    ON user_device_credentials(status)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS device_proof_nonces (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), nonce_hash varchar(64) NOT NULL UNIQUE,
      session_id text NOT NULL, credential_id varchar NOT NULL REFERENCES user_device_credentials(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamp NOT NULL,
      consumed_at timestamp, created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS device_proof_nonces_session_idx
    ON device_proof_nonces(session_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS device_proof_nonces_expiry_idx
    ON device_proof_nonces(expires_at)
  `);
  await db.execute(sql`
    DELETE FROM device_trust
  `);
}