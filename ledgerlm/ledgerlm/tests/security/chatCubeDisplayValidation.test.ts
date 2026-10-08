import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { insertChatSchema } from "../../shared/schema";
import * as validators from "../../shared/inputValidators";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NameFieldFeedback } from "../../client/src/components/NameFieldFeedback";

const source = ts.createSourceFile("routes.ts",
  readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8"), 99, true);
const storageSource = ts.createSourceFile("storage.ts",
  readFileSync(new URL("../../server/storage.ts", import.meta.url), "utf8"), 99, true);
function route(method: string, endpoint: string) {
  let result = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === method && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === endpoint) result = node.arguments.at(-1)!.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(result, endpoint);
  return ts.transpileModule(`const handler = ${result};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText + "\nhandler;";
}
function persistence(name: string, context: object) {
  let text = "";
  function visit(node: ts.Node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(storageSource) === name) text = node.getText(storageSource);
    ts.forEachChild(node, visit);
  }
  visit(storageSource); assert.ok(text, name);
  return runInNewContext(ts.transpileModule(`class Fixture { ${text} }; new Fixture();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, { ...context }) as Record<string, (...args: any[]) => Promise<any>>;
}
async function request(method: string, endpoint: string, body: unknown, owner = "actor", templateName = "Valid Template") {
  const writes: any[] = [];
  const db = {
    insert() { return { values(value: any) { writes.push(value); return { async returning() { return [{ ...value, id: "created" }]; } }; } }; },
    update() { return { set(value: any) { writes.push(value); return {
      where() { return { async returning() { return [{ ...value, id: "existing" }]; } }; },
    }; } }; },
  };
  const context = {
    ...validators, db, eq() {}, insertChatSchema, z,
    chats: { id: "id" }, cubes: { id: "id" }, kioskChats: { id: "id" }, boards: { id: "id" }, boardTemplates: { id: "id" },
  };
  const storage: any = {
    async getUser() { return { id: "actor" }; },
    async getChat() { return { id: "existing", userId: owner, title: "Original" }; },
    async getCube() { return { id: "existing", domainId: "tenant", name: "Original" }; },
    async getCubeByName() { return undefined; },
    async getBoard() { return { id: "existing", userId: owner, title: "Original", settings: null }; },
    async getBoardTemplate() { return { id: "existing", name: templateName, description: "", defaultConfig: {} }; },
  };
  for (const name of ["createChat", "updateChatTitle", "createCube", "updateCube", "createBoard", "updateBoard", "createBoardTemplate", "updateBoardTemplate"]) {
    const fixture = persistence(name, context); storage[name] = fixture[name].bind(fixture);
  }
  const res = {
    code: 200, body: undefined as any,
    status(code: number) { this.code = code; return this; },
    json(value: any) { this.body = value; return this; },
  };
  const handler = runInNewContext(route(method, endpoint), {
    ...validators, storage, insertChatSchema, z,
    toPublicChat(value: any) { return value; },
    toPublicBoard(value: any) { return value; },
    boardValidationError(error: z.ZodError) { return error.issues[0]?.message || "Invalid board data"; },
    console: { log() {}, error() {} },
  });
  await handler({ body, session: { userId: "actor" },
    params: { id: "existing", cubeId: "existing" }, user: { id: "actor" },
    domain: { id: "tenant" }, isSuperAdmin: false }, res);
  return { res, writes };
}

