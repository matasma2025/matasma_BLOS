import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBoardRunRequest } from "../../server/services/boards/boardRunService";

test("freezes omitted Board periods at queue time", () => {
  const queuedAt = new Date("2026-12-31T23:59:59.000Z");
  const normalized = normalizeBoardRunRequest(
    { dimensions: ["Entity"] },
    queuedAt,
  );
  assert.equal(normalized.year, queuedAt.getFullYear());
  assert.deepEqual(normalized.months, [queuedAt.getMonth() + 1]);
});

test("preserves explicit Board periods while creating the run snapshot", () => {
  const normalized = normalizeBoardRunRequest(
    { year: 2024, months: [3, 1], dimensions: ["Entity"] },
    new Date("2026-09-17T12:00:00.000Z"),
  );
  assert.equal(normalized.year, 2024);
  assert.deepEqual(normalized.months, [3, 1]);
});