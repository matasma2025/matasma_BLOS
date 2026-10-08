import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createOperationLimitMiddleware, retainOperationLease } from "../../server/security/operationLimitMiddleware";
import { loadConcurrencyLimits, loadOperationPolicies, operationForRequest, type BudgetStore, type Budget, type LeaseScope } from "../../server/security/operationLimitPolicy";
import { configureTrustedProxy } from "../../server/security/trustedProxy";

class TestStore implements BudgetStore {
  now = 0;
  counters = new Map<string, { hits: number; expires: number }>();
  leases = new Map<string, LeaseScope[]>();
  unavailable = false;
  async consume(budgets: Budget[], scopes: LeaseScope[] = [], lease?: string) {
    if (this.unavailable) throw new Error("Store offline");
    let retry = 0;
    for (const budget of budgets) {
      const counter = this.counters.get(budget.key);
      if (counter && counter.expires > this.now && counter.hits + budget.cost > budget.limit) {
        retry = Math.max(retry, Math.ceil((counter.expires - this.now) / 1000));
      }
    }
    for (const scope of scopes) {
      if ([...this.leases.values()].filter((items) => items.some((s) => s.key === scope.key)).length >= scope.limit) retry = 120;
    }
    for (const budget of budgets) {
      if (retry && !budget.chargeOnDeny) continue;
      const current = this.counters.get(budget.key);
      if (!current || current.expires <= this.now) {
        this.counters.set(budget.key, { hits: budget.cost, expires: this.now + budget.windowMs });
      } else current.hits += budget.cost;
    }
    if (!retry && lease) this.leases.set(lease, scopes);
    return { allowed: !retry, retryAfter: retry, remaining: retry ? 0 : 1, resetAfter: retry || 60 };
  }
  async release(id: string) { this.leases.delete(id); }
  async renew() {}
}

// Real board-creation handler, isolated persistence: 429 must prevent even
// reaching the storage call, not merely replace its successful response.
const source = ts.createSourceFile("routes.ts",
  readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
let boardHandler = "";
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === "post" && ts.isStringLiteral(node.arguments[0])
    && node.arguments[0].text === "/api/boards") boardHandler = node.arguments.at(-1)!.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(boardHandler);

async function fixture(store = new TestStore(), records: any[] = [], trusted = "192.0.2.0/24") {
  const app = express();
  configureTrustedProxy(app, trusted);
  app.use(express.json());
  // Simulated validated server sessions, never the client identity header.
  app.use((req, _res, next) => {
    const actor = /session=([^;]+)/.exec(req.headers.cookie || "")?.[1] || "actor-a";
    (req as any).session = { userId: actor };
    next();
  });
  const logs: any[] = [];
  app.use("/api", createOperationLimitMiddleware({
    store, policies: loadOperationPolicies(),
    resolveScope: async () => ({ tenantId: "tenant-a" }),
    log: (value) => logs.push(value),
  }));
  const handler = runInNewContext(ts.transpileModule(`const handler = ${boardHandler};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText + "\nhandler;", {
    storage: {
      async getBoardTemplate() { return {}; },
      async createBoard(value: any) { const row = { ...value, id: records.length + 1 }; records.push(row); return row; },
    },
    createBoardDtoSchema: { parse(value: any) { return value; } },
    toPublicBoard(value: any) { return value; },
    z: { ZodError: class extends Error {} },
  });
  app.post("/api/boards", handler);
  app.post("/api/boards/", handler);
  for (const path of ["/api/chats", "/api/templates/template/use", "/api/domain-admin/cubes", "/api/domain-admin/users"]) {
    app.post(path, (_req, res) => { records.push({ path }); res.status(201).json({ ok: true }); });
  }
  app.get("/api/chats", (_req, res) => res.json({ ok: true }));
  let finishWork: (() => void) | undefined;
  app.post("/api/boards/board/analysis-runs", (req, res) => {
    void retainOperationLease(req, new Promise<void>((resolve) => { finishWork = resolve; }));
    res.status(201).json({ queued: true });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  return {
    records, store, logs,
    async request(path: string, actor = "actor-a", method = "POST", headers: Record<string, string> = {}) {
      return fetch(`http://127.0.0.1:${port}${path}`, {
        method, headers: { cookie: `session=${actor}`, "content-type": "application/json", ...headers },
        ...(method === "POST" ? { body: JSON.stringify({ title: "Test board" }) } : {}),
      });
    },
    finishWork: () => finishWork?.(),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("11th board creation is 429, has retry information, and inserts no extra board", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 10; i++) assert.equal((await f.request("/api/boards")).status, 201);
    const denied = await f.request("/api/boards");
    assert.equal(denied.status, 429);
    assert.ok(Number(denied.headers.get("Retry-After")) > 0);
    assert.equal((await denied.json()).code, "RATE_LIMITED");
    assert.equal(f.records.length, 10);
    assert.equal(f.logs.at(-1).operation, "board.create");
    f.store.now += 60_001;
    assert.equal((await f.request("/api/boards")).status, 201);
  } finally { await f.close(); }
});

