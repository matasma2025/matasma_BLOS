/**
 * Opt-in external-development-DB integration tests. Fixtures use a dedicated
 * schema and are removed even on failure. Never touches real OTPs or sessions.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import pg from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgSchema, timestamp } from "drizzle-orm/pg-core";
import { getClientConfig } from "../../scripts/db-prepare";
import { migrateUtcTimestamps, quoteIdentifier, type TimestampTarget } from "../../scripts/db-utc-timestamps";
import { utcDatabaseConfig } from "../../server/utils/databaseTime";

const enabled = process.argv.includes("--utc-db-integration");
test("external DB: UTC preservation, rollback, expiry, Drizzle and session adapter", { skip: !enabled }, async () => {
  const config = utcDatabaseConfig(getClientConfig());
  const client = new pg.Client(config);
  const fixture = `utc_fixture_${randomBytes(6).toString("hex")}`;
  const schema = quoteIdentifier(fixture);
  const target = `${schema}."events"`;
  const targets: TimestampTarget[] = ["created_at", "expires_at", "consumed_at"].map((column) => ({
    schema: fixture, table: "events", column,
  }));
  const pool = new pg.Pool(config);
  const PgSession = connectPgSimple(session);
  const store = new PgSession({
    pool, schemaName: fixture, tableName: "session", createTableIfMissing: false, pruneSessionInterval: false,
  });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`CREATE TABLE ${target} (
      id integer PRIMARY KEY, created_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp NOT NULL, consumed_at timestamp,
      unrelated_legacy timestamp, marker text NOT NULL DEFAULT 'unchanged')`);
    await client.query(`INSERT INTO ${target} (id, created_at, expires_at) VALUES
      (1, '2026-01-01 00:00:00.123456', '2026-01-01 00:05:00.123456'),
      (2, '2026-01-01 00:00:00.123456', '2026-01-01 00:05:00.123456')`);
    await client.query(`CREATE TABLE ${schema}."session" (
      sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL)`);
    targets.push({ schema: fixture, table: "session", column: "expire" });
    const dry = await migrateUtcTimestamps(client, targets, { apply: false });
    assert.equal(dry.planned, 4);
    // A late DDL failure must roll back earlier column conversions and temp data.
    await client.query(`CREATE VIEW ${schema}.blocker AS SELECT expire FROM ${schema}."session"`);
    await assert.rejects(migrateUtcTimestamps(client, targets, {
      apply: true, utcHistoryConfirmed: true, configureRoleTimezone: false,
    }));
    const oldType = await client.query(
      "SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name='events' AND column_name='created_at'",
      [fixture],
    );
    assert.equal(oldType.rows[0].data_type, "timestamp without time zone");
    await client.query(`DROP VIEW ${schema}.blocker`);
    const applied = await migrateUtcTimestamps(client, targets, {
      apply: true, utcHistoryConfirmed: true, configureRoleTimezone: false,
    });
    assert.equal(applied.timezoneAware, 4);
    assert.equal((await migrateUtcTimestamps(client, targets, {
      apply: true, utcHistoryConfirmed: true, configureRoleTimezone: false,
    })).planned, 0);
    const preserved = await client.query(`SELECT
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS value, marker FROM ${target}`);
    assert.deepEqual(preserved.rows, [
      { value: "2026-01-01 00:00:00.123456", marker: "unchanged" },
      { value: "2026-01-01 00:00:00.123456", marker: "unchanged" },
    ]);
    assert.equal((await client.query(
      "SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND column_name='unrelated_legacy'",
      [fixture],
    )).rows[0].data_type, "timestamp without time zone");

    for (const timezone of ["UTC", "Asia/Kolkata", "America/New_York"]) {
      await client.query("SELECT set_config('TimeZone', $1, false)", [timezone]);
      await client.query(`INSERT INTO ${target} (id, expires_at) VALUES
        (3, now() + interval '5 minutes'), (4, now() - interval '1 second')
        ON CONFLICT (id) DO UPDATE SET created_at=excluded.created_at, expires_at=excluded.expires_at, consumed_at=NULL`);
      const active = await client.query(`SELECT id FROM ${target} WHERE expires_at > now() AND consumed_at IS NULL ORDER BY id`);
      assert.deepEqual(active.rows.map((r) => r.id), [3], timezone);
      const lifetime = await client.query(`SELECT extract(epoch FROM (expires_at-created_at))::int AS seconds FROM ${target} WHERE id=3`);
      // Created_at defaults and expires_at remain the same instant across zones.
      assert.equal(lifetime.rows[0].seconds, 300);
      const consume = `UPDATE ${target} SET consumed_at=now() WHERE id=3 AND consumed_at IS NULL RETURNING id`;
      assert.equal((await client.query(consume)).rowCount, 1);
      assert.equal((await client.query(consume)).rowCount, 0);

      const events = pgSchema(fixture).table("events", {
        createdAt: timestamp("created_at", { withTimezone: true }),
      });
      const result = await drizzle(client).select().from(events);
      assert.equal(result[0].createdAt!.toISOString(), "2026-01-01T00:00:00.123Z");
    }
    // Actual connect-pg-simple writes and reads, including to_timestamp(), touch,
    // expiry filtering and a non-UTC connection. No real user session involved.
    const sessionClient = await pool.connect();
    sessionClient.release();
    await pool.query("SET TIME ZONE 'Asia/Kolkata'");
    const expiry = new Date(Date.now() + 900_000);
    const data = { cookie: { expires: expiry, originalMaxAge: 900_000 }, fixture: true } as any;
    const invoke = (operation: "set" | "touch", sid: string) => new Promise<void>((resolve, reject) => {
      store[operation](sid, data, (error) => error ? reject(error) : resolve());
    });
    const get = (sid: string) => new Promise<any>((resolve, reject) => {
      store.get(sid, (error, value) => error ? reject(error) : resolve(value));
    });
    await invoke("set", "fixture");
    assert.equal((await get("fixture"))?.fixture, true);
    await invoke("touch", "fixture");
    const stored = await pool.query(`SELECT extract(epoch FROM expire)::bigint AS epoch FROM ${schema}."session" WHERE sid='fixture'`);
    assert.ok(Math.abs(Number(stored.rows[0].epoch) - expiry.getTime() / 1000) <= 1);
    await pool.query(`UPDATE ${schema}."session" SET expire=now()-interval '1 second' WHERE sid='fixture'`);
    assert.equal(await get("fixture"), undefined);
    // Confirm the configured session default is UTC on a newly opened connection.
    const fresh = new pg.Client(config);
    await fresh.connect();
    try { assert.equal((await fresh.query("SHOW TIME ZONE")).rows[0].TimeZone, "UTC"); }
    finally { await fresh.end(); }
  } finally {
    store.close();
    await pool.end();
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
