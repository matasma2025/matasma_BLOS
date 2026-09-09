import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { clearAuthenticationCookies } from "../middleware/sessionBinding";

export const registrationPayload = (id: string, challenge: string) =>
  `ledgerlm-device-registration-v1.${id}.${challenge}`;
export const proofPayload = (method: string, path: string, nonce: string, timestamp: string, credentialId: string) =>
  ["ledgerlm-device-proof-v1", method.toUpperCase(), path, nonce, timestamp, credentialId].join("\n");

function b64(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  return Buffer.from(value, "base64url");
}
export function validatePublicJwk(input: unknown): any {
  const k = input as Record<string, unknown>;
  if (!k || k.kty !== "EC" || k.crv !== "P-256" || typeof k.x !== "string" || typeof k.y !== "string") throw new Error("invalid public key");
  const x = b64(k.x), y = b64(k.y);
  if (x.length !== 32 || y.length !== 32 || k.d !== undefined) throw new Error("invalid public key");
  if (k.ext !== undefined && k.ext !== true) throw new Error("invalid key policy");
  if (k.use !== undefined && k.use !== "sig") throw new Error("invalid key policy");
  if (k.key_ops !== undefined && (!Array.isArray(k.key_ops) || k.key_ops.length !== 1 || k.key_ops[0] !== "verify")) throw new Error("invalid key policy");
  return { kty: "EC", crv: "P-256", x: k.x, y: k.y, ext: true, use: "sig", key_ops: ["verify"] };
}
export function fingerprintJwk(jwk: any): string {
  return crypto.createHash("sha256").update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).digest("hex");
}
export function verifyDeviceSignature(jwk: any, payload: string, signature: string): boolean {
  try {
    const sig = b64(signature);
    if (sig.length !== 64) return false;
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    return crypto.verify("sha256", Buffer.from(payload, "utf8"), { key, dsaEncoding: "ieee-p1363" }, sig);
  } catch { return false; }
}
export function parseRegistration(input: any, challenge: string): { publicKeyJwk: any; registrationId: string; signature: string } {
  if (!input || typeof input.registrationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.registrationId) || typeof input.signature !== "string") throw new Error("invalid registration");
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(challenge)) throw new Error("invalid registration challenge");
  const jwk = validatePublicJwk(input.publicKeyJwk);
  if (!verifyDeviceSignature(jwk, registrationPayload(input.registrationId, challenge), input.signature)) throw new Error("invalid registration proof");
  return { publicKeyJwk: jwk, registrationId: input.registrationId, signature: input.signature };
}

const EXEMPT = new Set([
  "/api/auth/device/nonces",
  "/api/auth/device/registration-challenge",
  "/api/auth/logout",
]);
export async function enforceDeviceProof(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (
    !req.path.toLowerCase().startsWith("/api/") ||
    !req.session?.userId ||
    EXEMPT.has(req.path)
  ) return next();
  const fail = async (code: string) => {
    await new Promise<void>((resolve) => {
      req.session.destroy(() => resolve());
    });
    clearAuthenticationCookies(res);
    res.status(401).json({ error: code });
  };
  try {
    const id = req.session.deviceCredentialId;
    const nonce = req.header("x-device-proof-nonce");
    const timestamp = req.header("x-device-proof-timestamp");
    const credentialId = req.header("x-device-credential-id");
    const signature = req.header("x-device-proof-signature");
    if (!id || !nonce || !timestamp || !credentialId || !signature || credentialId !== id) return fail("DEVICE_PROOF_REQUIRED");
    const t = Number(timestamp);
    if (!Number.isSafeInteger(t) || Math.abs(Date.now() - t) > 60_000) return fail("DEVICE_PROOF_INVALID");
    const credential = await storage.getActiveDeviceCredentialForUser(credentialId, req.session.userId);
    if (!credential || !verifyDeviceSignature(credential.publicKeyJwk, proofPayload(req.method, req.originalUrl, nonce, timestamp, credentialId), signature)) return fail("DEVICE_PROOF_INVALID");
    const consumed = await storage.consumeDeviceProofNonce(crypto.createHash("sha256").update(nonce).digest("hex"), req.sessionID, credentialId, req.session.userId);
    if (!consumed) return fail("DEVICE_PROOF_REPLAY");
    next();
  } catch (error) {
    console.error("Device proof verification failed:", error);
    return fail("DEVICE_PROOF_INVALID");
  }
}