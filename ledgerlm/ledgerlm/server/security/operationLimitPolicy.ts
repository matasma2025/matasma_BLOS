import { createHash } from "node:crypto";

export interface OperationPolicy {
  limit: number;
  windowMs: number;
  hourLimit: number;
  tenantMultiplier: number;
  expensive?: boolean;
}

export const DEFAULT_OPERATION_POLICIES = {
  "board.create": { limit: 10, windowMs: 60_000, hourLimit: 100, tenantMultiplier: 10 },
  "chat.create": { limit: 20, windowMs: 60_000, hourLimit: 300, tenantMultiplier: 10 },
  "cube.create": { limit: 5, windowMs: 300_000, hourLimit: 30, tenantMultiplier: 10 },
  "user.create": { limit: 10, windowMs: 60_000, hourLimit: 100, tenantMultiplier: 10 },
  "domain.create": { limit: 5, windowMs: 300_000, hourLimit: 30, tenantMultiplier: 10 },
  "connector.create": { limit: 5, windowMs: 300_000, hourLimit: 30, tenantMultiplier: 10 },
  "metadata.create": { limit: 20, windowMs: 60_000, hourLimit: 300, tenantMultiplier: 10 },
  "analysis.start": { limit: 5, windowMs: 60_000, hourLimit: 100, tenantMultiplier: 10, expensive: true },
  "export.start": { limit: 10, windowMs: 60_000, hourLimit: 100, tenantMultiplier: 10, expensive: true },
  "ingestion.start": { limit: 5, windowMs: 60_000, hourLimit: 30, tenantMultiplier: 10, expensive: true },
  "upload.create": { limit: 10, windowMs: 900_000, hourLimit: 30, tenantMultiplier: 10, expensive: true },
  "public.register": { limit: 5, windowMs: 900_000, hourLimit: 20, tenantMultiplier: 1 },
  "public.invitation": { limit: 10, windowMs: 900_000, hourLimit: 30, tenantMultiplier: 1 },
} satisfies Record<string, OperationPolicy>;

export type Operation = keyof typeof DEFAULT_OPERATION_POLICIES;
export type OperationPolicies = Record<Operation, OperationPolicy>;

export function loadOperationPolicies(json?: string): OperationPolicies {
  const result: OperationPolicies = structuredClone(DEFAULT_OPERATION_POLICIES);
  if (!json) return result;
  const overrides = JSON.parse(json);
  if (!overrides || Array.isArray(overrides) || typeof overrides !== "object") {
    throw new Error("RATE_LIMIT_POLICY_JSON must be an object");
  }
  for (const [operation, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(result, operation) || !value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Invalid rate limit policy: ${operation}`);
    }
    for (const [field, number] of Object.entries(value)) {
      if (!["limit", "windowMs", "hourLimit", "tenantMultiplier"].includes(field)
        || !Number.isSafeInteger(number) || Number(number) < 1 || Number(number) > 86_400_000) {
        throw new Error(`Invalid rate limit setting: ${operation}.${field}`);
      }
      (result[operation as Operation] as unknown as Record<string, unknown>)[field] = number;
    }
  }
  return result;
}

export function operationForRequest(method: string, path: string): Operation | undefined {
  // Express routes are case-insensitive by default. Match that behavior here;
  // scope resolution separately preserves the original resource-ID casing.
  path = path.toLowerCase();
  // Reads and cancellations never consume creation/expensive-operation budgets.
  if (method === "GET" && /^\/api\/(?:domain-admin|super-admin)\/(?:sso-audit-logs|audit-logs)\/export$/.test(path)) {
    return "export.start";
  }
  if (method !== "POST") return undefined;
  if (/\/cancel$/.test(path)) return undefined;
  if (path === "/api/auth/register") return "public.register";
  if (path === "/api/invitations/accept") return "public.invitation";
  if (/^\/api\/(?:boards|board-templates)$/.test(path)) return "board.create";
  if (/^\/api\/(?:chats|kiosk\/chats)$/.test(path)
    || /^\/api\/templates\/[^/]+\/use$/.test(path)
    || /^\/api\/boards\/[^/]+\/reports\/[^/]+\/follow-up$/.test(path)) return "chat.create";
  if (path === "/api/domain-admin/cubes") return "cube.create";
  if (path === "/api/domain-admin/users" || path === "/api/admin/invitations"
    || /^\/api\/admin\/invitations\/[^/]+\/resend$/.test(path)) return "user.create";
  if (path === "/api/super-admin/domains") return "domain.create";
  if (path === "/api/domain-admin/connectors") return "connector.create";
  if (/^\/api\/boards\/[^/]+\/reports\/[^/]+\/exports$/.test(path)) return "export.start";
  if (/^\/api\/chats\/[^/]+\/documents$/.test(path)) return "ingestion.start";
  if (/^\/api\/chats\/[^/]+\/messages(?:\/stream)?$/.test(path)
    || /^\/api\/boards\/[^/]+\/(?:analysis-runs|run-analysis)$/.test(path)
    || ["/api/rag/analyze", "/api/kpi-reports/run", "/api/kiosk/chat", "/api/search"].includes(path)) {
    return "analysis.start";
  }
  if (path === "/api/documents" || path === "/api/documents/import-from-url"
    || path === "/api/domain-admin/enterprise-documents" || path === "/api/kiosk/faq-documents"
    || /^\/api\/admin\/companies\/[^/]+\/documents$/.test(path)
    || /\/(?:upload|upload-files|balance-sheet-data)$/.test(path)) return "upload.create";
  if (/^\/api\/domain-admin\/cubes\/[^/]+\/(?:business-terms|calculation-rules|filter-rules|query-patterns|column-values|column-relationships)$/.test(path)
    || /^\/api\/boards\/[^/]+\/threads$/.test(path)) return "metadata.create";
  if (/\/(?:process|trigger|ingest|sync|run-ingestion|refresh)$/.test(path)
    || /\/(?:import-business-logic|seed-bosch-logic|seed-investment-logic|test-blob)$/.test(path)
    || path === "/api/super-admin/backups/trigger"
    || path === "/api/super-admin/retention-policies/run") return "ingestion.start";
  if (/\/connectors\/[^/]+\/test$/.test(path) || /\/cubes\/[^/]+\/sql-query$/.test(path)) return "analysis.start";
  return undefined;
}

export function budgetKey(...parts: string[]) {
  // Neither IP addresses nor invitation tokens/emails are stored in counter keys.
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export interface Budget {
  key: string;
  limit: number;
  windowMs: number;
  cost: number;
  chargeOnDeny?: boolean;
}
export interface LeaseScope { key: string; limit: number }
export interface BudgetDecision { allowed: boolean; retryAfter: number; remaining: number; resetAfter: number }
export interface BudgetStore {
  consume(budgets: Budget[], scopes?: LeaseScope[], leaseId?: string): Promise<BudgetDecision>;
  release(leaseId: string): Promise<void>;
  renew(leaseId: string): Promise<void>;
}

export function loadConcurrencyLimits(json?: string): { actor: number; tenant: number } {
  const limits = { actor: 2, tenant: 20 };
  if (!json) return limits;
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid concurrency limits");
  for (const [key, value] of Object.entries(parsed)) {
    if (!Object.hasOwn(limits, key) || !Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 1000) {
      throw new Error("Invalid concurrency limits");
    }
    limits[key as keyof typeof limits] = Number(value);
  }
  return limits;
}
