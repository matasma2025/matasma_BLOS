import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "FILE_UPLOAD"
  | "FILE_DELETE"
  | "QUERY_RUN"
  | "ADMIN_DOMAIN_CREATE"
  | "ADMIN_DOMAIN_UPDATE"
  | "ADMIN_DOMAIN_DELETE"
  | "ADMIN_CUBE_CREATE"
  | "ADMIN_CUBE_DELETE"
  | "ADMIN_USER_INVITE"
  | "ADMIN_USER_REMOVE"
  // ── SSO User Lifecycle ──────────────────────────────────────────────────────
  | "SSO_LOGIN"             // successful SSO login (existing + returning users)
  | "SSO_LOGIN_FAILED"      // login attempt blocked (not_in_group, inactive, mismatch…)
  | "SSO_USER_PROVISIONED"  // new user auto-created from AD group membership on first login
  | "SSO_USER_DEACTIVATED"  // user deactivated by background sync (removed from all groups)
  | "SSO_ROLE_SYNCED"       // role updated at login time (AD promotion/demotion)
  | "SSO_ROLE_UPDATED";     // role updated by background sync job

interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  resource?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  status?: "success" | "failed";
  details?: Record<string, unknown> | null;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address, status, details)
      VALUES (
        ${entry.userId ?? null},
        ${entry.action},
        ${entry.resource ?? null},
        ${entry.resourceId ?? null},
        ${entry.ipAddress ?? null},
        ${entry.status ?? "success"},
        ${entry.details ? JSON.stringify(entry.details) : null}
      )
    `);
  } catch (err) {
    logger.warn({ err, entry }, "writeAuditLog failed — non-blocking");
  }
}

export function extractIp(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return (req.socket?.remoteAddress ?? "unknown");
}