test("same actor cannot bypass by forwarding IPs, spoofing user headers or adding a trailing slash/query", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 10; i++) assert.equal((await f.request("/api/boards")).status, 201);
    for (let i = 0; i < 50; i++) {
      assert.equal((await f.request(i % 2 ? "/API/BoArDs/?extra=1" : "/api/boards/?extra=1", "actor-a", "POST", {
        "x-forwarded-for": `198.51.100.${i + 1}`, "x-user-id": `spoof-${i}`,
      })).status, 429);
    }
    assert.equal(f.records.length, 10);
    assert.equal((await f.request("/api/boards", "actor-b")).status, 201);
  } finally { await f.close(); }
});

test("two application instances share the actor budget", async () => {
  const store = new TestStore(), records: any[] = [];
  const first = await fixture(store, records), second = await fixture(store, records);
  try {
    for (let i = 0; i < 10; i++) assert.equal((await (i % 2 ? first : second).request("/api/boards")).status, 201);
    assert.equal((await first.request("/api/boards")).status, 429);
    assert.equal((await second.request("/api/boards")).status, 429);
    assert.equal(records.length, 10);
  } finally { await first.close(); await second.close(); }
});

for (const [path, count] of [["/api/chats", 20], ["/api/domain-admin/cubes", 5], ["/api/domain-admin/users", 10]] as const) {
  test(`${path} has its own creation budget`, async () => {
    const f = await fixture();
    try {
      for (let i = 0; i < count; i++) assert.equal((await f.request(path)).status, 201);
      assert.equal((await f.request(path)).status, 429);
      assert.equal(f.records.length, count);
    } finally { await f.close(); }
  });
}

test("chat templates share creation quota, while ordinary reads have a separate API allowance", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 20; i++) assert.equal((await f.request("/api/chats")).status, 201);
    assert.equal((await f.request("/api/templates/template/use")).status, 429);
    for (let i = 0; i < 25; i++) assert.equal((await f.request("/api/chats", "actor-a", "GET")).status, 200);
    assert.equal(f.records.length, 20);
  } finally { await f.close(); }
});

test("shared-store failure is 503 and creates nothing", async () => {
  const f = await fixture();
  try {
    f.store.unavailable = true;
    assert.equal((await f.request("/api/boards")).status, 503);
    assert.equal(f.records.length, 0);
  } finally { await f.close(); }
});

test("background jobs retain concurrency slots after the HTTP response", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("/api/boards/board/analysis-runs")).status, 201);
    assert.equal((await f.request("/api/boards/board/analysis-runs")).status, 201);
    assert.equal((await f.request("/api/boards/board/analysis-runs")).status, 429);
    f.finishWork();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await f.request("/api/boards/board/analysis-runs")).status, 201);
  } finally { await f.close(); }
});

test("all relevant alternative paths classified; reads, cancel and SSO are not creation operations", () => {
  for (const path of ["/api/boards/id/reports/report/follow-up", "/api/templates/id/use", "/api/kiosk/chats"]) {
    assert.equal(operationForRequest("POST", path), "chat.create");
  }
  for (const path of ["/api/domain-admin/enterprise-documents", "/api/kiosk/faq-documents", "/api/admin/companies/id/documents"]) {
    assert.equal(operationForRequest("POST", path), "upload.create");
  }
  assert.equal(operationForRequest("POST", "/api/admin/invitations/id/resend"), "user.create");
  assert.equal(operationForRequest("POST", "/api/domain-admin/cubes/id/sql-query"), "analysis.start");
  assert.equal(operationForRequest("POST", "/API/DOMAIN-ADMIN/USERS"), "user.create");
  assert.equal(operationForRequest("POST", "/api/boards/id/analysis-runs/run/cancel"), undefined);
  assert.equal(operationForRequest("GET", "/api/chats"), undefined);
  assert.equal(operationForRequest("POST", "/api/auth/sso/microsoft/prepare"), undefined);
});

