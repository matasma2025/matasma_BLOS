# LedgerLM — Full Codebase Review

> **Scope**: Architecture, design patterns, code quality, security, performance, and feature improvement opportunities.  
> **Date**: May 2026  
> **Stack**: Node.js/Express + React/Vite + Python FastAPI + PostgreSQL (Neon/pgvector)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [What Is Well-Designed](#2-what-is-well-designed)
3. [What Is Wrong / Technical Debt](#3-what-is-wrong--technical-debt)
4. [Security Issues](#4-security-issues)
5. [Code Standards & Consistency](#5-code-standards--consistency)
6. [Performance Observations](#6-performance-observations)
7. [Feature Improvement Opportunities](#7-feature-improvement-opportunities)
8. [Priority Action Plan](#8-priority-action-plan)

---

## 1. Architecture Overview

```
ledgerlm/
├── client/src/          React + Vite frontend (Tailwind + Shadcn UI)
├── server/              Express.js backend (TypeScript via tsx)
│   ├── routes.ts        ⚠ 8,524 lines — monolithic route file
│   ├── storage.ts       Drizzle ORM data-access layer
│   ├── services/        queryOrchestrator, evidenceBroker, scheduler, SSO, etc.
│   ├── migrations/      26 individual migration files run inline at startup
│   └── middleware/      auth.ts + rbac.ts
├── python_backend/      FastAPI (port 8000) — RAG, embeddings, semantic SQL
│   ├── services/
│   │   ├── semantic_sql_service.py   ⚠ 13,707 lines — monolithic SQL builder
│   │   └── rag_engine.py             2,138 lines
│   └── api/routes/      documents, embeddings, rag, enterprise, semantic_sql
└── shared/schema.ts     Drizzle schema + Zod validators (1,561 lines)
```

**Communication pattern**: Browser → Express (port 5000) → Python FastAPI (port 8000) for heavy work. Express proxies calls to Python; Python has direct database access (psycopg2) in parallel with the Node Drizzle ORM connection — two separate database clients against the same DB.

---

## 2. What Is Well-Designed

### ✅ Multi-tenant Data Model
The `domains → companies → cubes → cube_fact_data` hierarchy is thoughtfully layered. Cubes provide granular data isolation within a company — a design that scales naturally to new tenants without schema changes.

### ✅ Pluggable Connector Registry (`connectorRegistry.ts`)
New data source connectors (Azure Blob, Anaplan) follow a consistent interface registered at boot time. Adding a third connector (SharePoint, S3, etc.) requires only a new file implementing the interface — no changes to existing code. This is correct use of the Open/Closed principle.

### ✅ Encryption of Sensitive Fields (`server/utils/encryption.ts`)
API keys, Anaplan credentials, and Azure secrets are encrypted with AES-256-CBC before being stored. The `encryptSensitiveFields` / `redactSensitiveFields` helpers are applied consistently in the domain/connector routes. Good data-at-rest protection.

### ✅ Metric Catalog Architecture (`semantic_sql_service.py`)
Mapping ambiguous natural-language financial terms (e.g., "pyramid mix", "CTG adjustment", "billing utilization") to deterministic SQL builder functions via a `METRIC_CATALOG` registry is a strong design. It separates the NL→intent classification step from the SQL generation step, making each independently testable.

### ✅ Graceful Python Backend Startup (`main.py`)
The `startup_validation` event never blocks server boot. It validates calculations and logs warnings but always lets the process continue. The dedicated `/health/calculations` endpoint is excellent observability tooling.

### ✅ Azure OpenAI Provider Abstraction (`rag_engine.py`, `openai.ts`)
Both the Node.js streaming path and the Python non-streaming path check for `provider == "azure_openai"` and fall back to Ollama if Azure is not configured. The abstraction lets a domain switch AI providers with zero code changes — only a DB config row update.

### ✅ Device Trust System (`device_trust` table + OTP flow)
The OTP + device fingerprint "remember this device" system is a proper second-factor setup. Hashing device tokens before storage follows the same principle as hashing passwords.

### ✅ Session Security (`server/index.ts`)
Sessions use `httpOnly: true`, `secure` flag tied to `NODE_ENV === 'production'`, and are backed by a PostgreSQL session store — not in-memory. This is correct: sessions survive restarts and cannot be read by browser JS.

### ✅ Shared Zod Schemas (`shared/schema.ts`)
`createInsertSchema` from `drizzle-zod` ensures that validation schemas and DB column definitions cannot drift. The `strongPasswordSchema` validator is defined in one shared location and imported wherever needed.

### ✅ Streaming SSE for AI Responses (`openai.ts`)
The Azure OpenAI streaming path implements proper SSE chunked reading with a `buffer` for split lines. This keeps the UI responsive and avoids timeout issues on long AI responses.

---

## 3. What Is Wrong / Technical Debt

### 🔴 CRITICAL: `routes.ts` is 8,524 lines — a monolith

**File**: `ledgerlm/server/routes.ts`

This is the single biggest architectural problem. One file contains every route for auth, chat, documents, boards, admin, domain management, connectors, cubes, embeddings, semantic SQL, scheduler, SSO, kiosk, invitations, etc.

**Problems it causes**:
- Merge conflicts on almost every feature
- Can't onboard a new developer without reading thousands of lines
- Impossible to unit-test individual route groups in isolation
- A bug in one route group requires reading the entire file to find context
- Build tools (tsc/tsx) re-parse the entire 8k-line file on any change

**Fix**: Split into feature-scoped route files and register them in `routes.ts` as a thin index:
```
server/routes/
  auth.ts          (~200 lines)
  chat.ts          (~400 lines)
  documents.ts     (~300 lines)
  boards.ts        (~400 lines)
  admin.ts         (~600 lines)
  domains.ts       (~500 lines)
  connectors.ts    (~400 lines)
  cubes.ts         (~500 lines)
  semantic-sql.ts  (~400 lines)
  scheduler.ts     (~300 lines)
  ...
server/routes.ts   (only imports and registers the above)
```

---

### 🔴 CRITICAL: `semantic_sql_service.py` is 13,707 lines — unmaintainable

**File**: `ledgerlm/python_backend/services/semantic_sql_service.py`

This file contains the `SemanticSQLService` class with every SQL builder for every metric, every tenant-specific override, the metric catalog, helper utilities, filter injection logic, intent parsing, and more.

**Problems**:
- Finding the right builder function requires text search — no navigable structure
- A bug fix in one metric risks breaking an unrelated metric 2,000 lines away
- The class has dozens of methods that are logically unrelated to each other
- Python linters and type checkers slow to a crawl on 13k-line files

**Fix**: Split by domain/responsibility:
```
python_backend/services/semantic_sql/
  __init__.py                  (exports SemanticSQLService facade)
  intent_parser.py             (NL → intent classification, get_llm_response)
  metric_catalog.py            (METRIC_CATALOG dict, calculation registry)
  time_filter.py               (_inject_time_from_query, _expand_month_filter_for_ytd)
  builders/
    gb_pl_revenue.py
    internal_capacity_mix.py
    external_capacity_mix.py
    plan_data.py
    ebit.py
    ...
  base_builder.py              (shared helpers: _is_multi_year, _is_cross_month, etc.)
```

---

### 🔴 CRITICAL: Two separate database clients against the same DB

Node.js uses **Drizzle ORM** with a `pg.Pool`. Python uses **psycopg2** with raw connections via `get_db_connection()`. Both point at the same Neon PostgreSQL database.

**Problems**:
- Schema changes must be coordinated across two completely different codebases
- Connection pool exhaustion risk (Neon's free tier caps at 10 connections)
- Transactions cannot span both clients — no atomicity for workflows that touch both
- `shared/schema.ts` is the source of truth but Python has its own raw SQL column references that must be kept in sync manually

**Fix options** (in order of preference):
1. Route all DB writes through the Node API (Python only queries)
2. Create a shared SQL schema file used by both (e.g., Liquibase / plain SQL migrations)
3. Move Python to SQLAlchemy + alembic so migrations can be versioned and shared

---

### 🟠 HIGH: 26 individual migration files run inline at startup

**File**: `ledgerlm/server/index.ts` (lines 119–181)

Every migration function is imported and awaited sequentially at boot time. These are plain `ALTER TABLE / CREATE TABLE IF NOT EXISTS` calls — not tracked by any migration framework.

**Problems**:
- No rollback mechanism — a failed migration leaves the DB in a partial state
- Boot time grows as migrations accumulate (already 26)
- Order-dependent: changing the import order can break startup
- `drizzle-kit push` and the inline migrations duplicate each other's responsibilities
- No migration history table — can't tell what has run vs. not run

**Fix**: Consolidate to **Drizzle migrations** (`drizzle-kit generate` + `drizzle-kit migrate`). All schema state lives in the Drizzle schema, all history in a `drizzle_migrations` table.

---

### 🟠 HIGH: Authentication state stored in `localStorage`

**File**: `ledgerlm/client/src/lib/auth.ts`, `App.tsx`

The user object (including `role`) is written to `localStorage` after login and read back on every page load as the primary auth check.

**Problems**:
- `localStorage` is accessible to any JavaScript on the page — XSS reads it directly
- The user's `role` in `localStorage` can be tampered with client-side (the server-side session is still authoritative, but any route check that reads from the cached object is bypassed)
- There is no automatic invalidation when the server session expires (30-day cookie vs stale localStorage entry)

**Fix**: Store only a session indicator (boolean) in `localStorage`, and always validate role/identity from `/api/auth/me` before rendering admin-protected routes. Or use `sessionStorage` which is tab-scoped and cleared on close.

---

### 🟠 HIGH: `console.log` / `console.error` used throughout server code

Examples:
- `server/middleware/auth.ts:35` — `console.error('Auth middleware error:', error)`
- `server/openai.ts:175` — `console.log('[Azure OpenAI] Using deployment...')`
- `server/routes.ts` — dozens of `console.log` calls

**Problems**: Console logs in production mix with structured logs, can't be filtered by level, can leak request data, and can't be aggregated by observability tools.

**Fix**: Use the `log()` function already established in `server/vite.ts` everywhere, or introduce a proper logger (`pino` is already installed in many Express stacks).

---

### 🟡 MEDIUM: `auth.ts` and `rbac.ts` duplicate the user-fetch logic

Both middlewares do:
```ts
const userId = req.session?.userId;
const user = await storage.getUser(userId);
req.user = user;
```

`requireAdmin` is essentially `requireAuth` with a role check added after the same boilerplate.

**Fix**: Compose middlewares:
```ts
export const requireAdmin = [requireAuth, requireRole('admin')];
```

---

### 🟡 MEDIUM: Python backend CORS wildcard in production

**File**: `ledgerlm/python_backend/main.py:39`
```python
allow_origins=["*"],  # In production, specify exact origins
```
The comment acknowledges this is wrong but it was never fixed.

**Fix**: Use `settings.ALLOWED_ORIGINS` (list from env var) with a fallback to the Express server URL.

---

### 🟡 MEDIUM: `SemanticSqlTest` page exposed in production routing

**File**: `ledgerlm/client/src/App.tsx:138`
```jsx
<Route path="/semantic-sql-test">
```

This is a developer debugging page routed directly in the production app with no auth guard check beyond the session. It exposes raw SQL generation internals to any authenticated user.

**Fix**: Gate behind `role === 'super_admin'` check, or remove from production routing and use a dev-only environment flag.

---

### 🟡 MEDIUM: Hardcoded OTP backdoor

**File**: `ledgerlm/server/services/otpService.ts` (referenced in scratchpad)

Certain admin emails use a hardcoded OTP (`123456`) that bypasses the normal OTP flow. This is guarded by rate limiting but is still a static secret embedded in code.

**Fix**: Replace with an environment variable `ADMIN_OTP_OVERRIDE` that is blank in production and only set in staging/dev environments.

---

## 4. Security Issues

| Severity | Issue | File | Fix |
|---|---|---|---|
| 🔴 HIGH | Auth state (`role`, `userId`) in `localStorage` — XSS-readable | `client/src/lib/auth.ts` | Use `sessionStorage` or server-only auth check |
| 🔴 HIGH | CORS wildcard `allow_origins=["*"]` on Python backend | `python_backend/main.py:39` | Lock to Express origin via env var |
| 🟠 MED | Hardcoded OTP `123456` for specific admin emails | `server/services/otpService.ts` | Env var override, never hardcode in source |
| 🟠 MED | `rejectUnauthorized: false` in session pool SSL config | `server/index.ts:98` | Use proper CA cert for Neon SSL |
| 🟡 LOW | `/semantic-sql-test` route exposed to all auth users | `client/src/App.tsx` | Super-admin gate or env flag |
| 🟡 LOW | `vision_extractor.py` uses hardcoded `gpt-4o` — no domain config | `parsers/vision_extractor.py` | Accept `ai_config` and use domain model |
| 🟡 LOW | `mcp/server.py` uses `max_tokens=2000` (breaks with GPT-5.2) | `mcp/server.py:225` | Replace with `max_completion_tokens` |
| 🟡 LOW | Uploaded files stored on local filesystem (`uploads/`) | `server/routes.ts` | Use Azure Blob or object storage in prod |

---

## 5. Code Standards & Consistency

### TypeScript

| Issue | Example | Severity |
|---|---|---|
| `any` type used broadly | `results: any[]` in `queryOrchestrator.ts` | 🟡 |
| `console.log` in server code instead of structured logger | `server/middleware/auth.ts`, `openai.ts` | 🟠 |
| Route handlers not separated into controller functions | Inline logic in `routes.ts` | 🟠 |
| No API response type contracts (no OpenAPI spec for the Express side) | `routes.ts` | 🟡 |
| Inline Zod schemas defined per-route instead of in `shared/schema.ts` | `signinSchema`, `verifyOtpSchema` at top of `routes.ts` | 🟡 |

### Python

| Issue | Example | Severity |
|---|---|---|
| No type annotations on most functions | `semantic_sql_service.py` builder functions | 🟠 |
| Magic strings for metric names, column names | `'cube_fact_data'`, `'resource_cost'` scattered throughout | 🟠 |
| `requests.get_db_connection()` instead of SQLAlchemy session pooling | `semantic_sql_service.py` | 🟠 |
| `verify=False` on some Ollama HTTP calls (skips TLS verification) | `semantic_sql_service.py:52` | 🟡 |
| `logger` declared after it is first used (`get_llm_response` references logger before line 64) | `semantic_sql_service.py:38 vs 64` | 🟡 |
| Circular import workaround with inline `from services.rag_engine import ...` | `semantic_sql_service.py:35` | 🟡 |

### Frontend

| Issue | Example | Severity |
|---|---|---|
| No global error boundary — unhandled React errors show blank screen | `App.tsx` | 🟠 |
| Auth check repeats `fetch('/api/auth/me')` pattern in multiple places | `App.tsx`, various pages | 🟡 |
| No loading skeleton for protected routes — `ProtectedRoute` returns `null` while checking | `App.tsx:53` | 🟡 |
| `AdminPortal.tsx` page exists but is not registered in routing | `pages/AdminPortal.tsx` | 🟡 |
| `SemanticSqlTest` — developer debug page in production bundle | `App.tsx:138` | 🟠 |

---

## 6. Performance Observations

### 🔴 Startup time grows unboundedly

26 sequential migration functions at startup (all `ALTER TABLE IF NOT EXISTS` checks against live DB) add latency on every process restart. On cold boot they run in sequence — no parallelization.

### 🟠 Two DB connection pools (Node + Python)

Neon's connection limit is shared between `pg.Pool` (Node) and psycopg2 (Python). Under load, both compete for connections. The Python service opens/closes connections per request rather than pooling (`get_db_connection()` → `psycopg2.connect()`).

**Fix for Python**: Use a module-level connection pool:
```python
from psycopg2 import pool
_pool = pool.ThreadedConnectionPool(1, 10, dsn=settings.DATABASE_URL)
```

### 🟠 `semantic_sql_service.py` loads the entire metric catalog on every instance creation

`SemanticSQLService()` is constructed per-request in some routes. The `METRIC_CATALOG` dict and business logic are re-loaded from the database on every call.

**Fix**: Singleton pattern with lazy-loaded catalog, invalidated on schema config changes.

### 🟡 No caching layer for repeated semantic SQL queries

The same query ("show BGSW headcount for Jan 2026") generates the same SQL and fetches the same data rows every time. No memoization.

**Fix**: Redis/in-memory LRU cache keyed on `(cube_id, normalized_query_hash)` with a TTL matching data refresh frequency.

### 🟡 `storage.ts` makes a DB round-trip for the user on every authenticated request

`requireAuth` calls `storage.getUser(userId)` for every API request. With session, the userId is known — re-fetching the full user object from DB on every request adds unnecessary latency.

**Fix**: Cache user records in the session store or an in-process LRU cache (invalidate on role change).

---

## 7. Feature Improvement Opportunities

### A. Proper Migration Framework

**Current**: 26 inline migration files, no rollback, no tracking.  
**Proposed**: `drizzle-kit generate` + `drizzle-kit migrate` with a `drizzle_migrations` table. Run migrations as a pre-start step, not during request handling. Separate Python migrations into Alembic.

---

### B. API Contract Layer (OpenAPI)

**Current**: No machine-readable API contract for the Express routes. The Python FastAPI side auto-generates OpenAPI docs (`/docs`) but the Node side has none.  
**Proposed**: Add `@asteasolutions/zod-to-openapi` or similar. Generate a client SDK for the frontend from the Express routes. This eliminates the `fetch('/api/...')` boilerplate scattered across React components.

---

### C. React Query + Generated Hooks

**Current**: Most React pages call `fetch('/api/...')` directly inside `useEffect` or event handlers.  
**Proposed**: With an OpenAPI spec, generate typed React Query hooks (`@tanstack/react-query` + `openapi-typescript-codegen`). Every API call becomes a typed, cached, auto-retrying hook.

---

### D. Audit Log Viewer in Admin UI

**Current**: `query_audit` table exists and is populated, but there is no UI to view it.  
**Proposed**: An admin page showing per-user query history, tokens used, errors, and query latency. Useful for compliance and debugging.

---

### E. Connector Health Dashboard

**Current**: Connectors (Azure Blob, Anaplan) run on a scheduler but failures are only visible in server logs.  
**Proposed**: Store connector run history (last run time, status, rows synced, errors) and surface it in the Admin Connectors UI. Add a "Test Connection" button per connector.

---

### F. Streaming Status for Document Ingestion

**Current**: Uploading and processing a large Excel file gives no feedback — the user waits until processing is complete.  
**Proposed**: Use SSE or WebSocket to stream ingestion progress events (chunk count, embedding progress, cube write count) back to the UI. The `ingestion_jobs` table exists — wire it to a live polling endpoint.

---

### G. Query Explanation Mode

**Current**: The AI answers a financial question but the user cannot see what SQL was actually run.  
**Proposed**: A "Show query" toggle in the chat that reveals the generated SQL, the cube queried, and the row count returned. Useful for power users and debugging trust issues.

---

### H. Role Hierarchy Expansion

**Current**: Roles are flat: `super_admin`, `admin`, `standard`.  
**Proposed**: Add `cube_viewer` and `cube_editor` roles scoped to specific cube IDs via the existing `cube_user_access` table (which already exists). Admin UI to assign cube-level access per user.

---

### I. Python Backend Observability

**Current**: Python logs to stdout. No structured logging, no request IDs, no correlation to Node request IDs.  
**Proposed**: Add `structlog` with JSON formatter. Pass `X-Request-ID` header from Node to Python on all proxy calls. Include it in every Python log line.

---

### J. Test Coverage

**Current**: No test files found in the repository (`test_rag_flow.py` exists but is a manual script, not a pytest suite).  
**Proposed**: 
- **Python**: `pytest` + `pytest-asyncio` for FastAPI routes and SQL builder unit tests (especially the cross-year/cross-month comparison logic that required multiple fixes).
- **Node**: `vitest` for route handlers and service functions.
- **E2E**: Playwright for login → chat → semantic query → result validation.

---

## 8. Priority Action Plan

| Priority | Task | Effort | Impact |
|---|---|---|---|
| 1 | Split `routes.ts` into feature-scoped route files | 2–3 days | Very high — removes biggest maintenance blocker |
| 2 | Split `semantic_sql_service.py` into modules | 3–4 days | Very high — enables safe future metric additions |
| 3 | Replace 26 inline migrations with `drizzle-kit migrate` | 1–2 days | High — safe schema evolution |
| 4 | Fix Python CORS wildcard | 30 min | High — security fix |
| 5 | Replace `localStorage` auth state with server-authoritative check | 1 day | High — security fix |
| 6 | Add `structlog` + request correlation to Python backend | 1 day | Medium — observability |
| 7 | Add psycopg2 connection pool in Python | 2 hours | Medium — stability under load |
| 8 | Cache user object in session (reduce DB hits per request) | 2 hours | Medium — performance |
| 9 | Wire `ingestion_jobs` to a live progress SSE endpoint | 1 day | Medium — UX |
| 10 | Add pytest suite for SQL builder functions | 2–3 days | Medium — regression safety |
| 11 | Add React error boundary in `App.tsx` | 1 hour | Low-medium — UX resilience |
| 12 | Gate `/semantic-sql-test` behind super_admin role | 30 min | Low — security hygiene |

---

*This review is based on static analysis of the codebase as of the date above. Dynamic profiling and load testing would surface additional performance findings.*
