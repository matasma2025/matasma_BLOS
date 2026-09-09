# Threat Model

## Project Overview

LedgerLM is a multi-tenant financial-intelligence application for Bosch, Nemko,
and platform administrators.  A React 18/Vite SPA talks to a Node.js/Express
API backed by PostgreSQL/Drizzle; a localhost-only Python/FastAPI service
performs document processing, RAG, and semantic SQL; and Azure OpenAI, Blob
Storage, Anaplan, SMTP, Entra ID, Key Vault, and Azure Container Registry are
external dependencies.  Users sign in with email OTP or per-domain Microsoft
SSO, and the application provides chat/SSE, financial queries, boards,
enterprise documents, uploads, downloads, and administration.

The existing model is a PostgreSQL-backed, server-side session with secure,
HttpOnly, SameSite cookies and an eight-hour TTL.  The new architecture adds a
device-bound session proof: a browser-generated non-exportable private key is
registered to a session/device, requests prove possession with a server nonce
and signature, and a separate “remember device” bearer token can bootstrap a
future session.  The exact cookie names and endpoint paths are implementation
details; the properties below apply to both the legacy session and the new
scheme during migration.

## Assets

- **Identity and session authority** -- OTP/SSO identity, session rows,
  session-cookie pair, device public keys, key-registration state, nonces,
  signatures, remember-device tokens, revocation state, and CSRF material.
  Theft or substitution enables impersonation; a privileged session exposes a
  tenant's data.
- **Tenant and user authorization data** -- domain membership, invitations,
  roles, admin/super-admin assignments, quotas, SSO configuration, and
  domain/cube identifiers.  A domain mix-up is a cross-tenant disclosure or
  privilege escalation.
- **Financial and business data** -- cube/fact data, KPI definitions, semantic
  SQL rules, query results, boards, conversations, audit records, and
  enterprise documents.  This includes confidential Bosch/Nemko information
  and derived AI answers.
- **Uploaded and generated files** -- PDFs, spreadsheets, CSVs, images,
  extracted text, embeddings, exports, and Blob Storage objects.  Files can
  contain sensitive financial information and can also be an ingestion or
  parser attack payload.
- **Application and integration secrets** -- database credentials, session
  signing/encryption keys, device-token secrets, SMTP credentials, Azure
  OpenAI/Anaplan/Google credentials, SSO client secrets, and storage keys.
- **Availability, integrity, and audit evidence** -- PostgreSQL availability,
  vector indexes, ingestion/scheduler state, SSE streams, security logs, and
  revocation/audit events.  They must remain trustworthy for investigations
  and safe operation.

## Trust Boundaries

- **Browser/SPA to public HTTPS API** -- the browser, extensions, other tabs,
  and all request bodies are untrusted.  TLS, cookie flags, origin/CSRF
  defenses, request validation, rate limits, and server-side authorization
  apply here.
- **Unauthenticated to authenticated** -- OTP and SSO bootstrap, device-key
  registration, remember-device exchange, logout, and revocation endpoints
  cross this boundary.  They must not accept an asserted user, tenant, role,
  or device as authoritative client input.
- **Cookie/token layer to device key layer** -- a cookie pair or remember
  token identifies a candidate session, while a signature proves possession
  of the registered device key.  The latter must not silently become a
  bearer fallback except during an explicitly bounded migration path.
- **User to admin/super-admin** -- admin routes, domain management, SSO
  configuration, credential management, enterprise uploads, scheduler
  controls, and forced revocation require server-side role and tenant checks.
- **Express API to PostgreSQL/pgvector** -- the application is trusted to
  query the database, but all user-controlled identifiers and generated SQL
  are untrusted.  Tenant predicates and parameterization are mandatory.
- **Express to localhost Python service** -- localhost is a deployment
  boundary, not an authentication boundary.  The Python service must only
  accept authenticated, authorized, bounded requests from the API.
- **Application to Azure services and external SaaS** -- Azure OpenAI, Blob,
  Key Vault, Entra ID, Anaplan, SMTP, and search services receive sensitive
  data or credentials.  Validate endpoints, identities, callbacks, scopes,
  timeouts, and response size/content.
