/**
 * Azure Entra ID token fetcher for PostgreSQL Managed Identity auth.
 *
 * Azure exposes two different MSI endpoints depending on the host:
 *
 *   App Service / Container Apps:
 *     URL    → $IDENTITY_ENDPOINT?resource=...&api-version=2019-08-01
 *     Header → X-IDENTITY-HEADER: $IDENTITY_HEADER
 *
 *   Bare VM / VMSS:
 *     URL    → http://169.254.169.254/metadata/identity/oauth2/token?...
 *     Header → Metadata: true
 *
 * We try the App Service path first and fall back to VM IMDS.
 * Token is cached in-process and refreshed 5 minutes before expiry.
 */

interface TokenCache {
  token:     string;
  expiresAt: number; // unix milliseconds
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const PG_RESOURCE  = "https://ossrdbms-aad.database.windows.net";
const COG_RESOURCE = "https://cognitiveservices.azure.com/";

// VM IMDS endpoint (fallback — not available inside App Service containers)
const VM_IMDS_URL =
  "http://169.254.169.254/metadata/identity/oauth2/token" +
  "?api-version=2019-08-01" +
  "&resource=https%3A%2F%2Fossrdbms-aad.database.windows.net";

let tokenCache: TokenCache | null = null;
let cogTokenCache: TokenCache | null = null;

export async function getEntraToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still fresh
  if (tokenCache && tokenCache.expiresAt - now > REFRESH_BUFFER_MS) {
    return tokenCache.token;
  }

  const identityEndpoint = process.env.IDENTITY_ENDPOINT;
  const identityHeader   = process.env.IDENTITY_HEADER;

  let res: Response;

  if (identityEndpoint && identityHeader) {
    // ── Azure App Service / Container Apps MSI ────────────────────────────────
    const url = `${identityEndpoint}?resource=${encodeURIComponent(PG_RESOURCE)}&api-version=2019-08-01`;
    console.log("[EntraToken] Using App Service MSI endpoint…");
    res = await fetch(url, {
      headers: { "X-IDENTITY-HEADER": identityHeader },
      signal: AbortSignal.timeout(15_000),
    });
  } else {
    // ── VM IMDS fallback ──────────────────────────────────────────────────────
    console.log("[EntraToken] IDENTITY_ENDPOINT not set — using VM IMDS endpoint…");
    res = await fetch(VM_IMDS_URL, {
      headers: { Metadata: "true" },
      signal: AbortSignal.timeout(15_000),
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[EntraToken] Token fetch failed: HTTP ${res.status} — ${body}\n` +
      `  IDENTITY_ENDPOINT = ${identityEndpoint ?? "(not set)"}\n` +
      `  IDENTITY_HEADER   = ${identityHeader   ? "(present)" : "(not set)"}`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_on:   string; // unix seconds as string
  };

  if (!data.access_token) {
    throw new Error("[EntraToken] Response had no access_token: " + JSON.stringify(data).slice(0, 200));
  }

  tokenCache = {
    token:     data.access_token,
    expiresAt: parseInt(data.expires_on, 10) * 1000,
  };

  const expiresInMin = Math.round((tokenCache.expiresAt - now) / 60_000);
  console.log(`[EntraToken] ✅ Token fetched. Expires in ~${expiresInMin} min.`);

  return tokenCache.token;
}

/**
 * Fetch an Entra ID Bearer token for Azure Cognitive Services / Azure OpenAI.
 * Scope: https://cognitiveservices.azure.com/
 * Uses App Service MSI endpoint when available, falls back to VM IMDS.
 */
export async function getAzureOpenAIToken(): Promise<string> {
  const now = Date.now();

  if (cogTokenCache && cogTokenCache.expiresAt - now > REFRESH_BUFFER_MS) {
    return cogTokenCache.token;
  }

  const identityEndpoint = process.env.IDENTITY_ENDPOINT;
  const identityHeader   = process.env.IDENTITY_HEADER;

  let res: Response;

  if (identityEndpoint && identityHeader) {
    const url = `${identityEndpoint}?resource=${encodeURIComponent(COG_RESOURCE)}&api-version=2019-08-01`;
    console.log("[EntraToken/OpenAI] Using App Service MSI endpoint for Cognitive Services…");
    res = await fetch(url, {
      headers: { "X-IDENTITY-HEADER": identityHeader },
      signal: AbortSignal.timeout(15_000),
    });
  } else {
    const vmUrl =
      "http://169.254.169.254/metadata/identity/oauth2/token" +
      "?api-version=2019-08-01" +
      `&resource=${encodeURIComponent(COG_RESOURCE)}`;
    console.log("[EntraToken/OpenAI] IDENTITY_ENDPOINT not set — using VM IMDS for Cognitive Services…");
    res = await fetch(vmUrl, {
      headers: { Metadata: "true" },
      signal: AbortSignal.timeout(15_000),
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[EntraToken/OpenAI] Token fetch failed: HTTP ${res.status} — ${body}\n` +
      `  IDENTITY_ENDPOINT = ${identityEndpoint ?? "(not set)"}\n` +
      `  IDENTITY_HEADER   = ${identityHeader   ? "(present)" : "(not set)"}`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_on:   string;
  };

  if (!data.access_token) {
    throw new Error("[EntraToken/OpenAI] Response had no access_token: " + JSON.stringify(data).slice(0, 200));
  }

  cogTokenCache = {
    token:     data.access_token,
    expiresAt: parseInt(data.expires_on, 10) * 1000,
  };

  const expiresInMin = Math.round((cogTokenCache.expiresAt - now) / 60_000);
  console.log(`[EntraToken/OpenAI] ✅ Cognitive Services token fetched. Expires in ~${expiresInMin} min.`);

  return cogTokenCache.token;
}

/** For the admin status panel — returns cache state without fetching */
export function getTokenStatus(): {
  cached:       boolean;
  expiresInMs?: number;
  expiresInMin?: number;
} {
  if (!tokenCache) return { cached: false };
  const expiresInMs = tokenCache.expiresAt - Date.now();
  return { cached: true, expiresInMs, expiresInMin: Math.round(expiresInMs / 60_000) };
}
