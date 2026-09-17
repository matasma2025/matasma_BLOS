import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBoundedCsv,
  csvEscape,
  computeNextBoardScheduleRun,
  exportDeterministicCsv,
  runVaultDeterministicAnalysis,
  assertVaultIdentity,
} from "../../server/services/boards/phase4Service";

test("bounded CSV parser handles quoted commas and rejects malformed/formula cells", () => {
  const parsed = parseBoundedCsv('Name,Amount\n"North, Inc.",12\n');
  assert.equal(parsed.rows[0]?.Name, "North, Inc.");
  assert.equal(parsed.rows[0]?.Amount, "12");
  assert.throws(() => parseBoundedCsv("a,b\n=1+1,2\n"), /Formula cells/);
  assert.throws(() => parseBoundedCsv('a,b\n"unterminated,2\n'), /unterminated/);
});

test("CSV export neutralizes leading whitespace/control formula payloads", () => {
  assert.equal(csvEscape("  =cmd|'/C calc'"), `"\'  =cmd|'/C calc'"`);
  assert.throws(() => exportDeterministicCsv({ measures: [{ measureId: "x" }] }), /Required/);
});

test("schedule recurrence is server-owned and timezone-aware", () => {
  const after = new Date("2026-01-01T12:01:00.000Z");
  const next = computeNextBoardScheduleRun({ frequency: "15-minutes", timezone: "UTC", startAt: new Date("2026-01-01T00:00:00.000Z") }, after);
  assert.equal(next.toISOString(), "2026-01-01T12:15:00.000Z");
  assert.throws(() => computeNextBoardScheduleRun({ frequency: "daily", timezone: "Invalid/Zone", startAt: new Date() }));
});

test("Vault deterministic path aggregates measures, ratios, comparison, and filters", () => {
  const dataset = {
    documentId: "doc-1", documentVersion: "v", contentHash: "hash", name: "data.csv",
    headers: ["version", "year", "month", "entity", "revenue", "cost", "hours", "billable"],
    rows: [
      { version: "ACT", year: 2026, month: 1, entity: "A", revenue: 100, cost: 40, hours: 10, billable: 8 },
      { version: "BUD", year: 2026, month: 1, entity: "A", revenue: 90, cost: 50, hours: 10, billable: 7 },
      { version: "ACT", year: 2026, month: 1, entity: "B", revenue: 20, cost: 15, hours: 5, billable: 3 },
      { version: "BUD", year: 2026, month: 1, entity: "B", revenue: 30, cost: 20, hours: 5, billable: 2 },
    ],
    provenance: { sourceType: "vault" as const, documentId: "doc-1", fileName: "data.csv", rowCount: 4 },
  };
  const result = runVaultDeterministicAnalysis(dataset, {
    request: {
      year: 2026, months: [1], dimensions: ["entity"],
      keyColumns: [
        { column: "revenue", label: "Revenue", aggregation: "sum", favorability: "higher-is-favorable" },
        { column: "util", label: "Utilization", aggregation: "ratio", numerator: "billable", denominator: "hours", valueType: "ratio" },
      ],
    },
    settings: { columnMapping: { actuals: "ACT", budget: "BUD" } },
  });
  assert.equal(result.measures[0]?.actual, 120);
  assert.equal(result.measures[0]?.budget, 120);
  assert.equal(result.measures[1]?.actual, 11 / 15);
  assert.equal(result.measures[1]?.budget, 9 / 15);
  assert.equal(result.contributors.length, 2);
  assert.throws(() => runVaultDeterministicAnalysis(dataset, {
    request: { year: 2026, months: [1], dimensions: ["missing"], keyColumns: [{ column: "revenue", label: "Revenue" }] },
    settings: { columnMapping: { actuals: "ACT", budget: "BUD" } },
  }), /Missing Vault column mapping/);
});

test("Vault identity mismatch fails closed", () => {
  assert.throws(() => assertVaultIdentity(
    { documentId: "doc-1", contentHash: "a" },
    { documentId: "doc-1", contentHash: "b" },
  ), /changed since/);
});