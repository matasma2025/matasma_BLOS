import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign,
} from "node:crypto";
import test from "node:test";
import { storage } from "../../server/storage";
import {
  enforceDeviceProof,
  parseRegistration,
  proofPayload,
  registrationPayload,
} from "../../server/security/deviceProof";

const keyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKeyJwk = keyPair.publicKey.export({ format: "jwk" });
const credentialId = "08ba28d8-350d-4f49-a7b4-96bdd846720d";
const registrationChallenge = "D6yW4y0an0xkbLlh0ApQ-zwDsxHkZ_6X8Sj2mb85saw";

function signatureFor(payload: string): string {
  return sign("sha256", Buffer.from(payload), {
    key: keyPair.privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
}

function request(headers: Record<string, string> = {}) {
  const session: Record<string, any> = {
    userId: "user-a",
    deviceCredentialId: credentialId,
    destroy(callback: (error?: Error) => void) {
      session.destroyed = true;
      callback();
    },
  };
  return {
    session,
    sessionID: "session-a",
    method: "GET",
    path: "/api/chats",
    originalUrl: "/api/chats?limit=10",
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as any;
}

function response() {
  return {
    statusCode: 200,
    body: undefined as any,
    cleared: [] as string[],
    clearCookie(name: string) {
      this.cleared.push(name);
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  } as any;
}

test("registration requires possession of a valid P-256 private key", () => {
  const registration = parseRegistration({
    publicKeyJwk,
    registrationId: credentialId,
    signature: signatureFor(registrationPayload(credentialId, registrationChallenge)),
  }, registrationChallenge);
  assert.equal(registration.registrationId, credentialId);

  assert.throws(() => parseRegistration({
    publicKeyJwk,
    registrationId: credentialId,
    signature: signatureFor("wrong-registration"),
  }, registrationChallenge));
  assert.throws(() => parseRegistration({
    publicKeyJwk: { ...publicKeyJwk, d: "private-material" },
    registrationId: credentialId,
    signature: signatureFor(registrationPayload(credentialId, registrationChallenge)),
  }, registrationChallenge));
  assert.throws(() => parseRegistration({
    publicKeyJwk,
    registrationId: credentialId,
    signature: signatureFor(registrationPayload(credentialId, registrationChallenge)),
  }, "another-valid-looking-registration-challenge"));
});

test("cookie-only authenticated session is rejected without device proof", async () => {
  const req = request();
  const res = response();
  let nextCalled = false;
  await enforceDeviceProof(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "DEVICE_PROOF_REQUIRED");
  assert.equal(req.session.destroyed, true);
});

test("SPA and static browser navigations do not require fetch-only proof headers", async () => {
  const req = request();
  req.path = "/dashboard";
  req.originalUrl = "/dashboard";
  const res = response();
  let nextCalled = false;
  await enforceDeviceProof(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.session.destroyed, undefined);
  assert.equal(res.statusCode, 200);
});

test("mixed-case API paths cannot bypass device proof scope", async () => {
  const req = request();
  req.path = "/API/auth/me";
  req.originalUrl = "/API/auth/me";
  const res = response();
  let nextCalled = false;
  await enforceDeviceProof(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "DEVICE_PROOF_REQUIRED");
  assert.equal(req.session.destroyed, true);
});

test("valid proof is bound to method, path, session, credential, user, and nonce", async (t) => {
  const nonce = "j3Z4h0b3qmKiMDuN3pX6TxVzP1gbdAm2DOVG3Yw_oRs";
  const timestamp = String(Date.now());
  const headers = {
    "x-device-credential-id": credentialId,
    "x-device-proof-nonce": nonce,
    "x-device-proof-timestamp": timestamp,
    "x-device-proof-signature": signatureFor(
      proofPayload("GET", "/api/chats?limit=10", nonce, timestamp, credentialId),
    ),
  };
  const originalGet = storage.getActiveDeviceCredentialForUser;
  const originalConsume = storage.consumeDeviceProofNonce;
  t.after(() => {
    storage.getActiveDeviceCredentialForUser = originalGet;
    storage.consumeDeviceProofNonce = originalConsume;
  });
  storage.getActiveDeviceCredentialForUser = async (id, userId) => ({
    id,
    userId,
    publicKeyJwk,
    fingerprint: "fingerprint",
    status: "active",
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  } as any);
  storage.consumeDeviceProofNonce = async (_hash, sessionId, id, userId) =>
    sessionId === "session-a" && id === credentialId && userId === "user-a";

  const req = request(headers);
  const res = response();
  let nextCalled = false;
  await enforceDeviceProof(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("replayed, expired, or cross-request proofs are rejected", async (t) => {
  const nonce = "j3Z4h0b3qmKiMDuN3pX6TxVzP1gbdAm2DOVG3Yw_oRs";
  const timestamp = String(Date.now());
  const originalGet = storage.getActiveDeviceCredentialForUser;
  const originalConsume = storage.consumeDeviceProofNonce;
  t.after(() => {
    storage.getActiveDeviceCredentialForUser = originalGet;
    storage.consumeDeviceProofNonce = originalConsume;
  });
  storage.getActiveDeviceCredentialForUser = async () => ({
    id: credentialId,
    userId: "user-a",
    publicKeyJwk,
    fingerprint: "fingerprint",
    status: "active",
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  } as any);
  storage.consumeDeviceProofNonce = async () => false;

  const replayHeaders = {
    "x-device-credential-id": credentialId,
    "x-device-proof-nonce": nonce,
    "x-device-proof-timestamp": timestamp,
    "x-device-proof-signature": signatureFor(
      proofPayload("GET", "/api/chats?limit=10", nonce, timestamp, credentialId),
    ),
  };
  const replayRes = response();
  await enforceDeviceProof(request(replayHeaders), replayRes, () => {
    assert.fail("replayed nonce must not continue");
  });
  assert.equal(replayRes.body.error, "DEVICE_PROOF_REPLAY");

  const expired = String(Date.now() - 61_000);
  const expiredHeaders = {
    ...replayHeaders,
    "x-device-proof-timestamp": expired,
    "x-device-proof-signature": signatureFor(
      proofPayload("GET", "/api/chats?limit=10", nonce, expired, credentialId),
    ),
  };
  const expiredRes = response();
  await enforceDeviceProof(request(expiredHeaders), expiredRes, () => {
    assert.fail("expired proof must not continue");
  });
  assert.equal(expiredRes.body.error, "DEVICE_PROOF_INVALID");

  const wrongPathHeaders = {
    ...replayHeaders,
    "x-device-proof-signature": signatureFor(
      proofPayload("GET", "/api/boards", nonce, timestamp, credentialId),
    ),
  };
  const wrongPathRes = response();
  await enforceDeviceProof(request(wrongPathHeaders), wrongPathRes, () => {
    assert.fail("proof for another path must not continue");
  });
  assert.equal(wrongPathRes.body.error, "DEVICE_PROOF_INVALID");
});