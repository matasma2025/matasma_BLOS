import assert from "node:assert/strict";
import test from "node:test";
import { createEnterpriseScopePlan } from "../../server/services/boards/sources/scopeQueryPlanner";

test("plans selected measures, dimensions, filters, and normalized periods", () => {
  const plan = createEnterpriseScopePlan({
    config: null,
    request: {
      scopeMode: "selected",
      year: 2026,
      months: [3, 1, 2, 2],
      dimensions: ["Entity", "Cost Category"],
      keyColumns: [{
        column: "amount_usd",
        label: "Revenue",
        dimension: "Entity",
        dimensionValues: ["BGSW", "BGSW", "BGSV"],
      }],
      comparison: { year: 2025, months: [1, 2, 3] },
    },
  });

  assert.equal(plan.metricColumn, "amount_usd");
  assert.deepEqual(plan.months, [1, 2, 3]);
  assert.deepEqual(plan.dimensions, ["Entity", "Cost Category"]);
  assert.deepEqual(plan.filters[0]?.values, ["BGSW", "BGSV"]);
  assert.deepEqual(plan.comparison?.months, [1, 2, 3]);
});

test("supports legacy exclude mode without allowing arbitrary identifiers", () => {
  const plan = createEnterpriseScopePlan({
    config: null,
    request: {
      scopeMode: "exclude",
      excludedColumns: ["Sector"],
      year: 2026,
      months: [1],
      dimensions: ["Entity", "Sector"],
    },
  });
  assert.deepEqual(plan.dimensions, ["Entity"]);

  assert.throws(() => createEnterpriseScopePlan({
    config: null,
    request: {
      scopeMode: "all-except",
      excludedColumns: ["Entity"],
      year: 2026,
      months: [1],
      dimensions: ["Entity"],
    },
  }), /excludes every selected dimension/);

  assert.throws(() => createEnterpriseScopePlan({
    config: null,
    request: {
      year: 2026,
      months: [1],
      dimensions: ["region_entity); DROP TABLE users; --"],
    },
  }), /Unsupported Enterprise dimension/);
});

test("fails closed for unsupported measures and excessive grouping", () => {
  assert.throws(() => createEnterpriseScopePlan({
    config: null,
    request: {
      scopeMode: "selected",
      year: 2026,
      months: [1],
      keyColumns: [{ column: "secret_amount", label: "Secret" }],
    },
  }), /Unsupported Enterprise measure/);

  assert.throws(() => createEnterpriseScopePlan({
    config: null,
    request: {
      scopeMode: "selected",
      year: 2026,
      months: [1],
      keyColumns: [
        { column: "amount_usd", label: "Amount" },
        { column: "capacity", label: "Capacity" },
      ],
    },
  }), /Multiple selected measures require/);

  assert.throws(() => createEnterpriseScopePlan({
    config: null,
    request: {
      scopeMode: "selected",
      year: 2026,
      months: [1],
      keyColumns: [{ column: "headcount", label: "Headcount" }],
    },
  }), /supports only Amount/);

  assert.throws(() => createEnterpriseScopePlan({
    config: null,
    request: {
      scopeMode: "selected",
      year: 2026,
      months: [1],
      keyColumns: [{ column: "amount_usd", label: "Amount", aggregation: "average" }],
    },
  }), /supports only sum aggregation/);

  assert.throws(() => createEnterpriseScopePlan({
    config: null,
    request: {
      year: 2026,
      months: [1],
      dimensions: ["Entity", "Sector", "Cost Category", "Resource Type", "Location"],
    },
  }), /at most 4 dimensions/);
});

test("rejects empty periods and oversized dimension filters", () => {
  assert.throws(() => createEnterpriseScopePlan({
    config: {
      scopeConfig: {
        filters: [{ column: "Entity", values: [] }],
      },
    },
    request: { year: 2026, months: [1] },
  }), /require 1-100 values/);

  assert.throws(() => createEnterpriseScopePlan({
    config: null,
    request: { year: 2026, months: [] },
  }), /months are outside/);
});