- **Stored file/object to parser, browser download, or SSE client** -- file
  contents, names, MIME types, extracted text, streamed events, and download
  paths are attacker-influenced and require isolation, encoding, and
  tenant-scoped authorization.
- **Production to development/build/deployment environments** -- secrets,
  images, migrations, and configuration cross this boundary.  Replit,
  GitHub, ACR, CI, and Azure production identities must be separated and
  least-privileged.

## Scan Anchors

- **Production entry points:** `ledgerlm/ledgerlm/server/index.ts`,
  `ledgerlm/ledgerlm/server/routes.ts`, the React client under
  `ledgerlm/ledgerlm/client/src/`, and the internal API in
  `ledgerlm/ledgerlm/python_backend/main.py`.
- **Highest-risk areas:** authentication/session middleware and routes in
  `server/routes.ts`; schema and migrations in `shared/schema.ts`,
  `server/db.ts`, and `database_setup.sql`; file/Blob handling; SSE and query
  streaming; Python RAG/semantic SQL services; admin/domain/SSO routes; and
  outbound integrations.
- **Public surfaces:** static SPA, login/domain discovery, OTP initiation,
  SSO start/callback, health/readiness as intentionally exposed, and
  remember-device/bootstrap endpoints (with strict throttling).  Treat every
  other API as authenticated unless explicitly documented.
- **Authenticated surfaces:** chat/query, SSE, boards, conversations,
  document vault, uploads/downloads, connectors, and user device/session
  management.  **Admin surfaces:** domain, user/role, enterprise documents,
  SSO, credentials, schedulers, audit, and forced-revocation controls.
- **Usually non-production:** `attached_assets/`, test scripts, deployment
  guides, generated artifacts, and `node_modules/`; do not use them as
  security controls or assume their examples describe the live routes.

## Threat Categories

### Spoofing

**Cookie-pair theft.** An attacker who obtains both session cookies (through
malware, a proxy, browser backup, a mis-scoped cookie, or transport/log
leakage) may replay them.  `HttpOnly` prevents ordinary script reads but does
not prevent an attacker who controls the browser or has stolen the cookie.
The server MUST validate both cookies, expiry, session status, tenant, and
device binding on every protected request.  A cookie pair MUST NOT by itself
silently bypass device proof after migration; suspicious replay and binding
failures MUST be auditable and rate-limited.

**Remember-device bearer token.** This token is intentionally bearer
authentication and is a high-value recovery credential.  It MUST be
cryptographically random, opaque, stored only as a verifier/hash server-side,
scoped to one user/device/tenant, short-lived or rotated on use, revocable
independently, and never logged or exposed to JavaScript unnecessarily.
Bootstrap MUST require an exact allowed origin/redirect, rate limits, and
server-side eligibility; it MUST NOT let a token choose a different user,
tenant, role, or registered key.

**Nonce/signature replay.** Every challenge MUST be unpredictable, bound to
the session/device, request method/path (and a hash of the relevant body),
origin/tenant, and a short expiry.  It MUST be single-use, atomically
consumed, and rejected after logout, rotation, or revocation.  Signatures
MUST verify against the server-stored public key and an explicit algorithm,
not a client-selected algorithm or key.

**SSO bootstrap.** The callback MUST validate state, nonce, issuer, audience,
authorization-code exchange, redirect URI, and tenant configuration, then
map the immutable provider subject to a pre-invited local user.  Email,
domain, group, or display name alone MUST NOT select an account or grant
admin access.

### Tampering

**Key registration substitution.** A registration request MUST be tied to a
fresh authenticated bootstrap/session and a one-time server challenge.
The server MUST store the public key and immutable device record atomically,
prevent replacement by an unprivileged request, and require step-up/recovery
confirmation to rotate or remove a key.  Client-supplied device labels,
user IDs, domain IDs, roles, and credential status are informational only.