const attacks = [
  "<script>alert(1)</script>", "<img src=x onerror=alert(1)>",
  "%3Cscript%3Ealert(1)%3C%2Fscript%3E",
  "%253Cscript%253Ealert(1)%253C%252Fscript%253E",
  "javascript:alert(1)", "Name\u0000", "Name\u202E",
  "&lt;script&gt;alert(1)&lt;/script&gt;",
  "&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;",
  "\\u003cscript\\u003ealert(1)\\u003c/script\\u003e",
  "bad% &lt;script&gt;alert(1)&lt;/script&gt;",
];
for (const [method, endpoint, field] of [
  ["post", "/api/chats", "title"], ["patch", "/api/chats/:id", "title"],
  ["post", "/api/domain-admin/cubes", "name"], ["put", "/api/domain-admin/cubes/:cubeId", "name"],
] as const) {
  test(`${method.toUpperCase()} ${endpoint} rejects unsafe display fields before storage`, async () => {
    for (const value of attacks) {
      const { res, writes } = await request(method, endpoint, { [field]: value });
      assert.equal(res.code, 400, value);
      assert.equal(writes.length, 0, "rejected payload must not write");
    }
  });
}
test("chat create and rename reject blank, oversized and unknown fields", async () => {
  for (const [method, endpoint] of [["post", "/api/chats"], ["patch", "/api/chats/:id"]] as const) {
    for (const body of [{ title: "   " }, { title: "x".repeat(201) }, { title: "Valid", userId: "spoof" }]) {
      const { res, writes } = await request(method, endpoint, body);
      assert.equal(res.code, 400); assert.equal(writes.length, 0);
    }
  }
});
test("ordinary chat/cube create and rename normalize names and keep descriptions", async () => {
  for (const [method, endpoint, field] of [
    ["post", "/api/chats", "title"], ["patch", "/api/chats/:id", "title"],
    ["post", "/api/domain-admin/cubes", "name"], ["put", "/api/domain-admin/cubes/:cubeId", "name"],
  ] as const) {
    const body = { [field]: "  P&L Actuals FY26  ", ...(field === "name" ? { description: "Revenue & margin" } : {}) };
    const { res, writes } = await request(method, endpoint, body);
    assert.ok(res.code === 200 || res.code === 201);
    assert.equal(writes.length, 1);
    assert.equal(writes[0][field], "P&L Actuals FY26");
    if (field === "name") assert.equal(writes[0].description, "Revenue & margin");
  }
});
test("renaming somebody else's chat remains forbidden and deletion is untouched", async () => {
  const { res, writes } = await request("patch", "/api/chats/:id", { title: "Valid" }, "other");
  assert.equal(res.code, 403); assert.equal(writes.length, 0);
  assert.ok(route("delete", "/api/chats/:id").includes("deleteChat"));
});

test("all chat/kiosk/cube persistence methods reject unsafe labels without a write", async () => {
  for (const name of ["createChat", "updateChatTitle", "createKioskChat", "updateKioskChatTitle", "createCube", "updateCube", "createBoard", "updateBoard", "createBoardTemplate", "updateBoardTemplate"]) {
    let writes = 0;
    const storage = persistence(name, {
      ...validators, chats: {}, kioskChats: {}, cubes: {}, boards: {}, boardTemplates: {},
      db: { insert() { writes++; assert.fail("Unsafe insert"); }, update() { writes++; assert.fail("Unsafe update"); } },
    });
    for (const attack of attacks) {
      const value = /cube|template/i.test(name) ? { name: attack } : { title: attack };
      const args = name.startsWith("update")
        ? ["id", name.endsWith("Title") ? attack : value] : [value];
      await assert.rejects(storage[name](...args));
    }
    assert.equal(writes, 0);
  }
});

test("chat previews and cube descriptions cannot store encoded markup on create/update", async () => {
  for (const attack of attacks.slice(0, 4)) {
    for (const [method, endpoint, body] of [
      ["post", "/api/chats", { title: "Valid", preview: attack }],
      ["post", "/api/domain-admin/cubes", { name: "Valid", description: attack }],
      ["put", "/api/domain-admin/cubes/:cubeId", { description: attack }],
    ] as const) {
      const { res, writes } = await request(method, endpoint, body);
      assert.equal(res.code, 400); assert.equal(writes.length, 0);
    }
  }
});

test("generated titles comply with approved rules without changing source text; previews fail safely", () => {
  const title = "📊 März FY26 — Revenue & Margin (₹ / €) 10%";
  assert.equal(validators.generatedChatTitle(title, "New Analysis", 200), "März FY26 Revenue & Margin ( / ) 10");
  assert.equal(validators.generatedChatTitle("Show\nrevenue\tfor FY26"), "Show revenue for FY26");
  assert.equal(validators.generatedChatPreview("<script>alert(1)</script>"), null);
  assert.equal(validators.generatedChatPreview("Revenue & margin"), "Revenue & margin");
  assert.equal(validators.generatedChatTitle("x".repeat(250)).length, 50);
});

test("approved naming rules reject unsupported characters and punctuation-only labels across actual APIs", async () => {
  for (const [method, endpoint, field] of [
    ["post", "/api/chats", "title"], ["patch", "/api/chats/:id", "title"],
    ["post", "/api/boards", "title"], ["put", "/api/boards/:id", "title"],
    ["post", "/api/board-templates", "name"], ["put", "/api/board-templates/:id", "name"],
    ["post", "/api/domain-admin/cubes", "name"], ["put", "/api/domain-admin/cubes/:cubeId", "name"],
  ] as const) {
    for (const name of ["Board@#$%^", "---", "  ", "Bad\nname", "Revenue 10%", "Budget $"]) {
      const body = { [field]: name, ...(endpoint.includes("board-templates") ? { slug: "test", description: "Test" } : {}) };
      const { res, writes } = await request(method, endpoint, body);
      assert.equal(res.code, 400, `${endpoint}: ${name}`);
      assert.ok(res.body.error, "rejection must explain why");
      assert.equal(writes.length, 0);
    }
  }
});

