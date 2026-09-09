import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceSessionBinding,
  establishAuthenticatedSession,
  SESSION_BINDING_COOKIE,
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
    headers: {} as Record<string, string>,
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
    cookies: {} as Record<string, string>,
    cookie(name: string, value: string) {
      this.cookies[name] = value;
      return this;
    },
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
  const res = createResponse();
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

  await establishAuthenticatedSession(req, res, "user-a", "credential-a");

  assert.equal(regenerateCount, 1);
  assert.equal(saveCount, 1);
  assert.equal(req.session.userId, "user-a");
  assert.equal(req.session.deviceCredentialId, "credential-a");
  assert.equal(req.session.deviceProofVersion, 1);
  assert.equal(typeof req.session.clientBinding, "string");
  assert.equal(typeof req.session.clientNetworkBinding, "string");
  assert.equal(typeof req.session.browserBinding, "string");
  assert.equal(typeof req.session.authenticatedAt, "number");
  assert.equal(typeof res.cookies[SESSION_BINDING_COOKIE], "string");
});

test("keeps a valid bound session active when only the network changes", async () => {
  const req = createRequest();
  const res = createResponse();
  await establishAuthenticatedSession(req, res, "user-a", "credential-a");
  req.headers.cookie = `${SESSION_BINDING_COOKIE}=${encodeURIComponent(res.cookies[SESSION_BINDING_COOKIE])}`;
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
  await establishAuthenticatedSession(req, res, "user-a", "credential-a");
  req.headers.cookie = `${SESSION_BINDING_COOKIE}=${encodeURIComponent(res.cookies[SESSION_BINDING_COOKIE])}`;
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
  await establishAuthenticatedSession(req, res, "user-a", "credential-a");
  req.headers.cookie = `${SESSION_BINDING_COOKIE}=${encodeURIComponent(res.cookies[SESSION_BINDING_COOKIE])}`;
  req.session.authenticatedAt = Date.now() - 9 * 60 * 60 * 1000;

  enforceSessionBinding(req, res, () => {
    assert.fail("expired session must not continue to the protected route");
  });

  assert.equal(req.session.destroyed, true);
  assert.equal(res.statusCode, 401);
});

test("invalidates a session when the browser binding cookie is missing", async () => {
  const req = createRequest();
  const res = createResponse();
  await establishAuthenticatedSession(req, res, "user-a", "credential-a");

  enforceSessionBinding(req, res, () => {
    assert.fail("missing browser binding must not reach the protected route");
  });

  assert.equal(req.session.destroyed, true);
  assert.equal(res.statusCode, 401);
});

test("invalidates a session when the browser binding cookie is incorrect", async () => {
  const req = createRequest();
  const res = createResponse();
  await establishAuthenticatedSession(req, res, "user-a", "credential-a");
  req.headers.cookie = `${SESSION_BINDING_COOKIE}=copied-session-wrong-browser`;

  enforceSessionBinding(req, res, () => {
    assert.fail("incorrect browser binding must not reach the protected route");
  });

  assert.equal(req.session.destroyed, true);
  assert.equal(res.statusCode, 401);
});