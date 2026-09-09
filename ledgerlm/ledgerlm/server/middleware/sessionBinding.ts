import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";

const SESSION_BINDING_VERSION = 1;
const DEFAULT_ABSOLUTE_SESSION_AGE_MS = 8 * 60 * 60 * 1000;
export const SESSION_BINDING_COOKIE = "ledgerlm.binding";

function bindingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
}

function parseCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function clearAuthenticationCookies(res: Response): void {
  const { maxAge: _maxAge, ...options } = bindingCookieOptions();
  res.clearCookie("connect.sid", options);
  res.clearCookie(SESSION_BINDING_COOKIE, options);
}

function getAbsoluteSessionAgeMs(): number {
  const configured = Number.parseInt(
    process.env.SESSION_ABSOLUTE_MAX_AGE_MS ?? "",
    10,
  );
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_ABSOLUTE_SESSION_AGE_MS;
}

function hashClientSignal(label: string, value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  return createHmac("sha256", secret)
    .update(`${SESSION_BINDING_VERSION}:${label}:${value}`)
    .digest("hex");
}

function normalizeUserAgent(req: Request): string {
  return (req.get("user-agent") ?? "missing-user-agent")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 512);
}

function normalizeNetwork(req: Request): string {
  const rawIp = req.ip || req.socket.remoteAddress || "unknown";
  const ip = rawIp.replace(/^::ffff:/, "");

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    return ip.split(".").slice(0, 3).join(".");
  }

  if (ip.includes(":")) {
    return ip.split(":").slice(0, 4).join(":");
  }

  return ip;
}

function getUserAgentBinding(req: Request): string {
  return hashClientSignal("user-agent", normalizeUserAgent(req));
}

function getNetworkBinding(req: Request): string {
  return hashClientSignal("network", normalizeNetwork(req));
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

export async function establishAuthenticatedSession(
  req: Request,
  res: Response,
  userId: string,
  deviceCredentialId: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });

  const browserBindingToken = randomBytes(32).toString("base64url");
  req.session.userId = userId;
  req.session.deviceCredentialId = deviceCredentialId;
  req.session.deviceProofVersion = 1;
  req.session.clientBinding = getUserAgentBinding(req);
  req.session.clientNetworkBinding = getNetworkBinding(req);
  req.session.browserBinding = hashClientSignal(
    "browser-token",
    browserBindingToken,
  );
  req.session.clientBindingVersion = SESSION_BINDING_VERSION;
  req.session.authenticatedAt = Date.now();
  await saveSession(req);
  res.cookie(
    SESSION_BINDING_COOKIE,
    browserBindingToken,
    bindingCookieOptions(),
  );
}

function invalidateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  reason:
    | "binding_mismatch"
    | "browser_binding_mismatch"
    | "missing_binding"
    | "absolute_timeout",
): void {
  const userId = req.session.userId;
  console.warn(
    `[SECURITY] Session invalidated | reason=${reason} | userId=${userId ?? "unknown"} | path=${req.path}`,
  );

  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    clearAuthenticationCookies(res);
    if (req.path.startsWith("/api")) {
      return res.status(401).json({
        error: "Session security validation failed. Please sign in again.",
      });
    }
    next();
  });
}

export function enforceSessionBinding(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session?.userId) {
    return next();
  }

  const now = Date.now();
  const currentUserAgentBinding = getUserAgentBinding(req);
  const currentNetworkBinding = getNetworkBinding(req);
  const browserBindingToken = parseCookie(req, SESSION_BINDING_COOKIE);

  // Sessions created before browser-token binding cannot be trusted because a
  // stolen legacy session could otherwise bind itself on first use.
  if (
    !req.session.clientBinding ||
    !req.session.browserBinding ||
    req.session.clientBindingVersion !== SESSION_BINDING_VERSION ||
    !req.session.authenticatedAt
  ) {
    invalidateSession(req, res, next, "missing_binding");
    return;
  }

  if (
    now - req.session.authenticatedAt >
    getAbsoluteSessionAgeMs()
  ) {
    invalidateSession(req, res, next, "absolute_timeout");
    return;
  }

  if (!safeEqual(req.session.clientBinding, currentUserAgentBinding)) {
    invalidateSession(req, res, next, "binding_mismatch");
    return;
  }

  if (
    !browserBindingToken ||
    !safeEqual(
      req.session.browserBinding,
      hashClientSignal("browser-token", browserBindingToken),
    )
  ) {
    invalidateSession(req, res, next, "browser_binding_mismatch");
    return;
  }

  // Corporate proxies and VPNs can legitimately change a user's IP range.
  // Record the new HMAC'd network signal without interrupting the session.
  if (
    req.session.clientNetworkBinding &&
    !safeEqual(req.session.clientNetworkBinding, currentNetworkBinding)
  ) {
    console.warn(
      `[SECURITY] Session network changed | userId=${req.session.userId} | path=${req.path}`,
    );
    req.session.clientNetworkBinding = currentNetworkBinding;
  }

  next();
}