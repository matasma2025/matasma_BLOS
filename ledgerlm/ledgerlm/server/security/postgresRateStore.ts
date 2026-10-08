import { sql, type SQL } from "drizzle-orm";
import type { IncrementResponse, Options, Store } from "express-rate-limit";
import { budgetKey, type Budget, type BudgetDecision, type BudgetStore, type LeaseScope } from "./operationLimitPolicy";

export type ExecuteSql = (query: SQL) => Promise<unknown>;
export function resultRows(result: unknown): Record<string, any>[] {
  return Array.isArray(result) ? result : (result as { rows?: Record<string, any>[] })?.rows ?? [];
}

export class PostgresBudgetStore implements BudgetStore {
  constructor(private execute: ExecuteSql) {}
  async consume(budgets: Budget[], scopes: LeaseScope[] = [], leaseId?: string): Promise<BudgetDecision> {
    const result = await this.execute(sql`SELECT ledgerlm_consume_rate_budget(
      ${JSON.stringify(budgets)}::jsonb, ${JSON.stringify(scopes)}::jsonb,
      ${leaseId ?? null}::text) AS decision`);
    const decision = resultRows(result)[0]?.decision;
    if (!decision || typeof decision.allowed !== "boolean") throw new Error("Invalid shared rate-store response");
    return decision;
  }
  async release(leaseId: string) {
    await this.execute(sql`DELETE FROM application_operation_leases WHERE lease_id = ${leaseId}`);
  }
  async renew(leaseId: string) {
    const result = await this.execute(sql`UPDATE application_operation_leases
      SET expires_at = clock_timestamp() + interval '2 minutes'
      WHERE lease_id = ${leaseId} AND expires_at > clock_timestamp() RETURNING lease_id`);
    if (!resultRows(result).length) throw new Error("Operation lease was lost");
  }
  async cleanup() {
    // Bounded deletion prevents a long maintenance lock under a large backlog.
    await this.execute(sql`DELETE FROM application_rate_counters WHERE bucket_key IN
      (SELECT bucket_key FROM application_rate_counters
       WHERE expires_at < clock_timestamp() - interval '1 hour' LIMIT 1000)`);
    await this.execute(sql`DELETE FROM application_operation_leases WHERE (scope_key, lease_id) IN
      (SELECT scope_key, lease_id FROM application_operation_leases
       WHERE expires_at < clock_timestamp() - interval '1 hour' LIMIT 1000)`);
  }
}

/** Existing OTP/step-up limiters also share counters, without changing limits. */
export class PostgresExpressStore implements Store {
  localKeys = false;
  private windowMs = 60_000;
  constructor(private execute: ExecuteSql, private namespace: string) {}
  init(options: Options) { this.windowMs = options.windowMs; }
  async increment(key: string): Promise<IncrementResponse> {
    const bucket = budgetKey("express", this.namespace, key);
    const result = await this.execute(sql`INSERT INTO application_rate_counters(bucket_key, hits, expires_at)
      VALUES (${bucket}, 1, clock_timestamp() + ${this.windowMs} * interval '1 millisecond')
      ON CONFLICT (bucket_key) DO UPDATE SET
        hits = CASE WHEN application_rate_counters.expires_at <= clock_timestamp()
          THEN 1 ELSE application_rate_counters.hits + 1 END,
        expires_at = CASE WHEN application_rate_counters.expires_at <= clock_timestamp()
          THEN EXCLUDED.expires_at ELSE application_rate_counters.expires_at END
      RETURNING hits, expires_at`);
    const row = resultRows(result)[0];
    if (!row) throw new Error("Invalid shared limiter response");
    return { totalHits: Number(row.hits), resetTime: new Date(row.expires_at) };
  }
  async decrement(key: string) {
    await this.execute(sql`UPDATE application_rate_counters SET hits = greatest(0, hits - 1)
      WHERE bucket_key = ${budgetKey("express", this.namespace, key)}`);
  }
  async resetKey(key: string) {
    await this.execute(sql`DELETE FROM application_rate_counters
      WHERE bucket_key = ${budgetKey("express", this.namespace, key)}`);
  }
}
