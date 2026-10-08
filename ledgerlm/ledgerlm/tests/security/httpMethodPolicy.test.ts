import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import test from "node:test";
import express from "express";
import ts from "typescript";
import { createHttpMethodPolicy, rejectHttpConnect, apiNotFound } from "../../server/security/httpMethodPolicy";
import { createPythonMethodCatalog } from "../../server/security/pythonMethodCatalog";
import { discardClientIdentityHeaders } from "../../server/middleware/clientIdentity";
import { renameChatDtoSchema } from "../../shared/inputValidators";

const routesSource = readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../../server/index.ts", import.meta.url), "utf8");

function compile(source: string, scope: Record<string, unknown>) {
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return runInNewContext(js, scope);
}

// Exercise the actual CSRF guard without starting migrations or production DBs.
function actualCsrfGuard() {
  const ast = ts.createSourceFile("index.ts", indexSource, ts.ScriptTarget.Latest, true);
  let guard = "", exempt = "", compare = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "CSRF_EXEMPT_PATHS") {
      exempt = node.initializer!.getText(ast);
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "timingSafeStrEqual") compare = node.getText(ast);
    if (ts.isArrowFunction(node) && node.body.getText(ast).includes("CSRF token validation failed") &&
        node.parameters.length === 3) guard = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(guard && exempt && compare);
  return compile(`${compare}; const CSRF_EXEMPT_PATHS = ${exempt}; (${guard})`, {
    crypto, Buffer, logger: { warn() {} },
  });
}

// Execute the actual chat mutation handler, with a strictly in-memory store.
function actualChatPatch(chat: { id: string; userId: string; title: string }, onWrite: () => void) {
  const ast = ts.createSourceFile("routes.ts", routesSource, ts.ScriptTarget.Latest, true);
  let handler = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(ast) === "app" && node.expression.name.text === "patch" &&
        ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/chats/:id") {
      handler = node.arguments[node.arguments.length - 1].getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(handler);
  return compile(`(${handler})`, {
    renameChatDtoSchema,
    storage: {
      async getChat() { return chat; },
      async updateChatTitle(_id: string, title: string) { onWrite(); chat.title = title; return chat; },
    },
    toPublicChat: (value: unknown) => value,
    console: { error() {} },
  });
}

