/**
 * db-prepare.ts — run BEFORE drizzle-kit push
 *
 * Creates required PostgreSQL extensions that the schema depends on.
 * Must succeed before drizzle-kit push because the schema has vector columns
 * (vector(1024) and vector(3072)) that require the pgvector extension.
 *
 * Also creates pg_trgm for fuzzy-search indexes.
 *
 * Uses the same Entra / IMDS / URL auth logic as drizzle.config.ts so it
 * works in every environment: Azure App Service, bare VM, and Neon/local.
 *
 * Azure Portal prerequisite (one-time, NOT automated):
 *   PostgreSQL server → Server parameters → azure.extensions → add "VECTOR"
 *   (Also add PG_TRGM if you want fuzzy search.)
 *   Without this portal step the CREATE EXTENSION command will fail on Azure.
 */

import pkg from "pg";
const { Client } = pkg;
import { execSync } from "child_process";

const authMode = (process.env.DB_AUTH_MODE || "").toLowerCase();
const PG_RESOURCE = "https://ossrdbms-aad.database.windows.net";

// ── Token helpers ─────────────────────────────────────────────────────────────

function fetchEntraTokenSync(): string {
  const ep  = process.env.IDENTITY_ENDPOINT;
  const hdr = process.env.IDENTITY_HEADER;

  let raw: string;
  if (ep && hdr) {
    const url = `${ep}?resource=${encodeURIComponent(PG_RESOURCE)}&api-version=2019-08-01`;
    console.log(`[db-prepare] App Service MSI → ${url.split("?")[0]}…`);
    raw = execSync(`curl -s --max-time 15 -H "X-IDENTITY-HEADER: ${hdr}" "${url}"`, { encoding: "utf8" });
  } else {
    const imds =
      "http://169.254.169.254/metadata/identity/oauth2/token" +
      `?api-version=2019-08-01&resource=${encodeURIComponent(PG_RESOURCE)}`;
    console.log("[db-prepare] VM IMDS fallback…");
    raw = execSync(`curl -s --max-time 15 -H "Metadata: true" "${imds}"`, { encoding: "utf8" });
  }

  const parsed = JSON.parse(raw) as { access_token?: string; error_description?: string };
  if (!parsed.access_token) throw new Error(parsed.error_description ?? `No token: ${raw.slice(0, 200)}`);
  return parsed.access_token;
}

// ── Build connection config ───────────────────────────────────────────────────

function getClientConfig(): pkg.ClientConfig {
  if (authMode === "entra" || authMode === "hybrid") {
    return {
      host:     process.env.DB_HOST!,
      user:     process.env.DB_USER!,
      database: process.env.DB_NAME!,
      password: fetchEntraTokenSync(),
      // Set DB_TLS_REJECT_UNAUTHORIZED=false in Azure private VNet environments
      ssl:      { rejectUnauthorized: process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false' },
      port:     5432,
    };
  }

  if (authMode === "postgres-azure") {
    return {
      host:     process.env.DB_HOST!,
      user:     process.env.DB_USER!,
      database: process.env.DB_NAME!,
      password: process.env.DB_PASSWORD!,
      // Set DB_TLS_REJECT_UNAUTHORIZED=false in Azure private VNet environments
      ssl:      { rejectUnauthorized: process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false' },
      port:     5432,
    };
  }

  // Neon / local
  const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("No database URL configured. Set DATABASE_URL or DB_AUTH_MODE + DB_HOST/USER/NAME.");
  return { connectionString: url };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("===========================================");
  console.log("[db-prepare] Creating PostgreSQL extensions");
  console.log(`[db-prepare] DB_AUTH_MODE = ${authMode || "(unset — using URL)"}`);
  console.log("===========================================");

  const client = new Client(getClientConfig());
  await client.connect();

  const extensions = [
    { name: "vector",   desc: "pgvector — required for embedding columns (vector(1024), vector(3072))" },
    { name: "pg_trgm",  desc: "pg_trgm  — required for fuzzy-text search indexes" },
    { name: "uuid-ossp",desc: "uuid-ossp — UUID generation (gen_random_uuid fallback)" },
  ];

  for (const ext of extensions) {
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "${ext.name}"`);
      console.log(`[db-prepare] ✅ ${ext.desc}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // uuid-ossp may not be needed if gen_random_uuid() is available (pg 13+)
      if (ext.name === "uuid-ossp") {
        console.warn(`[db-prepare] ⚠️  ${ext.name} skipped: ${msg}`);
      } else {
        // vector / pg_trgm failures are fatal
        console.error(`[db-prepare] ❌ Failed to create extension "${ext.name}": ${msg}`);
        console.error("");
        console.error("  Azure Portal prerequisite (one-time manual step):");
        console.error("  PostgreSQL server → Server parameters → azure.extensions");
        console.error(`  → add "${ext.name.toUpperCase()}" to the list → Save`);
        console.error("");
        await client.end();
        process.exit(1);
      }
    }
  }

  await client.end();
  console.log("===========================================");
  console.log("[db-prepare] ✅ Extensions ready — proceeding to drizzle-kit push");
  console.log("===========================================");
}

main().catch((err) => {
  console.error("[db-prepare] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
