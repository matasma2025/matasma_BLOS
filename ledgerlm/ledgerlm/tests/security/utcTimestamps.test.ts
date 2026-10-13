import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { applicationTimestampTargets, migrateUtcTimestamps, quoteIdentifier } from "../../scripts/db-utc-timestamps";
import { expiresAfter, utcDatabaseConfig } from "../../server/utils/databaseTime";

test("every declared application timestamp is timezone-aware, including auth and sessions", () => {
  const targets = applicationTimestampTargets();
  assert.equal(targets.length, 116);
  for (const [table, column] of [
    ["otp_codes", "expires_at"], ["otp_codes", "consumed_at"],
    ["device_trust", "expires_at"], ["users", "sessions_revoked_at"],
    ["device_proof_nonces", "expires_at"], ["session", "expire"],
  ]) assert.ok(targets.some((c) => c.table === table && c.column === column));
});

test("UTC connection options preserve SSL, other options and caller configuration", () => {
  const original = {
    connectionString: "postgresql://fixture:fixture@localhost/fixture?sslmode=require&options=-c%20statement_timeout%3D10000",
    application_name: "fixture",
  };
  const configured = utcDatabaseConfig(original);
  const url = new URL(configured.connectionString!);
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.searchParams.get("options"), "-c statement_timeout=10000 -c timezone=UTC");
  assert.equal(configured.application_name, "fixture");
  assert.equal(new URL(original.connectionString).searchParams.get("options"), "-c statement_timeout=10000");
  assert.equal(utcDatabaseConfig({ options: "-c statement_timeout=10000" }).options,
    "-c statement_timeout=10000 -c timezone=UTC");
  assert.throws(() => utcDatabaseConfig({ connectionString: "invalid fixture" }),
    /^Error: Invalid database connection URL$/);
});

test("UTC identifier quoting cannot inject SQL", () => {
  assert.equal(quoteIdentifier('a"b'), '"a""b"');
});

test("applying migration requires an explicit UTC-history assertion before querying", async () => {
  let queried = false;
  await assert.rejects(migrateUtcTimestamps({
    query: () => { queried = true; },
  } as any, [], { apply: true }), /Confirm.*UTC/);
  assert.equal(queried, false);
});

test("expiry duration validation and boundaries are exact", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(expiresAfter(300_000, now).getTime() - now, 300_000);
  assert.equal(expiresAfter(10 * 86_400_000, now).getTime() - now, 10 * 86_400_000);
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.throws(() => expiresAfter(duration, now), /positive finite/);
  }
});

test("OTP and trusted-device elapsed expiry remain identical across timezones and DST", () => {
  for (const timezone of ["UTC", "Asia/Kolkata", "America/New_York"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { expiresAfter } from "./server/utils/databaseTime.ts";
      for (const start of ["2026-03-08T06:59:00Z", "2026-11-01T05:59:00Z"]) {
        const now = Date.parse(start);
        if (expiresAfter(300000, now).getTime() !== now + 300000) process.exit(1);
        if (expiresAfter(864000000, now).getTime() !== now + 864000000) process.exit(1);
      }
    `], { env: { ...process.env, TZ: timezone }, encoding: "utf8" });
    assert.equal(result.status, 0, `Elapsed expiry failed in ${timezone}`);
  }
});
