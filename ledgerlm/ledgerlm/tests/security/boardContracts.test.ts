import assert from "node:assert/strict";
import test from "node:test";
import {
  boardAnalysisConfigContractSchema,
  boardEvidenceManifestSchema,
  boardScheduleConfigurationSchema,
} from "../../shared/boards/boardValidators";

test("accepts a scoped Enterprise Board contract", () => {
  const config = boardAnalysisConfigContractSchema.parse({
    templateSlug: "trend-analysis",
    source: { type: "enterprise", cubeId: "7af343d4-379d-4717-a742-5c89236e395d" },
    scope: {
      mode: "selected",
      keyColumns: [{
        column: "amount_usd",
        label: "Revenue",
        aggregation: "sum",
        valueType: "currency",
        dimension: "entity",
        dimensionValues: ["BGSW"],
      }],
      excludedColumns: [],
      filters: [{ column: "entity", values: ["BGSW"] }],
    },
    time: { granularity: "quarterly", year: 2026, months: [1, 2, 3] },
    comparison: { basis: "year-ago" },
  });

  assert.equal(config.schemaVersion, 2);
  assert.equal(config.scope.keyColumns[0]?.aggregation, "sum");
});

test("rejects untrusted source and scope fields", () => {
  assert.equal(boardAnalysisConfigContractSchema.safeParse({
    templateSlug: "variance-analysis",
    source: {
      type: "enterprise",
      cubeId: "7af343d4-379d-4717-a742-5c89236e395d",
      userId: "attacker",
    },
  }).success, false);

  assert.equal(boardAnalysisConfigContractSchema.safeParse({
    schemaVersion: 999,
    templateSlug: "variance-analysis",
    source: {
      type: "enterprise",
      cubeId: "7af343d4-379d-4717-a742-5c89236e395d",
    },
  }).success, false);
});

test("validates evidence references without raw source content", () => {
  const result = boardEvidenceManifestSchema.parse({
    sourceType: "enterprise",
    sourceIds: ["7af343d4-379d-4717-a742-5c89236e395d"],
    sourceVersions: [],
    generatedAt: "2026-09-17T10:00:00.000Z",
  });
  assert.equal(result.sourceIds.length, 1);
});

test("requires an explicit timezone for future schedules", () => {
  assert.equal(boardScheduleConfigurationSchema.safeParse({
    enabled: true,
    frequency: "daily",
    startAt: "2026-09-17T10:00:00.000Z",
  }).success, false);
});