test("Board and template create/edit preserve valid financial names and template configuration", async () => {
  for (const [method, endpoint, field] of [
    ["post", "/api/boards", "title"], ["put", "/api/boards/:id", "title"],
    ["post", "/api/board-templates", "name"], ["put", "/api/board-templates/:id", "name"],
  ] as const) {
    const config = { analysisPrompts: "Compare 10% revenue with $ budget", settings: { timeout: 30 } };
    const body = { [field]: "  P&L FY26 (Actuals)  ",
      ...(endpoint.includes("board-templates") ? { slug: "test", description: "Test", defaultConfig: config } : {}) };
    const { res, writes } = await request(method, endpoint, body);
    assert.ok(res.code === 200 || res.code === 201, endpoint);
    assert.equal(writes[0][field], "P&L FY26 (Actuals)");
    if (endpoint.includes("board-templates")) assert.deepEqual(writes[0].defaultConfig, config);
  }
});

test("name fields render a visible accessible explanation and clear it for valid input", () => {
  for (const label of ["Chat name", "Board name", "Template name", "Cube name"]) {
    const invalid = renderToStaticMarkup(createElement(NameFieldFeedback, { value: "Board@#$", label, id: "feedback" }));
    assert.ok(invalid.includes('role="alert"'));
    assert.ok(invalid.includes("unsupported characters"));
    const valid = renderToStaticMarkup(createElement(NameFieldFeedback, { value: "P&L FY26 (Actuals)", label, id: "feedback" }));
    assert.ok(!valid.includes('role="alert"'));
    assert.ok(valid.includes("Use letters, numbers"));
  }
});

test("template DTOs reject spoofed/unknown fields, bad names, empty edits and oversized labels", () => {
  assert.equal(validators.createBoardTemplateDtoSchema.safeParse({ slug: "test", name: "Valid", description: "Test", userId: "spoof" }).success, false);
  assert.equal(validators.updateBoardTemplateDtoSchema.safeParse({}).success, false);
  assert.equal(validators.updateBoardTemplateDtoSchema.safeParse({ name: "x".repeat(201) }).success, false);
});

test("using an existing template with an invalid name explains the error without creating a chat", async () => {
  for (const name of ["Board@#$%^", "---", "<script>alert(1)</script>"]) {
    const { res, writes } = await request("post", "/api/templates/:id/use", {}, "actor", name);
    assert.equal(res.code, 400);
    assert.ok(res.body.error.includes("Template name is invalid"));
    assert.equal(writes.length, 0);
  }
});

test("a metadata-only Board update does not rewrite or revalidate an existing name", async () => {
  const { res, writes } = await request("put", "/api/boards/:id", { description: "Updated description" });
  assert.equal(res.code, 200);
  assert.equal(Object.hasOwn(writes[0], "title"), false);
});

test("the development Vite logger reports client errors without terminating the app", () => {
  const viteSource = ts.createSourceFile("vite.ts",
    readFileSync(new URL("../../server/vite.ts", import.meta.url), "utf8"), 99, true);
  let loggerExpression = "";
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(viteSource) === "customLogger") {
      loggerExpression = node.initializer.getText(viteSource);
    }
    ts.forEachChild(node, visit);
  }
  visit(viteSource);
  assert.ok(loggerExpression);
  let errors = 0;
  let exits = 0;
  const logger = runInNewContext(`(${loggerExpression})`, {
    viteLogger: { error() { errors++; } },
    process: { exit() { exits++; } },
  });
  logger.error("Synthetic client request error");
  assert.equal(errors, 1);
  assert.equal(exits, 0);
});

test("older Board clients can create chats without persisting their previously ignored templateMessage", async () => {
  const { res, writes } = await request("post", "/api/chats", {
    title: "Board analysis", templateMessage: "Legacy analysis prompt",
  });
  assert.equal(res.code, 201);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].title, "Board analysis");
  assert.equal(Object.hasOwn(writes[0], "templateMessage"), false);
});
