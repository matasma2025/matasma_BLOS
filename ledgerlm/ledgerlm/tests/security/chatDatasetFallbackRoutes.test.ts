import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  resolveChatDatasetFallback,
  UNSUPPORTED_DATASET_QUESTION,
} from "../../server/services/chatDatasetFallback";
import type { SemanticSQLEvidence } from "../../server/services/queryOrchestrator";
import { generatedChatTitle } from "../../shared/inputValidators";

// Execute the real route handlers with isolated dependencies: no real users,
// database writes, AI requests, or duplicated implementation of the handlers.
const routeFile = ts.createSourceFile(
  "routes.ts",
  readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);

function handlerText(endpoint: string) {
  let handler: string | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(routeFile) === "app"
      && node.expression.name.text === "post"
      && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === endpoint) {
      handler = node.arguments[1].getText(routeFile);
    }
    ts.forEachChild(node, visit);
  }
  visit(routeFile);
  assert.ok(handler, `Missing actual endpoint: ${endpoint}`);
  return ts.transpileModule(`const handler = ${handler};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText + "\nhandler;";
}

const sqlEvidence = (supported: boolean): SemanticSQLEvidence => ({
  source: "semantic_sql", sourceId: "cube-source", cubeId: "cube",
  cubeName: "Dataset", naturalLanguageQuery: "query",
  sqlQuery: supported
    ? "SELECT SUM(amount_usd) as revenue FROM cube_fact_data"
    : "SELECT COUNT(*) as row_count FROM cube_fact_data WHERE cube_id = %s LIMIT 100",
  columns: supported ? ["revenue"] : ["row_count"],
  results: supported ? [{ revenue: 100 }] : [{ row_count: 500 }],
  rowCount: 1, relevanceScore: 0.95,
});

async function executeRoute(streaming: boolean, query: string, supported = false, cancel = false, autoTitle = false) {
  const messages: any[] = [];
  const audits: any[] = [];
  let modelCalls = 0;
  const titles: string[] = [];
  const req = Object.assign(new EventEmitter(), {
    session: { userId: "user" }, params: { chatId: "chat" },
    body: { content: query, role: "user" },
  });
  const res = {
    events: [] as any[],
    payload: undefined as any,
    statusCode: 200,
    ended: false,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.payload = payload; return this; },
    setHeader() {},
    flushHeaders() {},
    flush() {},
    write(value: string) { this.events.push(JSON.parse(value.slice(6).trim())); return true; },
    end() { this.ended = true; },
  };
  const evidence = [sqlEvidence(supported)];
  const context = {
    storage: {
      db: {},
      async getChat() { return { id: "chat", userId: "user", title: autoTitle ? "New Analysis" : "Existing chat" }; },
      async getChatMessageCount() { return 1; },
      async updateChatTitle(_id: string, title: string) { titles.push(title); },
      async getUser() { return null; },
      async getMessages() { return messages; },
      async createMessage(value: any) {
        const message = { ...value, id: `message-${messages.length}`, createdAt: new Date() };
        messages.push(message);
        return message;
      },
      async createQueryAudit(value: any) { audits.push(value); },
    },
    insertMessageSchema: { parse(value: any) { return value; } },
    checkPromptSafety() { return { safe: true }; },
    async writeAuditLog() {},
    extractIp() { return "127.0.0.1"; },
    queryOrchestrator: {
      async query() {
        if (cancel) req.emit("close");
        return {
          evidence, sourcesUsed: ["cube-source"], sourcesSucceeded: ["cube-source"],
          sourcesFailed: [], latencyMs: 1,
        };
      },
    },
    evidenceBroker: {
      rankEvidence(value: any) { return value; },
      buildContext(value: any) {
        return {
          text: value.length ? "Verified context" : "",
          citations: value.map((item: any) => item.sourceId), chartBlock: "",
        };
      },
      generatePromptWithCitations() { return "Source prompt"; },
    },
    async *streamFinancialAnalysis() { modelCalls++; yield "Existing supported answer"; },
    resolveChatDatasetFallback,
    UNSUPPORTED_DATASET_QUESTION,
    generatedChatTitle,
    AbortController,
    console,
    setTimeout(callback: () => void) { callback(); },
  };
  const endpoint = `/api/chats/:chatId/messages${streaming ? "/stream" : ""}`;
  const handler = runInNewContext(handlerText(endpoint), context);
  await handler(req, res);
  return { messages, audits, modelCalls, res, titles };
}

for (const streaming of [false, true]) {
  const label = streaming ? "SSE" : "non-streaming";
  test(`${label}: unsupported fallback saves the refusal without calling the model`, async () => {
    const result = await executeRoute(streaming, "What is the Bitcoin price?");
    assert.equal(result.modelCalls, 0);
    assert.equal(result.messages.length, 2);
    assert.equal(result.messages[1].content, UNSUPPORTED_DATASET_QUESTION);
    assert.equal(result.messages[1].metadata.answerStatus, "unsupported_dataset_metric");
    assert.equal(result.audits.length, 1);
    if (streaming) {
      assert.deepEqual(result.res.events.map((event) => event.type),
        ["user_message", "stream_start", "chunk", "complete", "done"]);
      assert.equal(result.res.events[2].content, UNSUPPORTED_DATASET_QUESTION);
      assert.equal(result.res.events[3].message.id, result.messages[1].id);
      assert.equal(result.res.ended, true);
    } else {
      assert.equal(result.res.statusCode, 201);
      assert.deepEqual(Array.from(result.res.payload), result.messages);
    }
  });

  test(`${label}: legitimate record-count questions keep the existing answer path`, async () => {
    const result = await executeRoute(streaming, "How many records are there?");
    assert.equal(result.modelCalls, 1);
    assert.equal(result.messages[1].content, "Existing supported answer");
    assert.equal(result.messages[1].metadata.answerStatus, undefined);
    assert.deepEqual(Array.from(result.messages[1].metadata.citations), ["cube-source"]);
  });

  test(`${label}: supported financial answers keep citations and normal completion`, async () => {
    const result = await executeRoute(streaming, "Show revenue", true);
    assert.equal(result.modelCalls, 1);
    assert.equal(result.messages[1].content, "Existing supported answer");
    assert.equal(result.messages[1].metadata.answerStatus, undefined);
    assert.deepEqual(Array.from(result.messages[1].metadata.citations), ["cube-source"]);
    if (streaming) assert.equal(result.res.events.at(-1).type, "done");
  });
}

test("SSE: a cancelled refusal is not saved as an assistant answer", async () => {
  const result = await executeRoute(true, "What is the gold price?", false, true);
  assert.equal(result.modelCalls, 0);
  assert.equal(result.messages.length, 1);
  assert.equal(result.res.events.some((event) => event.type === "complete"), false);
});

for (const streaming of [false, true]) {
  test(`${streaming ? "SSE" : "non-streaming"}: safe automatic titles preserve ordinary questions`, async () => {
    const query = "Show revenue, cost & margin for FY26";
    const result = await executeRoute(streaming, query, true, false, true);
    assert.deepEqual(result.titles, [query]);
    assert.equal(result.messages[0].content, query);
    assert.equal(result.modelCalls, 1);
  });
  test(`${streaming ? "SSE" : "non-streaming"}: unsafe automatic titles do not change or break the message`, async () => {
    const query = "<script>alert(1)</script>";
    const result = await executeRoute(streaming, query, true, false, true);
    assert.deepEqual(result.titles, ["New Analysis"]);
    assert.equal(result.messages[0].content, query);
    assert.equal(result.messages[1].content, "Existing supported answer");
    assert.equal(result.modelCalls, 1);
  });
}
