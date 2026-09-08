import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_STEP_UP_MAX_AGE_MS,
  requireRecentAdminStepUp,
} from "../../server/middleware/adminStepUp";

function invoke(session: Record<string, unknown>) {
  const req = { session } as any;
  let status = 200;
  let body: any;
  let nextCalled = false;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: any) {
      body = value;
      return this;
    },
  } as any;
  requireRecentAdminStepUp(req, res, () => {
    nextCalled = true;
  });
  return { status, body, nextCalled };
}

test("requires authentication before admin step-up", () => {
  assert.equal(invoke({}).status, 401);
});

test("rejects missing, wrong-user, and expired admin assurance", () => {
  const now = Date.now();
  assert.equal(invoke({ userId: "admin" }).body.code, "STEP_UP_REQUIRED");
  assert.equal(invoke({
    userId: "admin",
    adminStepUp: { userId: "other", verifiedAt: now, method: "otp" },
  }).body.code, "STEP_UP_REQUIRED");
  assert.equal(invoke({
    userId: "admin",
    adminStepUp: {
      userId: "admin",
      verifiedAt: now - ADMIN_STEP_UP_MAX_AGE_MS - 1,
      method: "otp",
    },
  }).body.code, "STEP_UP_REQUIRED");
});

test("accepts recent assurance for the same authenticated user", () => {
  const result = invoke({
    userId: "admin",
    adminStepUp: { userId: "admin", verifiedAt: Date.now(), method: "otp" },
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.status, 200);
});