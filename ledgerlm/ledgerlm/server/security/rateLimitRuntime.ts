import { db } from "../db";
import { logger } from "../logger";
import { PostgresBudgetStore, PostgresExpressStore } from "./postgresRateStore";
import { loadConcurrencyLimits, loadOperationPolicies } from "./operationLimitPolicy";

export const operationRateStore = new PostgresBudgetStore(async (query) => db.execute(query));
export const operationPolicies = loadOperationPolicies(process.env.RATE_LIMIT_POLICY_JSON);
export const concurrencyLimits = loadConcurrencyLimits(process.env.RATE_LIMIT_CONCURRENCY_JSON);
export function sharedExpressStore(namespace: string) {
  return new PostgresExpressStore(async (query) => db.execute(query), namespace);
}
export function startRateCounterCleanup() {
  const timer = setInterval(() => {
    operationRateStore.cleanup().catch(() => logger.warn({ event: "rate_counter_cleanup_failed" }));
  }, 10 * 60_000);
  timer.unref();
}
