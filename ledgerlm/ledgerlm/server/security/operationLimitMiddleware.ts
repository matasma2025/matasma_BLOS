import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ipKeyGenerator } from "express-rate-limit";
import {
  budgetKey, operationForRequest, type Budget, type BudgetStore,
  type BudgetDecision, type LeaseScope, type Operation, type OperationPolicies,
} from "./operationLimitPolicy";

type Scope = { tenantId?: string; cost?: number };
interface Dependencies {
  store: BudgetStore;
  policies: OperationPolicies;
  concurrency?: { actor: number; tenant: number };
  resolveScope(req: Request, operation: Operation): Promise<Scope>;
  log(event: Record<string, unknown>): void;
}
interface RequestLease { retained: boolean; release(): Promise<void> }
const requestLeases = new WeakMap<Request, RequestLease>();

/** Background runs keep their slot after the HTTP response completes. */
export async function retainOperationLease<T>(req: Request, work: Promise<T>): Promise<T> {
  const lease = requestLeases.get(req);
  if (lease) lease.retained = true;
  try { return await work; }
  finally { await lease?.release(); }
}

export function createOperationLimitMiddleware(deps: Dependencies) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const actor = req.session?.userId;
    const ip = ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
    const path = req.originalUrl.split("?")[0].replace(/\/+$/, "") || "/";
    const operation = operationForRequest(req.method, path);
    let tenantId: string | undefined;
    const budgets: Budget[] = [];
    const scopes: LeaseScope[] = [];
    const add = (key: string, limit: number, windowMs: number, cost = 1, chargeOnDeny = false) =>
      budgets.push({ key, limit, windowMs, cost, chargeOnDeny });
    // Separate account and IP counters: changing sessions/IPs/tenants never
    // resets the authenticated actor's allowance. Corporate NAT has headroom.
    add(budgetKey("api", actor ? "actor" : "anonymous-ip", actor || ip), 100, 60_000, 1, true);
    if (actor) add(budgetKey("api", "authenticated-ip", ip), 1000, 60_000, 1, true);

    const limited = (decision: BudgetDecision, name: string) => {
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("RateLimit-Reset", String(decision.resetAfter));
      res.setHeader("Retry-After", String(Math.max(1, decision.retryAfter)));
      deps.log({ event: "request_throttled", operation: name,
        actorId: actor || null, tenantId: tenantId || null, retryAfter: decision.retryAfter, status: 429 });
      return res.status(429).json({
        error: `Too many requests. Please try again in ${decision.retryAfter} seconds.`,
        code: "RATE_LIMITED", retryAfter: decision.retryAfter, operation: name,
      });
    };
    try {
      // Charge general requests before resource lookups, including unauthorized
      // attempts and operation denials. Once exhausted, no scope lookup runs.
      const general = await deps.store.consume(budgets);
      if (!general.allowed) return limited(general, "api");
      if (!operation) {
        res.setHeader("RateLimit-Remaining", String(general.remaining));
        res.setHeader("RateLimit-Reset", String(general.resetAfter));
        return next();
      }
      budgets.length = 0;
      if (operation) {
        const isPublic = operation.startsWith("public.");
        if (!actor && !isPublic) return res.status(401).json({ error: "Authentication required" });
        const scope = await deps.resolveScope(req, operation);
        tenantId = scope.tenantId;
        const policy = deps.policies[operation];
        const cost = scope.cost ?? 1;
        if (!Number.isSafeInteger(cost) || cost < 1) {
          return res.status(400).json({ error: "Invalid operation size" });
        }
        const identity = actor || `ip:${ip}`;
        add(budgetKey(operation, "actor", identity, "burst"), policy.limit, policy.windowMs, cost);
        add(budgetKey(operation, "actor", identity, "hour"), policy.hourLimit, 3_600_000, cost);
        // Non-public resources with no domain (personal accounts) still have
        // both account and IP controls; never invent a tenant from client input.
        if (scope.tenantId) {
          add(budgetKey(operation, "tenant", scope.tenantId, "burst"),
            policy.limit * policy.tenantMultiplier, policy.windowMs, cost);
          add(budgetKey(operation, "tenant", scope.tenantId, "hour"),
            policy.hourLimit * policy.tenantMultiplier, 3_600_000, cost);
        }
        add(budgetKey(operation, "ip", ip), policy.limit * (isPublic ? 1 : 20), policy.windowMs, cost);
        if (isPublic) {
          const subject = operation === "public.register" ? req.body?.username : req.body?.token;
          if (typeof subject === "string" && subject.trim()) {
            add(budgetKey(operation, "subject", operation === "public.register"
              ? subject.trim().toLowerCase() : subject.trim()),
              policy.limit, policy.windowMs);
          }
        }
        if (policy.expensive && actor) {
          scopes.push({ key: budgetKey("expensive", "actor", actor), limit: deps.concurrency?.actor ?? 2 });
          if (scope.tenantId) scopes.push({
            key: budgetKey("expensive", "tenant", scope.tenantId), limit: deps.concurrency?.tenant ?? 20,
          });
        }
      }

      const leaseId = scopes.length ? randomUUID() : undefined;
      const decision = await deps.store.consume(budgets, scopes, leaseId);
      res.setHeader("RateLimit-Remaining", String(Math.min(general.remaining, decision.remaining)));
      res.setHeader("RateLimit-Reset", String(Math.max(general.resetAfter, decision.resetAfter)));
      if (!decision.allowed) {
        return limited(decision, operation);
      }
      if (leaseId) {
        let released = false;
        const heartbeat = setInterval(() => {
          deps.store.renew(leaseId).catch(() => {
            deps.log({ event: "operation_lease_renewal_failed", operation, actorId: actor });
          });
        }, 30_000);
        heartbeat.unref();
        const lease: RequestLease = {
          retained: false,
          async release() {
            if (released) return;
            released = true;
            clearInterval(heartbeat);
            await deps.store.release(leaseId).catch(() =>
              deps.log({ event: "operation_lease_release_failed", operation, actorId: actor }));
          },
        };
        requestLeases.set(req, lease);
        const finish = () => { if (!lease.retained) void lease.release(); };
        res.once("finish", finish);
        res.once("close", finish);
      }
      next();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status && [400, 401, 403, 404].includes(status)) {
        return res.status(status).json({ error: (error as Error).message });
      }
      deps.log({ event: "rate_store_unavailable", operation: operation || "api", status: 503 });
      res.setHeader("Retry-After", "30");
      return res.status(503).json({
        error: "Request protection is temporarily unavailable. Please try again shortly.",
        code: "RATE_LIMIT_STORE_UNAVAILABLE", retryAfter: 30,
      });
    }
  };
}
