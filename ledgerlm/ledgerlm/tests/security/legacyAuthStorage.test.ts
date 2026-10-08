import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clearLegacyAuthStorage } from "../../client/src/lib/legacyAuthStorage";
import { broadcastLogout, clearAuthUser, getAuthUser, setAuthUser, subscribeToLogout } from "../../client/src/lib/auth";

function fakeStorage(entries: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    clear() { throw new Error("Broad storage clearing is forbidden"); },
  };
}

function browserHost(localStorage = fakeStorage(), sessionStorage = fakeStorage()) {
  return Object.assign(new EventTarget(), { localStorage, sessionStorage });
}

function withBrowser(host: ReturnType<typeof browserHost>, run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: host });
  try { run(); }
  finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("removes only confirmed legacy auth keys in both stores; keeps OTP/preferences/logout signals", () => {
  const preserved = {
    otp_email: "synthetic@example.invalid",
    theme: "dark",
    ledgerlm_auth_event: "logout:123",
    custom_user_preferences: "keep",
  };
  const localStorage = fakeStorage({ ...preserved, ledgerlm_user: "legacy", device_token: "obsolete" });
  const sessionStorage = fakeStorage({ ...preserved, ledgerlm_user: "legacy", device_token: "obsolete" });
  const host = { localStorage, sessionStorage };
  Object.defineProperty(host, "indexedDB", { get() { throw new Error("Do not touch active device keys"); } });
  Object.defineProperty(host, "document", { get() { throw new Error("Do not touch cookies"); } });
  clearLegacyAuthStorage(host);
  clearLegacyAuthStorage(host);
  for (const storage of [localStorage, sessionStorage]) {
    assert.equal(storage.getItem("ledgerlm_user"), null);
    assert.equal(storage.getItem("device_token"), null);
    for (const [key, value] of Object.entries(preserved)) assert.equal(storage.getItem(key), value);
    assert.equal(storage.length, Object.keys(preserved).length);
  }
});

test("blocked storage access does not throw or skip the other store", () => {
  for (const blocked of ["localStorage", "sessionStorage"] as const) {
    const host = { localStorage: fakeStorage({ ledgerlm_user: "legacy" }), sessionStorage: fakeStorage({ ledgerlm_user: "legacy" }) };
    const accessible = host[blocked === "localStorage" ? "sessionStorage" : "localStorage"];
    Object.defineProperty(host, blocked, { get() { throw new Error("Storage access denied"); } });
    assert.doesNotThrow(() => clearLegacyAuthStorage(host));
    assert.equal(accessible.getItem("ledgerlm_user"), null);
  }
});

test("a failed key removal does not stop remaining cleanup", () => {
  const localStorage = fakeStorage({ ledgerlm_user: "legacy", device_token: "obsolete" });
  const remove = localStorage.removeItem;
  localStorage.removeItem = key => {
    if (key === "ledgerlm_user") throw new Error("Removal denied");
    remove(key);
  };
  const sessionStorage = fakeStorage({ ledgerlm_user: "legacy", device_token: "obsolete" });
  assert.doesNotThrow(() => clearLegacyAuthStorage({ localStorage, sessionStorage }));
  assert.equal(localStorage.getItem("device_token"), null);
  assert.equal(sessionStorage.length, 0);
});

test("login/refresh preserves in-memory identity and notifications, without restoring forged stored roles", () => {
  const host = browserHost(fakeStorage({ ledgerlm_user: '{"role":"admin"}', device_token: "obsolete" }));
  withBrowser(host, () => {
    let notifications = 0;
    host.addEventListener("ledgerlm_auth_change", () => notifications++);
    const user = { id: "synthetic-user", username: "synthetic", displayName: "Test", role: "user" };
    setAuthUser(user);
    assert.equal(getAuthUser(), user);
    assert.equal(getAuthUser()?.role, "user");
    assert.equal(host.localStorage.getItem("ledgerlm_user"), null);
    assert.equal(host.sessionStorage.getItem("ledgerlm_user"), null);
    assert.equal(host.localStorage.length, 0);
    assert.equal(notifications, 1);
    clearAuthUser();
    assert.equal(getAuthUser(), null);
    assert.equal(notifications, 2);
  });
});

test("blocked storage cannot prevent login or logout", () => {
  const host = browserHost();
  for (const key of ["localStorage", "sessionStorage"]) {
    Object.defineProperty(host, key, { get() { throw new Error("Storage blocked"); } });
  }
  withBrowser(host, () => {
    const user = { id: "synthetic-user", username: "synthetic", displayName: "Test", role: "user" };
    assert.doesNotThrow(() => setAuthUser(user));
    assert.equal(getAuthUser(), user);
    assert.doesNotThrow(() => clearAuthUser());
    assert.equal(getAuthUser(), null);
  });
});

test("cross-tab storage logout still works; legacy-key deletions are not logout events", () => {
  const host = browserHost();
  withBrowser(host, () => {
    let logouts = 0;
    const unsubscribe = subscribeToLogout(() => logouts++);
    try {
      host.dispatchEvent(Object.assign(new Event("storage"), { key: "ledgerlm_user", newValue: null }));
      assert.equal(logouts, 0);
      host.dispatchEvent(Object.assign(new Event("storage"), { key: "ledgerlm_auth_event", newValue: "logout:123" }));
      assert.equal(logouts, 1);
    } finally { unsubscribe(); }
    host.dispatchEvent(Object.assign(new Event("storage"), { key: "ledgerlm_auth_event", newValue: "logout:456" }));
    assert.equal(logouts, 1);
  });
});

test("logout broadcast keeps its noncredential storage fallback and removes the temporary signal", () => {
  const host = browserHost();
  const writes: Array<[string, string]> = [];
  const setItem = host.localStorage.setItem;
  host.localStorage.setItem = (key, value) => { writes.push([key, value]); setItem(key, value); };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: host.localStorage });
  try {
    withBrowser(host, () => assert.doesNotThrow(() => broadcastLogout()));
    assert.equal(writes.length, 1);
    assert.equal(writes[0][0], "ledgerlm_auth_event");
    assert.match(writes[0][1], /^logout:\d+$/);
    assert.equal(host.localStorage.getItem("ledgerlm_auth_event"), null);
    assert.equal(host.localStorage.length, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("cross-tab BroadcastChannel logout remains connected after cleanup", async () => {
  const host = browserHost(fakeStorage({ ledgerlm_user: "legacy" }));
  const sender = new BroadcastChannel("ledgerlm_auth");
  let unsubscribe: () => void = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const received = new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Logout broadcast was not received")), 2000);
      withBrowser(host, () => {
        unsubscribe = subscribeToLogout(() => { clearTimeout(timer); resolve(); });
        clearLegacyAuthStorage(host);
      });
    });
    sender.postMessage({ type: "logout" });
    await received;
    assert.equal(host.localStorage.getItem("ledgerlm_user"), null);
  } finally {
    clearTimeout(timer);
    withBrowser(host, unsubscribe);
    sender.close();
  }
});

test("startup cleanup runs before the app renders, covering reloads and signed-out visits", () => {
  const source = readFileSync(new URL("../../client/src/main.tsx", import.meta.url), "utf8");
  const cleanup = source.indexOf("clearLegacyAuthStorage();");
  assert.ok(cleanup >= 0);
  assert.ok(cleanup < source.indexOf('createRoot(document'));
});
