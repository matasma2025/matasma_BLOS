import cors from "cors";
import type { Express, Request, RequestHandler } from "express";
import type { Server } from "node:http";

const STANDARD_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const API_PATH = /^\/api(?:\/|$)/i;

type RouteLayer = {
  route?: { methods: Record<string, boolean> };
  match: (path: string) => boolean;
};
type PolicyOptions = {
  allowedOrigins?: string[];
  publicUrl?: string;
  developmentOrigins?: string[];
  resolveDelegatedMethods?: (path: string) => Promise<readonly string[]>;
};

function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.origin : null;
  } catch { return null; }
}

function permittedOrigin(req: Request, origins: Set<string>): boolean {
  const supplied = req.headers.origin;
  if (!supplied) return true; // CORS is not an authentication mechanism.
  const normalized = originOf(supplied);
  // Reject opaque origins and malformed values with paths, credentials, etc.
  if (!normalized || normalized !== supplied) return false;
  if (origins.has(normalized)) return true;
  // Preserve genuine same-origin requests. Do not trust forwarded Host headers.
  const host = req.get("host");
  return !!host && normalized === originOf(`${req.protocol}://${host}`);
}

function ordered(methods: Iterable<string>): string[] {
  const set = new Set(methods);
  set.add("OPTIONS");
  return STANDARD_METHODS.filter(method => set.has(method));
}

async function routeMethods(app: Express, path: string, options: PolicyOptions): Promise<string[]> {
  const layers = (app as Express & { _router?: { stack: RouteLayer[] } })._router?.stack ?? [];
  const methods = new Set<string>();
  let delegated = false;
  for (const layer of layers) {
    if (!layer.route || !layer.match(path)) continue;
    // Express app.all() expands into every Node HTTP method rather than _all.
    if (layer.route.methods._all || layer.route.methods.trace || layer.route.methods.connect) delegated = true;
    else {
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled) methods.add(method.toUpperCase());
      }
      if (layer.route.methods.get) methods.add("HEAD"); // Express's GET fallback.
    }
  }
  if (delegated) {
    if (!options.resolveDelegatedMethods) throw new Error("Delegated method policy unavailable");
    for (const method of await options.resolveDelegatedMethods(path)) methods.add(method.toUpperCase());
  }
  return methods.size ? ordered(methods) : [];
}

export function createHttpMethodPolicy(app: Express, options: PolicyOptions = {}): RequestHandler {
  const origins = new Set<string>();
  for (const value of [...(options.allowedOrigins ?? []), ...(options.developmentOrigins ?? [])]) {
    const normalized = originOf(value);
    if (!normalized || ![normalized, `${normalized}/`].includes(value)) {
      throw new Error("CORS configuration must contain explicit HTTP(S) origins");
    }
    origins.add(normalized);
  }
  if (options.publicUrl) {
    const normalized = originOf(options.publicUrl);
    if (!normalized) throw new Error("Invalid public application URL for CORS");
    origins.add(normalized);
  }

  return async (req, res, next) => {
    res.vary("Origin"); // Denied-origin responses must not poison shared caches.
    if (API_PATH.test(req.path)) res.setHeader("Cache-Control", "no-store");
    // Block unsafe/unsupported protocol methods before CORS, sessions or CSRF.
    if (!STANDARD_METHODS.includes(req.method)) {
      let allowed: string[] = [];
      try { allowed = await routeMethods(app, req.path, options); } catch { /* Still reject. */ }
      if (!allowed.length && !API_PATH.test(req.path)) allowed = ["GET", "HEAD", "OPTIONS"];
      res.setHeader("Allow", allowed.join(", "));
      res.status(405).json({ error: "HTTP method not allowed" });
      return;
    }
    if (!permittedOrigin(req, origins)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    let methods: string[];
    try {
      methods = await routeMethods(app, req.path, options);
    } catch {
      res.status(503).json({ error: "Unable to verify supported API methods" });
      return;
    }
    if (!methods.length) {
      if (API_PATH.test(req.path)) {
        res.status(404).json({ error: "API route not found" });
        return;
      }
      methods = ["GET", "HEAD", "OPTIONS"]; // SPA pages/assets, never mutations.
    }
    const requested = req.headers["access-control-request-method"];
    if (!methods.includes(req.method) ||
        (req.method === "OPTIONS" && requested && !methods.includes(String(requested).toUpperCase()))) {
      res.setHeader("Allow", methods.join(", "));
      res.status(405).json({ error: "HTTP method not allowed" });
      return;
    }
    // Keep preflight ahead of session/CSRF checks, with only this route's methods.
    cors({
      origin: req.headers.origin || false,
      credentials: true,
      methods,
      allowedHeaders: [
        "Content-Type", "Authorization", "x-user-id", "x-csrf-token",
        "x-device-credential-id", "x-device-proof-nonce", "x-device-proof-timestamp", "x-device-proof-signature",
      ],
      preflightContinue: true,
    })(req, res, error => {
      if (error) return next(error);
      if (req.method === "OPTIONS") {
        res.setHeader("Allow", methods.join(", "));
        res.status(204).end();
      } else next();
    });
  };
}

export function rejectHttpConnect(server: Server): void {
  // CONNECT is dispatched by Node as a socket event, not Express middleware.
  // Leave the independent WebSocket "upgrade" mechanism unchanged.
  server.on("connect", (_req, socket) => {
    socket.end("HTTP/1.1 405 Method Not Allowed\r\nAllow: GET, HEAD, OPTIONS\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
  });
}

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "API route not found" });
};
