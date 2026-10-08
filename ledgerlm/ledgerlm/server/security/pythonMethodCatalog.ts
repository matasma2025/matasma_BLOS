type PathMethods = { pattern: RegExp; methods: string[] };

function pathPattern(path: string): RegExp {
  const segments = path.replace(/\/$/, "").split("/").map(segment =>
    /^\{[^{}]+\}$/.test(segment) ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${segments.join("/")}/?$`);
}

// The wildcard proxies delegate routing to FastAPI. Its published API definition
// is authoritative; a hard-coded broad method list would miss per-route rules.
export function createPythonMethodCatalog(
  baseUrl: string,
  fetchDefinition: typeof fetch = fetch,
  now: () => number = Date.now,
) {
  let cached: PathMethods[] | undefined;
  let validUntil = 0;
  let pending: Promise<PathMethods[]> | undefined;
  let failedUntil = 0;

  async function catalog(): Promise<PathMethods[]> {
    if (cached && now() < validUntil) return cached;
    if (now() < failedUntil) throw new Error("Backend method catalog unavailable");
    if (!pending) {
      pending = (async () => {
        try {
          const response = await fetchDefinition(`${baseUrl.replace(/\/$/, "")}/openapi.json`, {
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) throw new Error("Backend method catalog unavailable");
          const definition = await response.json();
          if (!definition.paths || typeof definition.paths !== "object" || Array.isArray(definition.paths)) {
            throw new Error("Invalid backend method catalog");
          }
          const entries: PathMethods[] = [];
          for (const [path, operations] of Object.entries(definition.paths)) {
            if (!/^\/api\/v2\/(?:semantic-sql|schema-config)\//.test(path)) continue;
            if (!operations || typeof operations !== "object" || Array.isArray(operations)) continue;
            const methods = Object.keys(operations).filter(method =>
              ["get", "head", "post", "put", "patch", "delete"].includes(method)).map(method => method.toUpperCase());
            if (methods.length) entries.push({ pattern: pathPattern(path), methods });
          }
          cached = entries;
          validUntil = now() + 60_000;
          return entries;
        } catch (error) {
          failedUntil = now() + 1000; // Coalesce outages, never fail open.
          throw error;
        } finally { pending = undefined; }
      })();
    }
    return pending;
  }

  return async (path: string): Promise<readonly string[]> => {
    let decoded: string;
    try { decoded = decodeURIComponent(path); }
    catch { return []; }
    const methods = new Set<string>();
    for (const entry of await catalog()) {
      if (entry.pattern.test(decoded)) entry.methods.forEach(method => methods.add(method));
    }
    return [...methods];
  };
}