Requests, uploads, filenames, query filters, export options, and download
paths MUST be schema-validated and authorized on the server.  SQL MUST remain
parameterized and generated semantic SQL MUST be constrained to permitted
read operations and the current tenant/cube.  A signed request MUST protect
integrity only; it MUST NOT turn unauthorized business data into authorized
data.

### Repudiation

Sensitive events MUST produce tamper-evident, privacy-conscious audit
records: OTP/SSO success and failure, device registration/rotation/removal,
remember-device issuance/use/revocation, nonce failures, session creation
and revocation, role/domain changes, admin actions, uploads/downloads,
exports, and forced revocation.  Records MUST include actor/user (or
anonymous request), tenant, device/session identifier, action, result,
timestamp, correlation/request ID, and reason without recording cookies,
bearer tokens, private keys, OTPs, raw signatures, or document contents.
Concurrent actions MUST have a deterministic audit ordering.

### Information Disclosure

XSS is especially consequential in a device-bound design: JavaScript cannot
normally export a non-extractable key, but malicious script can invoke
`sign()` and use the user's active authority.  The SPA MUST use contextual
output encoding and safe DOM APIs, strict CSP (with nonces/hashes and no
unsafe inline/eval), dependency controls, and CSRF/origin defenses.  Key
operations MUST require the expected origin and narrow request purpose; do
not expose private key material, remember tokens, cookie values, or broad
signing APIs to application content.

Database compromise exposes session/token verifiers, public keys, tenant
data, documents, embeddings, and audit history.  Password/OTP and bearer
verifiers MUST be slow, salted hashes; encryption keys MUST be outside the
database (Key Vault); sensitive columns/backups/logs MUST be protected; and
database credentials MUST be least-privileged and rotated.  Assume an
attacker who can alter the database can impersonate sessions or substitute
keys until the application detects and responds; independent key/audit
integrity and rapid global revocation are required.

All reads, SSE events, downloads, exports, and AI prompts/results MUST be
scoped to the authenticated user, tenant/domain, and authorized resource.
Responses MUST omit secrets and unrelated fields.  Download names and
content disposition MUST prevent header injection/path traversal; uploaded
documents MUST remain outside the web root and be served through authorized
opaque identifiers.  SSE MUST not leak cross-tenant events and MUST not
reuse a stream after its session is revoked.

### Denial of Service

OTP, SSO, registration, bootstrap, nonce, upload, query, export, download,
and SSE creation MUST have per-IP, per-account, per-tenant, and global
budgets as appropriate.  Apply request/body/file/row/token/stream limits,
parser isolation, queue backpressure, connection and upstream timeouts,
bounded AI prompts, and cancellation on disconnect.  Verify Blob imports and
cloud-drive URLs against allowlists to prevent SSRF and expensive fetches.

**Forced revocation abuse.** An attacker must not be able to revoke sessions,
devices, or an entire tenant merely by presenting a user ID, guessed device
ID, stale signature, or CSRFable request.  Revocation MUST require an
authorized actor, fresh authentication/step-up for broad scope, explicit
scope, idempotent transactions, and rate limits.  Global emergency revocation
must be available to defenders, but its propagation and recovery path MUST
not create an attacker-controlled logout storm.

**Multi-tab concurrency.** Tabs can race registration, nonce use, refresh,
logout, bootstrap, and revocation.  Challenges/tokens MUST be single-use
with atomic compare-and-set semantics; session and device state transitions
MUST be transactional and monotonic.  A tab receiving a stale response MUST
not overwrite newer cookies, keys, or revocation state.  Broadcast-channel
or storage synchronization MUST carry events, not bearer secrets, and a
revoked session MUST fail closed in every tab and stream.

### Elevation of Privilege

Every endpoint MUST authorize the server-derived user, tenant/domain,
resource owner, and role, including admin APIs, SSO configuration, connector
credentials, enterprise files, scheduler controls, downloads, and forced
revocation.  IDs from the client, UI-hidden controls, email domain, SSO group
claims, device labels, or a valid signature MUST never substitute for an
authorization decision.  Admin-to-super-admin and cross-tenant actions MUST
be separately checked and audited.  Database queries, object keys, Python
calls, and AI tool operations MUST preserve tenant isolation.  CSRF
protection is required for cookie-authenticated state changes even when
SameSite is enabled.

