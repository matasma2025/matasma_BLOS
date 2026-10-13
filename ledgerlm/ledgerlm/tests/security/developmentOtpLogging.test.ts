import assert from "node:assert/strict";
import test from "node:test";
import { OtpService, type OtpContext } from "../../server/services/otpService";

// Use a fabricated code and capture output; never request or print a real OTP.
function capture(environment: string | undefined, context: OtpContext): string[] {
  const priorEnv = process.env.NODE_ENV;
  const priorLog = console.log;
  const messages: string[] = [];
  try {
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
    console.log = (message) => { messages.push(String(message)); };
    (new OtpService() as any).logDevelopmentOtp(
      "fixture@example.invalid", "123456", new Date("2026-01-01T00:05:00Z"), context,
    );
  } finally {
    console.log = priorLog;
    if (priorEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorEnv;
  }
  return messages;
}

test("development admin OTP logging is separately labeled and masks the recipient", () => {
  const messages = capture("development", "admin_step_up:fixture-challenge");
  assert.equal(messages.length, 1);
  assert.match(messages[0], /^\[DEV ONLY\] Admin verification OTP for f\*\*\*@example\.invalid: 123456/);
  assert.match(messages[0], /expires at 2026-01-01T00:05:00.000Z/);
  assert.equal(messages[0].includes("fixture@example.invalid"), false);
});

test("existing development login output is preserved without logging reset codes", () => {
  assert.match(capture("development", "login")[0], /^\[DEV ONLY\] Login OTP/);
  assert.deepEqual(capture("development", "password_reset"), []);
});

test("production, test and unspecified environments never log OTPs", () => {
  for (const env of ["production", "test", undefined]) {
    for (const context of ["login", "admin_step_up:fixture-challenge", "password_reset"] as OtpContext[]) {
      assert.deepEqual(capture(env, context), []);
    }
  }
});
