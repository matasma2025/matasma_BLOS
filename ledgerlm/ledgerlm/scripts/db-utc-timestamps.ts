/**
 * Reviewed, opt-in type migration for the application's external PostgreSQL.
 * Never invoked by startup or db:push. Dry-run is the default.
 * Legacy values must already represent UTC, as the old Drizzle reader assumed.
 */
import { is } from "drizzle-orm";
import { getTableConfig, PgTable, PgTimestamp } from "drizzle-orm/pg-core";
import pg from "pg";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as schema from "../shared/schema";
import { getClientConfig } from "./db-prepare";
import { utcDatabaseConfig } from "../server/utils/databaseTime";

export interface TimestampTarget {
  schema: string;
  table: string;
  column: string;
}
interface ExistingColumn extends TimestampTarget {
  dataType: string;
  defaultValue: string | null;
}
export const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const key = (c: TimestampTarget) => JSON.stringify([c.schema, c.table, c.column]);
const qualified = (c: TimestampTarget) =>
  `${quoteIdentifier(c.schema)}.${quoteIdentifier(c.table)}`;

export function applicationTimestampTargets(): TimestampTarget[] {
  return Object.values(schema).flatMap((value) => {
    if (!is(value, PgTable)) return [];
    const config = getTableConfig(value);
    return config.columns.filter((column) => is(column, PgTimestamp)).map((column) => {
      if (!column.withTimezone) throw new Error("Application timestamps must be timezone-aware");
      return { schema: config.schema ?? "public", table: config.name, column: column.name };
    });
  }).sort((a, b) => key(a).localeCompare(key(b)));
}

export async function inspectTimestampTargets(client: pg.Client, targets: TimestampTarget[]) {
  const result = await client.query<ExistingColumn>(
    `SELECT table_schema AS schema, table_name AS table, column_name AS column,
            data_type AS "dataType", column_default AS "defaultValue"
     FROM information_schema.columns WHERE table_schema = ANY($1::text[])`,
    [[...new Set(targets.map((c) => c.schema))]],
  );
  const existing = new Map(result.rows.map((c) => [key(c), c]));
  const pending: ExistingColumn[] = [];
  const missing: TimestampTarget[] = [];
  for (const target of targets) {
    const actual = existing.get(key(target));
    if (!actual) { missing.push(target); continue; }
    if (actual.dataType === "timestamp with time zone") continue;
    if (actual.dataType !== "timestamp without time zone") {
      throw new Error(`Unexpected type for ${target.table}.${target.column}; no changes applied`);
    }
    // Unknown timezone-dependent defaults need a separate, reviewed conversion.
    if (actual.defaultValue && !/^(now\(\)|CURRENT_TIMESTAMP(?:\(\d+\))?)$/i.test(actual.defaultValue)) {
      throw new Error(`Review the default for ${target.table}.${target.column} before conversion`);
    }
    pending.push(actual);
  }
  return { pending, missing, alreadyAware: targets.length - pending.length - missing.length };
}

export async function migrateUtcTimestamps(
  client: pg.Client,
  targets: TimestampTarget[],
  options: { apply: boolean; utcHistoryConfirmed?: boolean; configureRoleTimezone?: boolean },
) {
  if (options.apply && !options.utcHistoryConfirmed) {
    throw new Error("Confirm that legacy timestamp values represent UTC before applying this migration");
  }
  await client.query(options.apply ? "BEGIN" : "BEGIN READ ONLY");
  try {
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    if (options.apply) {
      // Serialize with the existing additive-only schema synchronization.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('ledgerlm_safe_schema_push'))");
    }
    let plan = await inspectTimestampTargets(client, targets);
    if (options.apply && plan.missing.length) {
      throw new Error("Declared timestamp columns are missing; reconcile missing objects before applying");
    }
    const byTable = new Map<string, ExistingColumn[]>();
    for (const column of plan.pending) {
      const table = qualified(column);
      byTable.set(table, [...(byTable.get(table) ?? []), column]);
    }
    if (options.apply && byTable.size) {
      // Acquire every table lock before snapshotting; concurrent writers cannot
      // change dates between the snapshot and the preservation check.
      await client.query(`LOCK TABLE ${[...byTable.keys()].join(", ")} IN ACCESS EXCLUSIVE MODE`);
      // Re-check under locks rather than trusting the earlier catalog snapshot.
      plan = await inspectTimestampTargets(client, targets);
      for (const [index, [table, candidates]] of [...byTable.entries()].entries()) {
        const columns = candidates.filter((c) => plan.pending.some((p) => key(p) === key(c)));
        if (!columns.length) continue;
        const snapshot = quoteIdentifier(`ledgerlm_utc_snapshot_${index}`);
        const names = columns.map((c) => quoteIdentifier(c.column)).join(", ");
        // Only dates, no credentials, document content, or user identifiers.
        await client.query(`CREATE TEMP TABLE ${snapshot} ON COMMIT DROP AS SELECT ${names} FROM ${table}`);
        const changes = columns.map((c) =>
          `ALTER COLUMN ${quoteIdentifier(c.column)} TYPE timestamptz
           USING ${quoteIdentifier(c.column)} AT TIME ZONE 'UTC'`);
        await client.query(`ALTER TABLE ${table} ${changes.join(", ")}`);
        const converted = columns.map((c) =>
          `${quoteIdentifier(c.column)} AT TIME ZONE 'UTC' AS ${quoteIdentifier(c.column)}`).join(", ");
        // EXCEPT ALL preserves duplicate rows, nulls and microsecond precision.
        const unchanged = await client.query<{ unchanged: boolean }>(
          `SELECT NOT EXISTS (
             (SELECT ${names} FROM ${snapshot} EXCEPT ALL SELECT ${converted} FROM ${table})
             UNION ALL
             (SELECT ${converted} FROM ${table} EXCEPT ALL SELECT ${names} FROM ${snapshot})
           ) AS unchanged`,
        );
        if (!unchanged.rows[0]?.unchanged) throw new Error("Timestamp preservation check failed");
      }
    }
    if (options.apply && options.configureRoleTimezone !== false) {
      // Also covers Neon HTTP connections, which do not use node-postgres options.
      // Scoped to this application role in this database, not every role/database.
      const identity = await client.query<{ role: string; database: string }>(
        "SELECT current_user AS role, current_database() AS database",
      );
      const { role, database } = identity.rows[0];
      await client.query(`ALTER ROLE ${quoteIdentifier(role)} IN DATABASE ${quoteIdentifier(database)} SET timezone = 'UTC'`);
    }
    const after = options.apply ? await inspectTimestampTargets(client, targets) : plan;
    if (options.apply && after.pending.length) throw new Error("Timestamp migration is incomplete");
    await client.query("COMMIT");
    return { planned: plan.pending.length, missing: plan.missing.length,
      timezoneAware: after.alreadyAware, applied: options.apply };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = new pg.Client(utcDatabaseConfig(getClientConfig()));
  await client.connect();
  try {
    const result = await migrateUtcTimestamps(client, applicationTimestampTargets(), {
      apply, utcHistoryConfirmed: process.argv.includes("--confirm-utc-history"),
    });
    console.log(`[utc-timestamps] ${JSON.stringify(result)}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    // Avoid logging connection details or raw database values on failure.
    console.error("[utc-timestamps] Migration failed; transaction rolled back. Check UTC-history confirmation, schema compatibility, locks and role permissions.");
    process.exitCode = 1;
  });
}