## Required Guarantees

- All protected API, SSE, upload, download, and internal-service operations
  MUST authenticate an unexpired, non-revoked session and authorize its
  tenant/resource on the server.
- Device-bound proof MUST use a registered public key, a fresh
  single-use challenge, explicit domain separation, and atomic replay
  protection; signature verification MUST fail closed.
- Cookie pairs and remember-device tokens MUST be Secure, appropriately
  scoped, opaque, unguessable, rotated where applicable, absent from logs,
  and independently revocable.  Bearer bootstrap MUST be an explicit,
  bounded compatibility/recovery path, not an accidental key-proof bypass.
- Key registration, replacement, recovery, logout, and revocation MUST be
  race-safe and auditable; revocation MUST invalidate cookies, bearer
  tokens, outstanding nonces, and SSE streams within the documented bound.
- SSO MUST use verified OIDC parameters and pre-invitation/account mapping;
  OTPs MUST be one-time, short-lived, throttled, and stored only as hashes.
- XSS defenses MUST prevent untrusted content from invoking sensitive key
  operations outside an intentional, narrowly scoped user action.
- PostgreSQL and Blob/object access MUST enforce tenant/resource isolation;
  secrets and token verifiers MUST be protected separately from data
  backups, and all queries MUST be parameterized.
- Uploads/downloads/SSE MUST be bounded, content/path safe, authorization
  checked at execution time, and isolated from the static web root.
- Admin authorization MUST be server-side, least-privileged, step-up
  protected for high-impact changes, and represented in audit events.
- Rate limits, quotas, timeouts, backpressure, cancellation, and bounded
  parsing MUST protect authentication and data-processing paths from abuse.

## Residual Risks

- A fully compromised browser, malicious extension, or XSS can drive a
  legitimate key while the user is active; device binding limits portability
  but does not replace browser isolation, CSP, and user-visible step-up.
- Legacy remember-device bearer tokens are invalidated and no longer accepted
  by login routes. A copied session can still be deliberately presented
  without a valid proof to force that individual session to be destroyed.
- Database or application-host compromise can alter authorization state,
  observe plaintext while requests execute, or issue valid sessions.  Key
  separation, immutable external audit, and incident response are required.
- Entra ID, SMTP, Azure, Anaplan, OpenAI, Blob, CI/CD, and browser
  cryptography implementations remain external dependencies whose outage or
  compromise can affect availability or confidentiality.
- Multi-tenant logical isolation depends on complete route/query coverage;
  a missed predicate, unsafe generated SQL path, or incorrectly scoped object
  key remains a high-impact defect.
- Revocation is bounded by cache/stream propagation and network failure;
  the documented maximum stale-authorization window must be accepted and
  monitored.

## Rollout Risk and Controls

The migration can strand users, create inconsistent cookies, or accidentally
make a bearer cookie the new universal fallback.  It can also expose a
registration race or invalidate all SSE and multi-tab clients at once.

Roll out behind a server-side feature flag by tenant and cohort.  Maintain
legacy sessions only for a measured, short migration window; mark each
session/device with an explicit version and never infer proof from a missing
field.  Require fresh OTP/verified SSO for initial key registration, use
dual-read/controlled dual-write only where both paths enforce the same
authorization, and provide a rate-limited recovery path that cannot silently
upgrade privilege.  Test replay, key substitution, cookie-pair theft,
remember-token theft, XSS signing attempts, database restore, SSO state
confusion, multi-tab races, stream revocation, upload/download isolation,
admin boundaries, and forced-revocation storms before expanding cohorts.
Instrument rejection reasons without secrets, publish session/device
management and recovery procedures, keep a kill switch that revokes new
device proofs without weakening existing authorization, and perform staged
rollback with explicit revocation rather than restoring stale sessions.