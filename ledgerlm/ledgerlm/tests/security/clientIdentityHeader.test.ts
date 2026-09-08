import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import cors from "cors";
import express from "express";
import session from "express-session";
import { discardClientIdentityHeaders } from "../../server/middleware/clientIdentity";

test("spoofed identity header cannot override the server session", async () => {
  const app = express();
  app.use(cors({
    origin: "https://client.example",
    credentials: true,
    allowedHeaders: ["Content-Type", "x-user-id"],
  }));
  app.use(discardClientIdentityHeaders);
  app.use(session({
    secret: "client-identity-test-secret",
    resave: false,
    saveUninitialized: false,
  }));

  app.get("/test-login", (req, res) => {
    req.session.userId = "standard-session-user";
    res.json({ ok: true });
  });
  app.get("/protected", (req, res) => {
    res.json({
      sessionUserId: req.session.userId,
      clientHeader: req.headers["x-user-id"] ?? null,
    });
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const login = await fetch(`${baseUrl}/test-login`);
    const cookie = login.headers.get("set-cookie");
    assert.ok(cookie);

    const response = await fetch(`${baseUrl}/protected`, {
      headers: {
        cookie: cookie.split(";")[0],
        "x-user-id": "spoofed-admin-user",
        origin: "https://client.example",
      },
    });
    const body = await response.json() as {
      sessionUserId: string;
      clientHeader: string | null;
    };

    assert.equal(response.status, 200);
    assert.equal(body.sessionUserId, "standard-session-user");
    assert.equal(body.clientHeader, null);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "https://client.example",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listSourceFiles(fullPath) : [fullPath];
  }));
  return files.flat();
}

test("production client code does not send x-user-id", async () => {
  const clientRoot = path.resolve(process.cwd(), "client/src");
  const files = (await listSourceFiles(clientRoot))
    .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /x-user-id/i, file);
  }
});