async function serve(app: express.Express, run: (base: string, server: Server) => Promise<void>) {
  const server = createServer(app);
  rejectHttpConnect(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`, server); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("per-route methods preserve collections, updates, HEAD, trailing slashes and case-sensitive routing", async () => {
  const app = express();
  app.set("case sensitive routing", true);
  app.use(createHttpMethodPolicy(app));
  app.use(express.json());
  app.get("/api/chats", (_req, res) => res.json([]));
  app.post("/api/chats", (_req, res) => res.status(201).json({ created: true }));
  app.patch("/api/chats/:id", (_req, res) => res.json({ updated: true }));
  app.put("/api/boards/:id", (_req, res) => res.json({ updated: true }));
  app.get("/api/reports/:id/export", (_req, res) => res.send("export"));
  app.use(/^\/api(?:\/|$)/i, apiNotFound);
  app.use((_req, res) => res.type("html").send("<html>SPA</html>"));
  await serve(app, async base => {
    for (const path of ["/api/chats", "/api/chats/"]) {
      const response = await fetch(base + path, { method: "OPTIONS" });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("allow"), "GET, HEAD, POST, OPTIONS");
      for (const method of ["PUT", "PATCH", "DELETE"]) {
        const rejected = await fetch(base + path, { method });
        assert.equal(rejected.status, 405);
        assert.equal(rejected.headers.get("allow"), "GET, HEAD, POST, OPTIONS");
        assert.match(rejected.headers.get("content-type")!, /application\/json/);
      }
    }
    assert.equal((await fetch(base + "/api/chats", { method: "POST" })).status, 201);
    for (const [method, path] of [["PATCH", "/api/chats/test"], ["PUT", "/api/boards/test"]]) {
      assert.equal((await fetch(base + path + "?cache=1", { method, body: "{}",
        headers: { "content-type": "application/json" } })).status, 200);
    }
    const head = await fetch(base + "/api/chats", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal((await fetch(base + "/api/Chats")).status, 404);
    assert.equal((await fetch(base + "/api/reports/test/export")).status, 200);
    assert.equal((await fetch(base + "/dashboard")).status, 200);
    assert.equal((await fetch(base + "/dashboard", { method: "PUT" })).status, 405);
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS"]) {
      const missing = await fetch(base + "/api/nonexistent", { method });
      assert.equal(missing.status, 404);
      assert.match(missing.headers.get("content-type")!, /application\/json/);
    }
  });
});

test("CORS denies unknown/opaque origins even with no allowlist; retains same-origin and explicit trusted origins", async () => {
  const app = express();
  app.use(createHttpMethodPolicy(app, { allowedOrigins: ["https://trusted.invalid"], publicUrl: "https://public.invalid/base" }));
  app.patch("/api/chats/:id", (_req, res) => res.json({ ok: true }));
  await serve(app, async base => {
    for (const origin of ["https://evil.invalid", "null", "https://trusted.invalid.evil.invalid", "https://trusted.invalid/path"]) {
      const response = await fetch(base + "/api/chats/test", { method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "PATCH" } });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    }
    for (const origin of [base, "https://trusted.invalid", "https://public.invalid"]) {
      const response = await fetch(base + "/api/chats/test", { method: "OPTIONS", headers: {
        Origin: origin, "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "content-type,x-csrf-token,x-device-proof-signature,x-user-id",
      } });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
      assert.equal(response.headers.get("access-control-allow-credentials"), "true");
      assert.equal(response.headers.get("access-control-allow-methods"), "PATCH,OPTIONS");
      assert.match(response.headers.get("access-control-allow-headers")!, /x-device-proof-signature/);
      assert.match(response.headers.get("vary")!, /Origin/i);
    }
    const badMethod = await fetch(base + "/api/chats/test", { method: "OPTIONS", headers: {
      Origin: "https://trusted.invalid", "Access-Control-Request-Method": "PUT",
    } });
    assert.equal(badMethod.status, 405);
  });
  const empty = express();
  empty.use(createHttpMethodPolicy(empty));
  empty.get("/api/chats", (_req, res) => res.json([]));
  await serve(empty, async base => {
    const response = await fetch(base + "/api/chats", { headers: { Origin: "https://evil.invalid" } });
    assert.equal(response.status, 403);
    // Forwarded Host cannot make an unapproved origin into a same-origin request.
    assert.equal((await fetch(base + "/api/chats", { headers: {
      Origin: "https://evil.invalid", "x-forwarded-host": "evil.invalid",
    } })).status, 403);
    assert.equal((await fetch(base + "/api/chats", { headers: { Origin: base } })).status, 200);
  });
  assert.throws(() => createHttpMethodPolicy(express(), { allowedOrigins: ["*"] }));
});

test("actual CSRF and ownership checks still protect PATCH; correct session/token updates still work", async () => {
  let writes = 0;
  const chat = { id: "test-chat", userId: "owner", title: "Original" };
  const app = express();
  app.use(createHttpMethodPolicy(app));
  app.use(express.json());
  app.use(discardClientIdentityHeaders);
  // Synthetic validated sessions, never real account cookies or DB writes.
  app.use((req, _res, next) => {
    if (req.headers.cookie === "fixture=owner") req.session = { userId: "owner", csrfToken: "test-proof" } as any;
    else if (req.headers.cookie === "fixture=other") req.session = { userId: "other", csrfToken: "test-proof" } as any;
    else req.session = {} as any;
    next();
  });
  app.use(actualCsrfGuard());
  app.patch("/api/chats/:id", actualChatPatch(chat, () => writes++));
  app.post("/api/auth/signin", (_req, res) => res.json({ publicAuthStillWorks: true }));
  await serve(app, async (base, server) => {
    const patch = (headers: Record<string, string>) => fetch(base + "/api/chats/test-chat", {
      method: "PATCH", headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ title: "Valid Updated Name" }),
    });
    assert.equal((await patch({})).status, 403);
    assert.equal((await patch({ cookie: "fixture=owner" })).status, 403);
    assert.equal((await patch({ cookie: "fixture=owner", "x-csrf-token": "wrong" })).status, 403);
    assert.equal((await patch({ cookie: "fixture=other", "x-csrf-token": "test-proof", "x-user-id": "owner" })).status, 403);
    assert.equal(writes, 0);
    assert.equal((await patch({ cookie: "fixture=owner", "x-csrf-token": "test-proof" })).status, 200);
    assert.equal(writes, 1);
    assert.equal(chat.title, "Valid Updated Name");
    assert.equal((await fetch(base + "/api/auth/signin", { method: "POST" })).status, 200);
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const trace = await rawRequest(address.port,
      "TRACE /api/auth/signin HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");
    assert.match(trace, /^HTTP\/1.1 405/);
    assert.match(trace, /Allow: POST, OPTIONS/);
    assert.equal(writes, 1);
  });
});

test("wildcard proxy methods come from backend definitions, not Express app.all's broad defaults", async () => {
  let reads = 0;
  const resolver = createPythonMethodCatalog("https://backend.invalid", async () => {
    reads++;
    return new Response(JSON.stringify({ paths: {
      "/api/v2/semantic-sql/query": { post: {} },
      "/api/v2/semantic-sql/cubes/{cube_id}/rules": { get: {}, post: {} },
      "/api/v2/schema-config/cubes/{cube_id}": { get: {}, put: {} },
    } }), { headers: { "content-type": "application/json" } });
  });
  const app = express();
  app.use(createHttpMethodPolicy(app, { resolveDelegatedMethods: resolver }));
  let forwards = 0;
  app.all("/api/v2/semantic-sql/*", (_req, res) => { forwards++; res.json({ forwarded: true }); });
  app.all("/api/v2/schema-config/*", (_req, res) => { forwards++; res.json({ forwarded: true }); });
  await serve(app, async base => {
    const response = await fetch(base + "/api/v2/semantic-sql/query", { method: "OPTIONS" });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("allow"), "POST, OPTIONS");
    for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await fetch(base + "/api/v2/semantic-sql/query", { method })).status, 405);
    }
    assert.equal((await fetch(base + "/api/v2/semantic-sql/query", { method: "POST" })).status, 200);
    assert.equal((await fetch(base + "/api/v2/schema-config/cubes/test", { method: "PUT" })).status, 200);
    assert.equal((await fetch(base + "/api/v2/semantic-sql/cubes/test/rules/")).status, 200);
    assert.equal((await fetch(base + "/api/v2/semantic-sql/unknown")).status, 404);
    assert.equal(forwards, 3);
    assert.equal(reads, 1);
  });
});

test("backend catalog outages are coalesced, fail closed, recover, and do not leak old definitions", async () => {
  let clock = 0, reads = 0, available = false;
  const resolver = createPythonMethodCatalog("https://backend.invalid", async () => {
    reads++;
    if (!available) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify({ paths: { "/api/v2/semantic-sql/query": { post: {} } } }));
  }, () => clock);
  await Promise.all([assert.rejects(resolver("/api/v2/semantic-sql/query")), assert.rejects(resolver("/api/v2/semantic-sql/query"))]);
  assert.equal(reads, 1);
  await assert.rejects(resolver("/api/v2/semantic-sql/query"));
  assert.equal(reads, 1);
  clock = 1001; available = true;
  assert.deepEqual(await resolver("/api/v2/semantic-sql/query"), ["POST"]);
  clock += 60_001; available = false;
  await assert.rejects(resolver("/api/v2/semantic-sql/query"));
  const app = express();
  app.use(createHttpMethodPolicy(app, { resolveDelegatedMethods: resolver }));
  app.all("/api/v2/semantic-sql/*", (_req, res) => res.json({ mustNotRun: true }));
  await serve(app, async base => {
    assert.equal((await fetch(base + "/api/v2/semantic-sql/query", { method: "POST" })).status, 503);
  });
});

function rawRequest(port: number, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => socket.write(message));
    let response = "";
    socket.on("data", chunk => response += chunk);
    socket.on("end", () => resolve(response));
    socket.on("error", reject);
    socket.setTimeout(2000, () => socket.destroy(new Error("Socket response timed out")));
  });
}

test("CONNECT is rejected at the Node socket boundary, without breaking WebSocket upgrades", async () => {
  const app = express();
  app.use(createHttpMethodPolicy(app));
  app.get("/api/chats", (_req, res) => res.json([]));
  await serve(app, async (_base, server) => {
    server.on("upgrade", (_req, socket) => socket.end("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const rejected = await rawRequest(address.port, "CONNECT example.invalid:443 HTTP/1.1\r\nHost: example.invalid:443\r\n\r\n");
    assert.match(rejected, /^HTTP\/1.1 405/);
    const upgraded = await rawRequest(address.port,
      "GET /socket HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");
    assert.match(upgraded, /^HTTP\/1.1 101/);
  });
});

test("API 404 fallback precedes both development and production SPA serving", () => {
  const fallback = indexSource.indexOf('app.use(/^\\/api(?:\\/|$)/i, apiNotFound)');
  assert.ok(fallback >= 0);
  assert.ok(fallback < indexSource.indexOf("await setupVite(app, server)"));
  assert.ok(fallback < indexSource.indexOf("serveStatic(app)"));
});

test("all existing literal route registrations retain their declared HTTP methods", async () => {
  const ast = ts.createSourceFile("routes.ts", routesSource, ts.ScriptTarget.Latest, true);
  const app = express();
  app.set("case sensitive routing", true);
  app.use(createHttpMethodPolicy(app));
  const registrations: Array<{ method: string; path: string }> = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(ast) === "app" &&
        ["get", "post", "put", "patch", "delete"].includes(node.expression.name.text) &&
        node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const method = node.expression.name.text;
      const path = node.arguments[0].text;
      (app as any)[method](path, (_req: unknown, res: express.Response) => res.status(204).end());
      registrations.push({ method, path });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(registrations.length > 200);
  await serve(app, async base => {
    for (const { method, path } of registrations) {
      const concrete = path.replace(/:([A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?[?*]?/g, "123");
      const response = await fetch(base + concrete, { method: method.toUpperCase() });
      assert.equal(response.status, 204, `${method.toUpperCase()} ${path} must remain admitted`);
    }
  });
});
