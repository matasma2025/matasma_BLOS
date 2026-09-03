import assert from "node:assert/strict";
import test from "node:test";
import { areAllOwnedBy, isOwnedBy } from "../../server/security/ownership";

test("accepts resources owned by the authenticated user", () => {
  const userId = "user-a";
  assert.equal(isOwnedBy({ userId, id: "resource-a" }, userId), true);
  assert.equal(
    areAllOwnedBy(
      [
        { userId, id: "resource-a" },
        { userId, id: "resource-b" },
      ],
      userId,
    ),
    true,
  );
});

test("rejects missing and cross-user resources without distinguishing them", () => {
  const userId = "user-a";
  assert.equal(isOwnedBy(undefined, userId), false);
  assert.equal(isOwnedBy({ userId: "user-b" }, userId), false);
  assert.equal(
    areAllOwnedBy(
      [{ userId }, { userId: "user-b" }, undefined],
      userId,
    ),
    false,
  );
});