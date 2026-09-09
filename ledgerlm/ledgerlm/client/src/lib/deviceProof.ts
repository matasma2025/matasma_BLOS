/*
 * Browser half of device-bound sessions.  The private key is deliberately
 * kept as a non-extractable CryptoKey in IndexedDB; only the public JWK ever
 * leaves this module.
 */
const DB_NAME = "ledgerlm-device";
const STORE = "credentials";
const RECORD = "device";
const nativeFetch = window.fetch.bind(window);
const EXEMPT = [
  "/api/auth/signin", "/api/auth/verify-otp", "/api/auth/resend-otp",
  "/api/auth/sso/config", "/api/auth/sso/microsoft/prepare",
  "/api/auth/sso/microsoft/initiate", "/api/auth/sso/microsoft/callback",
  "/api/auth/device/nonces", "/api/auth/device/registration-challenge",
  "/api/invitations",
];

export type DeviceRegistration = {
  publicKeyJwk: JsonWebKey;
  registrationId: string;
  signature: string;
};
type DeviceRecord = { key: CryptoKey; registrationId: string; credentialId?: string; publicKeyJwk: JsonWebKey };
type NonceResponse = { nonces?: string[]; nonce?: string; expiresIn?: number };
type QueuedNonce = { value: string; expiresAt: number };

const b64 = (bytes: Uint8Array): string => {
  let value = "";
  for (let i = 0; i < bytes.length; i++) value += String.fromCharCode(bytes[i]);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
export function base64urlEncode(input: ArrayBuffer | Uint8Array): string {
  return b64(input instanceof Uint8Array ? input : new Uint8Array(input));
}
export function base64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export function registrationPayload(registrationId: string, challenge: string): string {
  return `ledgerlm-device-registration-v1.${registrationId}.${challenge}`;
}
export function proofPayload(method: string, path: string, nonce: string, timestamp: number | string, credentialId: string): string {
  return ["ledgerlm-device-proof-v1", method.toUpperCase(), path, nonce, String(timestamp), credentialId].join("\n");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open device key storage"));
  });
}
async function readRecord(): Promise<DeviceRecord | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(RECORD);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function writeRecord(record: DeviceRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(record, RECORD);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
let recordPromise: Promise<DeviceRecord> | null = null;
async function generatePair(): Promise<DeviceRecord> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]) as CryptoKeyPair;
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const result = { key: pair.privateKey, registrationId: crypto.randomUUID(), publicKeyJwk };
  await writeRecord(result);
  return result;
}
async function getRecord(): Promise<DeviceRecord> {
  if (!recordPromise) recordPromise = (async () => (await readRecord()) ?? generatePair())();
  return recordPromise;
}
export const deviceReady: Promise<void> = getRecord().then(() => undefined);
export async function getDevicePublicJwk(): Promise<JsonWebKey> {
  return (await getRecord()).publicKeyJwk;
}
export async function prepareDeviceRegistration(options?: { rotate?: boolean }): Promise<DeviceRegistration> {
  const record = options?.rotate ? await generatePair() : await getRecord();
  if (options?.rotate) recordPromise = Promise.resolve(record);
  const response = await nativeFetch("/api/auth/device/registration-challenge", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to obtain device registration challenge");
  const { challenge } = await response.json() as { challenge?: string };
  if (!challenge) throw new Error("Server returned no device registration challenge");
  const signature = await signText(registrationPayload(record.registrationId, challenge), record.key);
  return { publicKeyJwk: record.publicKeyJwk, registrationId: record.registrationId, signature };
}

export async function activatePendingDeviceCredential(): Promise<void> {
  const record = await getRecord();
  await setDeviceCredentialId(record.registrationId);
}

async function signText(text: string, key: CryptoKey): Promise<string> {
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(text)));
  return base64urlEncode(normalizeSignature(signature));
}
function normalizeSignature(signature: Uint8Array): Uint8Array {
  if (signature.length === 64) return signature;
  // Some WebCrypto implementations return ASN.1 DER despite the spec.
  if (signature[0] !== 0x30) throw new Error("Unexpected ECDSA signature format");
  let i = 2; if (signature[1] & 0x80) i += (signature[1] & 0x7f);
  if (signature[i++] !== 2) throw new Error("Invalid ECDSA signature");
  const rLen = signature[i++]; const r = signature.slice(i, i + rLen); i += rLen;
  if (signature[i++] !== 2) throw new Error("Invalid ECDSA signature");
  const s = signature.slice(i + 1, i + 1 + signature[i]);
  const out = new Uint8Array(64); out.set(r.slice(-32), 32 - Math.min(32, r.length)); out.set(s.slice(-32), 64 - Math.min(32, s.length));
  return out;
}

export async function setDeviceCredentialId(credentialId: string): Promise<void> {
  const record = await getRecord();
  await writeRecord({ ...record, credentialId });
  recordPromise = Promise.resolve({ ...record, credentialId });
  nonces = [];
}
export async function clearDeviceSessionMetadata(): Promise<void> {
  const record = await getRecord();
  await writeRecord({ key: record.key, registrationId: record.registrationId, publicKeyJwk: record.publicKeyJwk });
  recordPromise = Promise.resolve(await readRecord() as DeviceRecord);
  nonces = [];
}

let nonces: QueuedNonce[] = [];
let nonceFetch: Promise<void> | null = null;
async function fillNonces(): Promise<void> {
  if (!nonceFetch) nonceFetch = nativeFetch("/api/auth/device/nonces", { method: "POST", credentials: "include" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("Unable to obtain device proof nonce")))
    .then((data: NonceResponse) => {
      const expiresAt = Date.now() + Math.max(0, (data.expiresIn ?? 120) * 1000 - 10_000);
      nonces.push(
        ...(data.nonces ?? (data.nonce ? [data.nonce] : []))
          .map(value => ({ value, expiresAt })),
      );
    })
    .finally(() => { nonceFetch = null; });
  return nonceFetch;
}
async function takeNonce(): Promise<string> {
  nonces = nonces.filter(item => item.expiresAt > Date.now());
  if (!nonces.length) await fillNonces();
  nonces = nonces.filter(item => item.expiresAt > Date.now());
  const nonce = nonces.shift()?.value;
  if (!nonce) throw new Error("Server returned no device proof nonce");
  if (nonces.length < 2) void fillNonces();
  return nonce;
}

function sameOriginApi(input: RequestInfo | URL): { request: Request; path: string } | null {
  const request = input instanceof Request ? input : new Request(input);
  const url = new URL(request.url, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return null;
  return { request, path: url.pathname + url.search };
}
function exempt(path: string): boolean {
  return EXEMPT.some(item => path === item || (item === "/api/invitations" && path.startsWith(item + "/")));
}
export function installDeviceProofInterceptor(): void {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const details = sameOriginApi(input);
    if (!details || exempt(details.path.split("?")[0])) return nativeFetch(input, init);
    await deviceReady;
    const record = await getRecord();
    if (!record.credentialId) return nativeFetch(input, init);
    const request = new Request(details.request, init);
    const nonce = await takeNonce();
    const timestamp = Date.now();
    const signature = await signText(proofPayload(request.method, details.path, nonce, timestamp, record.credentialId), record.key);
    request.headers.set("x-device-credential-id", record.credentialId);
    request.headers.set("x-device-proof-nonce", nonce);
    request.headers.set("x-device-proof-timestamp", String(timestamp));
    request.headers.set("x-device-proof-signature", signature);
    const response = await nativeFetch(request);
    if (response.status === 401) window.dispatchEvent(new CustomEvent("ledgerlm:device-proof-failure"));
    return response;
  };
}

installDeviceProofInterceptor();