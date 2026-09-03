import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import * as schema from '@shared/schema';
import { getEntraToken } from './utils/entraToken';

// ── Auth mode ──────────────────────────────────────────────────────────────────
// DB_AUTH_MODE controls which connection strategy is used at startup.
//
//   (not set)       → Neon cloud or local Postgres via NEON_DATABASE_URL / DATABASE_URL
//   postgres-azure  → Azure Postgres with username + password (SSL required)
//   entra           → Azure Postgres with Managed Identity Entra token (no password)
//   hybrid          → Same as entra (app uses token; Postgres accepts both methods)
//
// Existing Replit / NeonDB / local behaviour is 100% unchanged when DB_AUTH_MODE
// is not set.

const authMode = (process.env.DB_AUTH_MODE || '').toLowerCase();

type DrizzleDb =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>;

let db: DrizzleDb;

if (authMode === 'entra' || authMode === 'hybrid') {
  // ── Azure Postgres — Microsoft Entra (Managed Identity) ──────────────────
  const dbHost = process.env.DB_HOST;
  const dbUser = process.env.DB_USER;
  const dbName = process.env.DB_NAME;

  if (!dbHost || !dbUser || !dbName) {
    throw new Error(
      '[DB] DB_AUTH_MODE=entra requires DB_HOST, DB_USER, and DB_NAME env vars.'
    );
  }

  const pool = new Pool({
    host: dbHost,
    user: dbUser,
    database: dbName,
    port: 5432,
    // pg calls this async function per new connection → auto-refreshes token
    password: () => getEntraToken(),
    // DB_TLS_REJECT_UNAUTHORIZED=false must be set explicitly in Azure private VNet environments
    // where the PostgreSQL cert is signed by a private CA not in the container trust store.
    ssl: { rejectUnauthorized: process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false' },
  });

  db = drizzlePg(pool, { schema });
  console.log(
    `[DB] Using Azure PostgreSQL — Microsoft Entra auth. Host: ${dbHost}`
  );

} else if (authMode === 'postgres-azure') {
  // ── Azure Postgres — standard username + password ─────────────────────────
  const dbHost = process.env.DB_HOST;
  const dbUser = process.env.DB_USER;
  const dbName = process.env.DB_NAME;
  const dbPass = process.env.DB_PASSWORD;

  if (!dbHost || !dbUser || !dbName || !dbPass) {
    throw new Error(
      '[DB] DB_AUTH_MODE=postgres-azure requires DB_HOST, DB_USER, DB_NAME, and DB_PASSWORD env vars.'
    );
  }

  const pool = new Pool({
    host: dbHost,
    user: dbUser,
    database: dbName,
    password: dbPass,
    port: 5432,
    // DB_TLS_REJECT_UNAUTHORIZED=false must be set explicitly in Azure private VNet environments
    ssl: { rejectUnauthorized: process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false' },
  });

  db = drizzlePg(pool, { schema });
  console.log(
    `[DB] Using Azure PostgreSQL — password auth. Host: ${dbHost}`
  );

} else {
  // ── Default: Neon cloud or local Postgres (UNCHANGED) ────────────────────
  const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      '[DB] NEON_DATABASE_URL environment variable is required. ' +
      'For Azure deployments, set DB_AUTH_MODE and DB_HOST / DB_USER / DB_NAME instead.'
    );
  }

  const isLocalDb =
    dbUrl.includes('localhost') ||
    dbUrl.includes('ledgerlm-db') ||
    dbUrl.includes('172.17.') ||
    dbUrl.includes('127.0.0.1');

  if (isLocalDb) {
    const pool = new Pool({ connectionString: dbUrl, ssl: false });
    db = drizzlePg(pool, { schema });
    console.log('[DB] Using local PostgreSQL connection (SSL disabled)');
  } else {
    const sql = neon(dbUrl);
    db = drizzleNeon(sql, { schema });
    console.log('[DB] Using Neon cloud connection (SSL enabled)');
  }
}

export { db };

/** Current auth mode — for the admin status endpoint */
export const dbAuthMode = authMode || 'neon';
