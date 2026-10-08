import assert from "node:assert/strict";
import test from "node:test";
import { responseError } from "../../client/src/lib/apiError";

test("429 exposes the server retry message and retry duration", async () => {
  const error = await responseError(new Response(JSON.stringify({
    error: "Too many requests. Please try again in 60 seconds.", code: "RATE_LIMITED", retryAfter: 60,
  }), { status: 429, headers: { "Retry-After": "60" } }));
  assert.equal(error.status, 429);
  assert.equal(error.retryAfter, 60);
  assert.equal(error.code, "RATE_LIMITED");
  assert.equal(error.message, "Too many requests. Please try again in 60 seconds.");
});
test("admin step-up and ordinary errors preserve their existing status/code contract", async () => {
  const body = JSON.stringify({ error: "Verification required", code: "STEP_UP_REQUIRED" });
  const error = await responseError(new Response(body, { status: 403 }));
  assert.equal(error.status, 403);
  assert.equal(error.code, "STEP_UP_REQUIRED");
  assert.equal(error.message, `403: ${body}`);
});
