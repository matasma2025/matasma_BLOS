import { sql, type SQL } from "drizzle-orm";

// Explicit additive objects only. No Drizzle push, reconciliation, or mutation
// of existing business tables. Statements are separate for Neon compatibility.
export const OPERATION_LIMIT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS application_rate_counters (
    bucket_key text PRIMARY KEY,
    hits bigint NOT NULL CHECK (hits >= 0),
    expires_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS application_rate_counters_expiry
    ON application_rate_counters (expires_at)`,
  `CREATE TABLE IF NOT EXISTS application_operation_leases (
    scope_key text NOT NULL,
    lease_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (scope_key, lease_id)
  )`,
  `CREATE INDEX IF NOT EXISTS application_operation_leases_expiry
    ON application_operation_leases (expires_at)`,
  `CREATE INDEX IF NOT EXISTS application_operation_leases_id
    ON application_operation_leases (lease_id)`,
  `CREATE OR REPLACE FUNCTION ledgerlm_consume_rate_budget(
    budgets jsonb, scopes jsonb, requested_lease text
  ) RETURNS jsonb LANGUAGE plpgsql AS $$
  DECLARE
    item jsonb;
    lock_key text;
    existing_hits bigint;
    expiry timestamptz;
    now_time timestamptz := clock_timestamp();
    wait_seconds integer := 0;
    remaining_hits bigint := 2147483647;
    reset_seconds integer := 0;
    active_count integer;
  BEGIN
    -- Sorted transaction-scoped locks serialize the complete multi-key
    -- admission decision across processes and prevent lock-order deadlocks.
    FOR lock_key IN
      SELECT DISTINCT value->>'key' FROM (
        SELECT value FROM jsonb_array_elements(budgets)
        UNION ALL SELECT value FROM jsonb_array_elements(scopes)
      ) keys ORDER BY 1
    LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended('ledgerlm:rate:' || lock_key, 0));
    END LOOP;
    now_time := clock_timestamp();

    FOR item IN SELECT value FROM jsonb_array_elements(budgets) LOOP
      SELECT hits, expires_at INTO existing_hits, expiry
        FROM application_rate_counters WHERE bucket_key = item->>'key';
      IF NOT FOUND OR expiry <= now_time THEN
        existing_hits := 0;
        expiry := now_time + ((item->>'windowMs')::bigint * interval '1 millisecond');
      END IF;
      IF existing_hits + (item->>'cost')::bigint > (item->>'limit')::bigint THEN
        wait_seconds := greatest(wait_seconds, ceil(extract(epoch FROM expiry - now_time))::integer);
      END IF;
      remaining_hits := least(remaining_hits,
        greatest(0, (item->>'limit')::bigint - existing_hits - (item->>'cost')::bigint));
      reset_seconds := greatest(reset_seconds, ceil(extract(epoch FROM expiry - now_time))::integer);
    END LOOP;

    FOR item IN SELECT value FROM jsonb_array_elements(scopes) LOOP
      SELECT count(*), min(expires_at) INTO active_count, expiry
        FROM application_operation_leases
        WHERE scope_key = item->>'key' AND expires_at > now_time;
      IF active_count >= (item->>'limit')::integer THEN
        wait_seconds := greatest(wait_seconds, ceil(extract(epoch FROM expiry - now_time))::integer);
      END IF;
    END LOOP;

    FOR item IN SELECT value FROM jsonb_array_elements(budgets) LOOP
      IF wait_seconds = 0 OR coalesce((item->>'chargeOnDeny')::boolean, false) THEN
      INSERT INTO application_rate_counters (bucket_key, hits, expires_at)
      VALUES (item->>'key', (item->>'cost')::bigint,
        now_time + ((item->>'windowMs')::bigint * interval '1 millisecond'))
      ON CONFLICT (bucket_key) DO UPDATE SET
        hits = CASE WHEN application_rate_counters.expires_at <= now_time
          THEN EXCLUDED.hits ELSE application_rate_counters.hits + EXCLUDED.hits END,
        expires_at = CASE WHEN application_rate_counters.expires_at <= now_time
          THEN EXCLUDED.expires_at ELSE application_rate_counters.expires_at END;
      END IF;
    END LOOP;

    IF wait_seconds > 0 THEN
      RETURN jsonb_build_object('allowed', false, 'retryAfter', wait_seconds,
        'remaining', 0, 'resetAfter', wait_seconds);
    END IF;

    IF jsonb_array_length(scopes) > 0 THEN
      IF requested_lease IS NULL THEN RAISE EXCEPTION 'Missing operation lease'; END IF;
      FOR item IN SELECT value FROM jsonb_array_elements(scopes) LOOP
        DELETE FROM application_operation_leases
          WHERE scope_key = item->>'key' AND expires_at <= now_time;
        INSERT INTO application_operation_leases(scope_key, lease_id, expires_at)
        VALUES (item->>'key', requested_lease, now_time + interval '2 minutes');
      END LOOP;
    END IF;
    RETURN jsonb_build_object('allowed', true, 'retryAfter', 0,
      'remaining', remaining_hits, 'resetAfter', reset_seconds);
  END $$`,
];

export async function createOperationRateLimitTables(execute: (query: SQL) => Promise<unknown>) {
  for (const statement of OPERATION_LIMIT_SCHEMA) await execute(sql.raw(statement));
}
