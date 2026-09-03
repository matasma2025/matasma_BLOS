import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceSessionBinding,
  establishAuthenticatedSession,
} from "../../server/middleware/sessionBinding";

process.env.SESSION_SECRET = "security-test-session-secret";

function createRequest(userAgent = "LedgerLM Test Browser/1.0", ip = "10.20.30.40") {
  const session: Record<string, any> = {
    regenerate(callback: (error?: Error) => void) {
      callback();
    },
    save(callback: (error?: Error) => void) {
      callback();
    },
    destroy(callback: (error?: Error) => void) {
      session.destroyed = true;
      callback();
    },
  };

  return {
    session,
    ip,
    path: "/api/auth/me",
    socket: { remoteAddress: ip },
    get(name: string) {
      return name.toLowerCase() === "user-agent" ? userAgent : undefined;
    },
  } as any;
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    cookieCleared: false,
    clearCookie() {
      this.cookieCleared = true;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as any;
}

test("authentication rotates, binds, timestamps, and saves the session", async () => {
  const req = createRequest();
  let regenerateCount = 0;
  let saveCount = 0;
  req.session.regenerate = (callback: (error?: Error) => void) => {
    regenerateCount += 1;
    callback();
  };
  req.session.save = (callback: (error?: Error) => void) => {
    saveCount += 1;
    callback();
  };

  await establishAuthenticatedSession(req, "user-a");

  assert.equal(regenerateCount, 1);
  assert.equal(saveCount, 1);
  assert.equal(req.session.userId, "user-a");
  assert.equal(typeof req.session.clientBinding, "string");
  assert.equal(typeof req.session.clientNetworkBinding, "string");
  assert.equal(typeof req.session.authenticatedAt, "number");
});

test("keeps a valid bound session active when only the network changes", async () => {
  const req = createRequest();
  const res = createResponse();
  await establishAuthenticatedSession(req, "user-a");
  req.ip = "172.16.8.22";
  req.socket.remoteAddress = req.ip;

  let nextCalled = false;
  enforceSessionBinding(req, res, (error?: unknown) => {
    assert.equal(error, undefined);
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.session.destroyed, undefined);
});

test("invalidates a session when the browser binding changes", async () => {
  const req = createRequest();
  const res = createResponse();
  await establishAuthenticatedSession(req, "user-a");
  req.get = () => "Different Browser/9.0";

  enforceSessionBinding(req, res, () => {
    assert.fail("binding mismatch must not continue to the protected route");
  });

  assert.equal(req.session.destroyed, true);
  assert.equal(res.cookieCleared, true);
  assert.equal(res.statusCode, 401);
});

test("invalidates a session after the absolute lifetime", async () => {
  const req = createRequest();
  const res = createResponse();
  await establishAuthenticatedSession(req, "user-a");
  req.session.authenticatedAt = Date.now() - 9 * 60 * 60 * 1000;

  enforceSessionBinding(req, res, () => {
    assert.fail("expired session must not continue to the protected route");
  });

  assert.equal(req.session.destroyed, true);
  assert.equal(res.statusCode, 401);
});