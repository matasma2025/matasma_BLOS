import type { ClientConfig } from "pg";

/** Explicit UTC sessions, including URLs whose options override pg's config. */
export function utcDatabaseConfig(config: ClientConfig): ClientConfig {
  const utcOption = "-c timezone=UTC";
  if (config.connectionString) {
    let url: URL;
    try { url = new URL(config.connectionString); }
    catch { throw new Error("Invalid database connection URL"); }
    const existing = url.searchParams.get("options") ?? config.options ?? "";
    url.searchParams.set("options", `${existing} ${utcOption}`.trim());
    return { ...config, connectionString: url.toString() };
  }
  return { ...config, options: `${config.options ?? ""} ${utcOption}`.trim() };
}

/** Elapsed durations must not use local calendar arithmetic across DST. */
export function expiresAfter(milliseconds: number, now = Date.now()): Date {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error("Expiry duration must be a positive finite number");
  }
  return new Date(now + milliseconds);
}