test("proxy settings reject blanket trust; explicit CIDRs ignore untrusted forwarded IPs", async () => {
  const app = express();
  assert.throws(() => configureTrustedProxy(app, "0.0.0.0/0"));
  assert.throws(() => configureTrustedProxy(app, "true"));
  assert.equal(configureTrustedProxy(app), "compatibility-one-hop");
  configureTrustedProxy(app, "192.0.2.0/24");
  app.get("/", (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as any).port}/`, {
      headers: { "x-forwarded-for": "203.0.113.123" },
    });
    assert.equal((await res.json()).ip, "127.0.0.1");
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test("bad configuration cannot disable limits or change prototype fields", () => {
  assert.throws(() => loadOperationPolicies('{"board.create":{"limit":0}}'));
  assert.throws(() => loadOperationPolicies('{"__proto__":{"limit":100}}'));
  assert.throws(() => loadOperationPolicies('{"board.create":{"expensive":false}}'));
  assert.deepEqual(loadConcurrencyLimits(), { actor: 2, tenant: 20 });
  assert.deepEqual(loadConcurrencyLimits('{"actor":3}'), { actor: 3, tenant: 20 });
  assert.throws(() => loadConcurrencyLimits('{"actor":0}'));
  assert.throws(() => loadConcurrencyLimits('{"__proto__":3}'));
});

test("board hourly quota still denies the 101st after burst windows recover", async () => {
  const f = await fixture();
  try {
    for (let minute = 0; minute < 10; minute++) {
      for (let count = 0; count < 10; count++) assert.equal((await f.request("/api/boards")).status, 201);
      f.store.now += 60_001;
    }
    const denied = await f.request("/api/boards");
    assert.equal(denied.status, 429);
    assert.equal(f.records.length, 100);
    assert.ok(Number(denied.headers.get("Retry-After")) > 2900);
  } finally { await f.close(); }
});

test("tenant aggregate denies the 101st board across distinct actors, before the IP ceiling", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 100; i++) assert.equal((await f.request("/api/boards", `actor-${i % 11}`)).status, 201);
    assert.equal((await f.request("/api/boards", "fresh-actor")).status, 429);
    assert.equal(f.records.length, 100);
  } finally { await f.close(); }
});

test("actual scope resolver ignores ordinary client domainId and validates super-admin targets", async () => {
  const file = ts.createSourceFile("scope.ts",
    readFileSync(new URL("../../server/security/operationLimitScope.ts", import.meta.url), "utf8"), 99, true);
  const declaration = file.statements.find((node) => ts.isFunctionDeclaration(node)
    && node.name?.text === "operationScopeResolver")!;
  const emitted = ts.transpileModule(declaration.getText(file).replace(/^export\s+/, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText + "\noperationScopeResolver;";
  const resolveFactory = runInNewContext(emitted, {
    storage: {
      async getUser() { return { id: "actor", username: "actor@example.invalid", role: "admin" }; },
      async getDomain(id: string) { return id === "allowed-target" ? { id } : undefined; },
    },
    deny(status: number, message: string) { throw Object.assign(new Error(message), { status }); },
    decodeURIComponent,
  });
  const req = { originalUrl: "/API/DOMAIN-ADMIN/users?example=1", path: "/domain-admin/users",
    session: { userId: "actor" }, body: { domainId: "allowed-target" } };
  const ordinary = resolveFactory(async () => ({ user: { id: "actor" }, domain: { id: "real-domain" }, isSuperAdmin: false }));
  assert.equal((await ordinary(req, "user.create")).tenantId, "real-domain");
  const privileged = resolveFactory(async () => ({ user: { id: "actor" }, domain: null, isSuperAdmin: true }));
  assert.equal((await privileged(req, "user.create")).tenantId, "allowed-target");
  await assert.rejects(privileged({ ...req, body: { domainId: "invalid" } }, "user.create"), { status: 404 });
  await assert.rejects(resolveFactory(async () => null)(req, "user.create"), { status: 403 });
});

test("rejected authorization is still charged to the general budget; exhausted actors trigger no scope lookup", async () => {
  const store = new TestStore();
  let lookups = 0;
  const middleware = createOperationLimitMiddleware({
    store, policies: loadOperationPolicies(), log() {},
    async resolveScope() { lookups++; throw Object.assign(new Error("Forbidden"), { status: 403 }); },
  });
  const req = { session: { userId: "actor-forbidden" }, ip: "127.0.0.1",
    originalUrl: "/api/boards", method: "POST", socket: {} } as any;
  const response = () => ({
    code: 0, setHeader() {}, status(code: number) { this.code = code; return this; }, json() { return this; },
  });
  for (let i = 0; i < 100; i++) {
    const res = response();
    await middleware(req, res as any, () => assert.fail("Forbidden handler reached"));
    assert.equal(res.code, 403);
  }
  const denied = response();
  await middleware(req, denied as any, () => assert.fail("Denied handler reached"));
  assert.equal(denied.code, 429);
  assert.equal(lookups, 100);
});
