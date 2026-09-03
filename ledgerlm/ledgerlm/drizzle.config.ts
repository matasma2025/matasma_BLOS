import { defineConfig } from "drizzle-kit";
import { execSync } from "child_process";

const authMode = (process.env.DB_AUTH_MODE || "").toLowerCase();

// Azure PostgreSQL resource URI (same for both IMDS and App Service MSI)
const PG_RESOURCE = "https%3A%2F%2Fossrdbms-aad.database.windows.net";

// VM IMDS endpoint (works on bare Azure VMs, NOT in App Service containers)
const VM_IMDS_URL =
  `http://169.254.169.254/metadata/identity/oauth2/token` +
  `?api-version=2019-08-01&resource=${PG_RESOURCE}`;

/**
 * Fetch an Entra ID token for PostgreSQL authentication.
 *
 * Azure exposes two different MSI endpoints depending on where the code runs:
 *
 *   App Service / Container Apps:
 *     URL    → $IDENTITY_ENDPOINT?resource=...&api-version=2019-08-01
 *     Header → X-IDENTITY-HEADER: $IDENTITY_HEADER
 *
 *   Bare VM / VMSS:
 *     URL    → http://169.254.169.254/metadata/identity/oauth2/token?...
 *     Header → Metadata: true
 *
 * We try the App Service path first (env vars present) and fall back to IMDS.
 */
function fetchEntraTokenSync(): string {
  const identityEndpoint = process.env.IDENTITY_ENDPOINT;
  const identityHeader   = process.env.IDENTITY_HEADER;

  try {
    let raw: string;

    if (identityEndpoint && identityHeader) {
      // ── Azure App Service / Container Apps MSI ──────────────────────────────
      // This is the CORRECT path for App Service deployments.
      const url = `${identityEndpoint}?resource=https://ossrdbms-aad.database.windows.net&api-version=2019-08-01`;
      console.log(`[drizzle] Using App Service MSI endpoint: ${url.split('?')[0]}…`);
      raw = execSync(
        `curl -s --max-time 15 -H "X-IDENTITY-HEADER: ${identityHeader}" "${url}"`,
        { encoding: "utf8" }
      );
    } else {
      // ── VM IMDS fallback ────────────────────────────────────────────────────
      // Only reaches here when IDENTITY_ENDPOINT is not set (bare VM, local debug).
      console.log("[drizzle] IDENTITY_ENDPOINT not set — falling back to VM IMDS.");
      raw = execSync(
        `curl -s --max-time 15 -H "Metadata: true" "${VM_IMDS_URL}"`,
        { encoding: "utf8" }
      );
    }

    const parsed = JSON.parse(raw) as { access_token?: string; error?: string; error_description?: string };
    if (!parsed.access_token) {
      throw new Error(
        parsed.error_description ?? parsed.error ?? `No access_token in response: ${raw.slice(0, 200)}`
      );
    }

    console.log("[drizzle] ✅ Entra token fetched — running migrations with Managed Identity.");
    return parsed.access_token;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[drizzle] ❌ Failed to fetch Entra token.\n` +
      `  IDENTITY_ENDPOINT = ${identityEndpoint ?? "(not set — expected for App Service)"}\n` +
      `  IDENTITY_HEADER   = ${identityHeader   ? "(present)" : "(not set)"}\n` +
      `  DB_AUTH_MODE      = ${authMode}\n` +
      `  Ensure the App Service has a System-assigned Managed Identity enabled\n` +
      `  and that identity is registered as a PostgreSQL Entra administrator.\n` +
      `  Detail: ${msg}`
    );
  }
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} must be set when DB_AUTH_MODE=${authMode}`);
  return val;
}

// ── Resolve DB credentials once at migration time ─────────────────────────────
const dbCredentials = (() => {
  if (authMode === "entra" || authMode === "hybrid") {
    return {
      host:     requireEnv("DB_HOST"),
      user:     requireEnv("DB_USER"),
      database: requireEnv("DB_NAME"),
      password: fetchEntraTokenSync(),
      // Private endpoint PostgreSQL: cert may not be in the container trust store.
      // Set DB_TLS_REJECT_UNAUTHORIZED=false in Azure private VNet environments to
      // keep the connection encrypted while bypassing CA chain validation.
      ssl: { rejectUnauthorized: process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false' },
    };
  }

  if (authMode === "postgres-azure") {
    return {
      host:     requireEnv("DB_HOST"),
      user:     requireEnv("DB_USER"),
      database: requireEnv("DB_NAME"),
      password: requireEnv("DB_PASSWORD"),
      // Set DB_TLS_REJECT_UNAUTHORIZED=false in Azure private VNet environments
      ssl: { rejectUnauthorized: process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false' },
    };
  }

  // Default: Neon cloud or local Postgres via connection URL
  const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database configured. Set DATABASE_URL for Neon/local, " +
      "or set DB_AUTH_MODE + DB_HOST + DB_USER + DB_NAME for Azure."
    );
  }
  return { url };
})();

export default defineConfig({
  out:      "./migrations",
  schema:   "./shared/schema.ts",
  dialect:  "postgresql",
  dbCredentials,
});
