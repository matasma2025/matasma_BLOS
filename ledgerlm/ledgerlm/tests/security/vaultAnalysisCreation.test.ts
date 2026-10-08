import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { createChatDtoSchema, generatedChatTitle } from "../../shared/inputValidators";

const vaultSource = ts.createSourceFile("Vault.tsx",
  readFileSync(new URL("../../client/src/pages/Vault.tsx", import.meta.url), "utf8"), 99, true, ts.ScriptKind.TSX);
const routesSource = ts.createSourceFile("routes.ts",
  readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8"), 99, true);

function evaluate(expression: string, context: object) {
  return runInNewContext(ts.transpileModule(`const value = ${expression}; value;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, { Error, ...context });
}

function vaultMutation(names: string[], failure?: { status: number; body: string }) {
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(vaultSource) === "createAnalysisMutation") {
      expression = node.initializer!.getText(vaultSource);
    }
    ts.forEachChild(node, visit);
  }
  visit(vaultSource);
  assert.ok(expression);
  const documents = names.map((name, index) => ({ id: `doc-${index}`, name }));
  const calls: Array<{ url: string; body: any; options: any }> = [];
  const toasts: any[] = [];
  const navigation: string[] = [];
  const mutation = evaluate(expression, {
    documents, generatedChatTitle, getAuthUser: () => ({ id: "owner" }),
    getCsrfHeaders: () => ({ "X-CSRF-Token": "test-only" }),
    useMutation: (options: unknown) => options,
    selectedDocs: new Set(documents.map(doc => doc.id)),
    toast: (value: unknown) => toasts.push(value), setSelectedDocs() {},
    queryClient: { refetchQueries() {} },
    setLocation: (value: string) => navigation.push(value),
    console,
    fetch: async (url: string, options: any) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      if (url === "/api/chats" && failure) return new Response(failure.body, { status: failure.status });
      return Response.json(url === "/api/chats" ? { id: "created-chat" } : { success: true });
    },
  });
  return { mutation, calls, toasts, navigation, documents };
}

function createChatHandler(storageFailure?: Error) {
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "post" && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === "/api/chats") expression = node.arguments.at(-1)!.getText(routesSource);
    ts.forEachChild(node, visit);
  }
  visit(routesSource);
  assert.ok(expression);
  const writes: any[] = [];
  const logs: unknown[][] = [];
  const handler = evaluate(expression, {
    createChatDtoSchema, z,
    toPublicChat: (chat: unknown) => chat,
    storage: {
      getUser: async () => ({ id: "owner" }),
      createChat: async (value: unknown) => {
        if (storageFailure) throw storageFailure;
        writes.push(value);
        return { id: "created-chat" };
      },
    },
    console: {
      error: (...args: unknown[]) => {
        assert.ok(args.every(arg => typeof arg === "string"), "Logger only receives primitive strings");
        logs.push(args);
        // Exercise the real Node logger, not a no-op hiding inspection failures.
        console.error(...args);
      },
    },
  });
  const response = () => ({
    code: 200, body: undefined as any,
    status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  });
  return { handler, writes, logs, response };
}

test("Vault generates valid single/multiple PDF titles and preserves every document link", async () => {
  for (const names of [
    ["Quarterly_Report.pdf"],
    ["Résumé (India) & Actuals.pdf", "Budget-2026.pdf"],
    ["Report [final]: 2026.pdf", "Actuals.pdf", "Forecast.pdf"],
    ["x".repeat(250) + ".pdf"],
    ["<script>alert(1)</script>.pdf"],
  ]) {
    const { mutation, calls, documents, navigation } = vaultMutation(names);
    const result = await mutation.mutationFn(documents.map(doc => doc.id));
    assert.equal(result.id, "created-chat");
    assert.equal(createChatDtoSchema.safeParse(calls[0].body).success, true);
    assert.ok(calls[0].body.title.length <= 200);
    assert.ok(!calls[0].body.title.includes(":"));
    assert.equal(calls[0].body.preview, `Analysis session with ${names.length} document${names.length > 1 ? "s" : ""}`);
    assert.deepEqual(calls.slice(1).map(call => call.body.documentId), documents.map(doc => doc.id));
    assert.ok(calls.every(call => call.options.credentials === "include"));
    assert.ok(calls.every(call => call.options.headers["X-CSRF-Token"] === "test-only"));
    assert.deepEqual(documents.map(doc => doc.name), names, "Uploaded names are not altered");
    mutation.onSuccess(result);
    assert.deepEqual(navigation, ["/chat/created-chat"]);
    if (names.length === 1 && names[0] === "Quarterly_Report.pdf") {
      assert.equal(calls[0].body.title, "Analysis - Quarterly_Report.pdf");
    }
    if (names.length === 3) assert.ok(calls[0].body.title.endsWith("and 1 more"));
  }
});

test("Vault shows the server's validation/authorization message and does not link on create failure", async () => {
  for (const status of [400, 401]) {
    const message = status === 400 ? "Name contains unsupported characters." : "Session expired - please sign in again";
    const { mutation, calls, toasts } = vaultMutation(["Report.pdf"], {
      status, body: JSON.stringify({ error: message }),
    });
    await assert.rejects(mutation.mutationFn(["doc-0"]), (error: Error) => {
      mutation.onError(error);
      return error.message === message;
    });
    assert.equal(toasts[0].description, message);
    assert.equal(calls.length, 1);
  }
  const { mutation } = vaultMutation(["Report.pdf"], { status: 502, body: "Bad gateway" });
  await assert.rejects(mutation.mutationFn(["doc-0"]), /Failed to create chat/);
});

test("Invalid chat input returns 400 without logging a raw ZodError, and the next valid request succeeds", async () => {
  const { handler, response, writes, logs } = createChatHandler();
  const invalid = response();
  await handler({ session: { userId: "owner" }, body: { title: "Analysis: Report.pdf" } }, invalid);
  assert.equal(invalid.code, 400);
  assert.match(invalid.body.error, /unsupported characters/);
  assert.equal(writes.length, 0);
  assert.equal(logs.length, 0);
  const valid = response();
  await handler({ session: { userId: "owner" }, body: {
    title: "Analysis - Report.pdf", preview: "Analysis session with 1 document", templateMessage: "Ignored legacy field",
  } }, valid);
  assert.equal(valid.code, 201);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].userId, "owner");
  assert.equal(writes[0].templateMessage, undefined);
  const unauthorized = response();
  await handler({ session: {}, body: { title: "Valid" } }, unauthorized);
  assert.equal(unauthorized.code, 401);
  assert.equal(writes.length, 1);
});

test("Unexpected storage validation and foreign-key errors are logged without stopping the handler", async () => {
  const validation = createChatDtoSchema.safeParse({ title: "Analysis: Report.pdf" });
  assert.equal(validation.success, false);
  if (validation.success) return;
  for (const error of [validation.error, new Error("foreign key constraint violation")]) {
    const { handler, response, logs } = createChatHandler(error);
    const res = response();
    await handler({ session: { userId: "owner" }, body: { title: "Valid Analysis" } }, res);
    assert.equal(res.code, error instanceof z.ZodError ? 400 : 401);
    assert.equal(logs.length, 1);
  }
});
