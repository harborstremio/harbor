import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const HOUR = 3_600_000;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const fixtureSession = (id = "a", extra = {}) => ({
  token: `access-${id}`,
  refresh: `refresh-${id}`,
  user: { id, username: id },
  ...extra,
});
const rotated = (id = "a") => Response.json({ token: `renewed-${id}`, refresh: `rotated-${id}` });

function fixture(options = {}) {
  const storage = new Map([
    [
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "p1", profiles: [{ id: "p1", isPrimary: true }, { id: "p2" }] }),
    ],
    ["harbor.theme-session.repaired.v2", "1"],
    ["harbor.theme-session.p1", JSON.stringify(fixtureSession("a", options.session))],
    ["harbor.theme-session.p2", JSON.stringify(fixtureSession("b"))],
  ]);
  let now = 100 * HOUR;
  const timers = new Map();
  let nextTimer = 0;
  const requests = [];
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = "visible";
  const navigator = { onLine: true };
  const transport = async (url, init) => {
    requests.push({ url, init });
    return options.fetch ? options.fetch(url, init) : rotated();
  };
  const timeout = (fn, ms) => {
    const id = ++nextTimer;
    timers.set(id, { fn, due: now + ms });
    return id;
  };
  const context = vm.createContext({
    fetch: transport,
    Headers,
    Response,
    Error,
    JSON,
    Promise,
    Map,
    Set,
    window,
    document,
    navigator,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    AbortSignal: {
      timeout(ms) {
        const controller = new AbortController();
        timeout(() => controller.abort(new Error("timeout")), ms);
        return controller.signal;
      },
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    setTimeout: timeout,
    clearTimeout: (id) => timers.delete(id),
  });
  const modules = {
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://example.invalid" },
    "@/lib/safe-fetch": { safeFetch: transport },
  };
  function load(path) {
    const source = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    vm.runInContext(`(function(require, exports) {${source}\n})`, context)((id) => {
      assert.ok(id in modules, `Unexpected import ${id}`);
      return modules[id];
    }, exports);
    return exports;
  }
  const auth = load("src/lib/theme-auth.ts");
  modules["@/lib/theme-auth"] = auth;
  const authenticated = load("src/lib/account/authenticated-fetch.ts");
  modules["./authenticated-fetch"] = authenticated;
  modules["@/lib/account/authenticated-fetch"] = authenticated;
  const client = load("src/lib/account/client.ts");
  modules["./client"] = client;
  const identity = load("src/lib/account/identity.ts");
  const social = load("src/lib/social/client.ts");
  const runner = load("src/lib/account/session-refresh-runner.ts");
  const flush = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  };
  return {
    auth,
    social,
    client,
    identity,
    requests,
    storage,
    runner,
    navigator,
    window,
    document,
    flush,
    authenticated: authenticated.authenticatedFetch,
    stored: (profile = "p1") =>
      JSON.parse(storage.get(`harbor.theme-session.${profile}`) ?? "null"),
    advance: async (ms) => {
      now += ms;
      // Snapshot: callbacks may schedule new timers that belong to the next tick.
      const dueTimers = Array.from(timers);
      for (const [id, timer] of dueTimers) {
        if (timer.due <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
      await flush();
    },
    switchProfile: (activeId) => {
      const profiles = JSON.parse(storage.get("harbor.profiles.v1"));
      storage.set("harbor.profiles.v1", JSON.stringify({ ...profiles, activeId }));
      window.dispatchEvent(new Event("harbor:active-profile-changed"));
    },
    reload: () => load("src/lib/theme-auth.ts"),
  };
}

test("concurrent refresh callers and identity wrapper share one rotation", async () => {
  const d = deferred();
  const h = fixture({ fetch: () => d.promise });
  const calls = [h.auth.refreshToken(), h.auth.refreshToken(), h.identity.refreshSession()];
  assert.equal(h.requests.length, 1);
  d.resolve(rotated());
  assert.deepEqual(await Promise.all(calls), [true, true, undefined]);
  assert.equal(h.auth.authToken(), "renewed-a");
  assert.equal(h.stored().refresh, "rotated-a");
});

test("rotation survives restart without refreshing again immediately", async () => {
  const h = fixture();
  assert.equal(await h.auth.refreshToken(), true);
  const restarted = h.reload();
  assert.equal(restarted.authToken(), "renewed-a");
  assert.equal(restarted.sessionRefreshDelay(), 6 * HOUR);
});

test("profile switch keeps rotation in its original profile, never the new one", async () => {
  const d = deferred();
  const h = fixture({ fetch: () => d.promise });
  const request = h.auth.refreshToken();
  h.switchProfile("p2");
  d.resolve(rotated());
  assert.equal(await request, false);
  assert.equal(h.auth.authToken(), "access-b");
  assert.equal(h.stored("p1").token, "renewed-a");
  assert.equal(h.stored("p2").token, "access-b");
  h.switchProfile("p1");
  assert.equal(h.auth.authToken(), "renewed-a");
});

test("switch away and back does not make an old request scope current again", async () => {
  const d = deferred();
  const h = fixture({ fetch: () => d.promise });
  const request = h.auth.refreshToken();
  h.switchProfile("p2");
  h.switchProfile("p1");
  d.resolve(rotated());
  assert.equal(await request, false);
  assert.equal(h.auth.authToken(), "renewed-a");
});

test("each profile can refresh independently while another is pending", async () => {
  const a = deferred();
  const b = deferred();
  const h = fixture({
    fetch: (_url, init) => (JSON.parse(init.body).refresh === "refresh-a" ? a.promise : b.promise),
  });
  const first = h.auth.refreshToken();
  h.switchProfile("p2");
  const second = h.auth.refreshToken();
  a.resolve(rotated("a"));
  assert.equal(await first, false);
  const third = h.auth.refreshToken();
  assert.equal(h.requests.length, 2);
  b.resolve(rotated("b"));
  assert.deepEqual(await Promise.all([second, third]), [true, true]);
});

test("logout clears locally immediately and revokes a late rotated token without restoring it", async () => {
  const refresh = deferred();
  const logout = deferred();
  const h = fixture({
    fetch: (url) => (url.endsWith("/token/refresh") ? refresh.promise : logout.promise),
  });
  const pending = h.auth.refreshToken();
  const signingOut = h.auth.logoutAuthor();
  assert.equal(h.auth.currentAuthor(), null);
  assert.equal(h.stored(), null);
  refresh.resolve(rotated());
  await h.flush();
  assert.equal(h.requests.length, 3);
  assert.equal(h.requests[2].init.headers.Authorization, "Bearer renewed-a");
  logout.resolve(Response.json({}));
  assert.equal(await pending, false);
  await signingOut;
  assert.equal(h.reload().authToken(), null);
});

test("late rotation and logout cannot overwrite a newly signed-in account", async () => {
  const d = deferred();
  const h = fixture({ fetch: () => d.promise });
  const pending = h.auth.refreshToken();
  const logout = h.auth.logoutAuthor();
  h.auth.applyAuthResult(fixtureSession("c"));
  d.resolve(rotated());
  await Promise.all([pending, logout]);
  assert.equal(h.auth.authToken(), "access-c");
  assert.equal(h.stored().refresh, "refresh-c");
});

test("login without a refresh token never inherits another account's credential", () => {
  const h = fixture();
  h.auth.applyAuthResult({ token: "new", user: { id: "c", username: "c" } });
  assert.equal(h.auth.refreshTokenValue(), null);
});

for (const status of [401, 403, 429, 500, 503]) {
  test(`HTTP ${status} without explicit revocation preserves session with bounded backoff`, async () => {
    const h = fixture({ fetch: async () => Response.json({ error: "temporary" }, { status }) });
    assert.equal(await h.auth.refreshToken(), false);
    assert.equal(h.auth.authToken(), "access-a");
    assert.equal(h.auth.sessionRefreshDelay(), 30_000);
    for (let i = 0; i < 10; i++) await h.auth.refreshToken();
    assert.equal(h.requests.length, 1);
    await h.advance(30_000);
    await h.auth.refreshToken();
    assert.equal(h.auth.sessionRefreshDelay(), 60_000);
  });
}

test("explicit invalid refresh ends only its unchanged session", async () => {
  const h = fixture({
    fetch: async () => Response.json({ error: "refresh_invalid" }, { status: 401 }),
  });
  assert.equal(await h.auth.refreshToken(), false);
  assert.equal(h.auth.authToken(), null);
  assert.equal(h.stored(), null);
  assert.equal(h.auth.sessionRefreshDelay(), null);
  assert.equal(await h.auth.refreshToken(), false);
  assert.equal(h.requests.length, 1);
});

test("offline failure recovers after backoff without losing credentials", async () => {
  let offline = true;
  const h = fixture({
    fetch: async () => {
      if (offline) throw new Error("offline");
      return rotated();
    },
  });
  await h.auth.refreshToken();
  assert.equal(h.auth.authToken(), "access-a");
  offline = false;
  await h.advance(30_000);
  assert.equal(await h.auth.refreshToken(), true);
});

test("hung refresh is bounded by timeout and releases single-flight", async () => {
  const h = fixture({
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      }),
  });
  const pending = h.auth.refreshToken();
  await h.advance(15_000);
  assert.equal(await pending, false);
  assert.equal(h.auth.authToken(), "access-a");
  await h.advance(30_000);
  const next = h.auth.refreshToken();
  assert.equal(h.requests.length, 2);
  await h.advance(15_000);
  assert.equal(await next, false);
});

test("malformed successful response cannot replace saved credentials", async () => {
  const h = fixture({ fetch: async () => Response.json({ token: "partial" }) });
  assert.equal(await h.auth.refreshToken(), false);
  assert.equal(h.auth.authToken(), "access-a");
  assert.equal(h.stored().refresh, "refresh-a");
});

test("401 retries once with renewed token and preserves mutation body", async () => {
  const h = fixture({
    fetch: async (url, init) => {
      if (url.endsWith("/token/refresh")) return rotated();
      return new Headers(init.headers).get("authorization") === "Bearer access-a"
        ? new Response(null, { status: 401 })
        : Response.json({ saved: true });
    },
  });
  assert.equal(
    (await h.client.postJson("/save", { name: "Example" }, { bearer: true })).saved,
    true,
  );
  assert.equal(h.requests.length, 3);
  assert.equal(h.requests[0].init.body, h.requests[2].init.body);
});

test("delayed 401 uses already rotated token instead of rotating twice", async () => {
  const d = deferred();
  const h = fixture({
    fetch: async (url) => (url.endsWith("/token/refresh") ? rotated() : d.promise),
  });
  const request = h.authenticated("https://example.invalid/data");
  await h.auth.refreshToken();
  d.resolve(new Response(null, { status: 401 }));
  assert.equal((await request).status, 401);
  assert.equal(h.requests.filter((r) => r.url.endsWith("/token/refresh")).length, 1);
  assert.equal(h.requests.length, 3);
});

test("old-account mutation is not retried after profile switches", async () => {
  const d = deferred();
  const h = fixture({ fetch: () => d.promise });
  const request = h.client.postJson("/save", { name: "Example" }, { bearer: true });
  h.switchProfile("p2");
  d.resolve(new Response(null, { status: 401 }));
  await assert.rejects(request, /Account changed/);
  assert.equal(h.requests.length, 1);
});

test("switch during refresh also blocks the mutation retry", async () => {
  const d = deferred();
  const h = fixture({
    fetch: async (url) =>
      url.endsWith("/token/refresh") ? d.promise : new Response(null, { status: 401 }),
  });
  const request = h.client.postJson("/save", {}, { bearer: true });
  await h.flush();
  h.switchProfile("p2");
  d.resolve(rotated());
  await assert.rejects(request, /Account changed/);
  assert.equal(h.requests.length, 2);
});

test("unauthenticated requests do not trigger refresh", async () => {
  const h = fixture({ fetch: async () => new Response(null, { status: 401 }) });
  await assert.rejects(h.client.postJson("/identity/api/login", {}));
  assert.equal(h.requests.length, 1);
});

test("runner refreshes overdue sessions on wake, not on every focus", async () => {
  const h = fixture();
  const stop = h.runner.startSessionRefresh();
  await h.flush();
  assert.equal(h.requests.length, 1);
  h.window.dispatchEvent(new Event("focus"));
  await h.flush();
  assert.equal(h.requests.length, 1);
  await h.advance(6 * HOUR);
  assert.equal(h.requests.length, 2);
  stop();
  await h.advance(6 * HOUR);
  h.window.dispatchEvent(new Event("focus"));
  await h.flush();
  assert.equal(h.requests.length, 2);
});

test("runner waits offline and resumes on reconnect", async () => {
  const h = fixture();
  h.navigator.onLine = false;
  const stop = h.runner.startSessionRefresh();
  await h.advance(30_000);
  assert.equal(h.requests.length, 0);
  h.navigator.onLine = true;
  h.window.dispatchEvent(new Event("online"));
  await h.flush();
  assert.equal(h.requests.length, 1);
  stop();
});

test("runner notices sign-in after mounting while signed out", async () => {
  const h = fixture();
  await h.auth.logoutAuthor();
  h.requests.length = 0;
  const stop = h.runner.startSessionRefresh();
  h.auth.applyAuthResult(fixtureSession("c"));
  await h.advance(6 * HOUR);
  assert.equal(h.requests.length, 1);
  assert.equal(JSON.parse(h.requests[0].init.body).refresh, "refresh-c");
  stop();
});

for (const method of ["socialGet", "socialPost", "socialPatch", "socialDelete"]) {
  test(`${method} uses the same safe single-retry path`, async () => {
    const h = fixture({
      fetch: async (url, init) => {
        if (url.endsWith("/token/refresh")) return rotated();
        return new Headers(init.headers).get("authorization") === "Bearer access-a"
          ? new Response(null, { status: 401 })
          : Response.json({ success: true });
      },
    });
    assert.equal((await h.social[method]("/social/example")).success, true);
    assert.equal(h.requests.length, 3);
    assert.equal(h.requests[0].init.method, h.requests[2].init.method);
  });
}

test("a late response body cannot update the new account", async () => {
  const body = deferred();
  const h = fixture({ fetch: async () => ({ status: 200, ok: true, json: () => body.promise }) });
  const request = h.client.getJson("/identity/api/me", { bearer: true });
  await h.flush();
  h.switchProfile("p2");
  body.resolve({ user: fixtureSession().user });
  await assert.rejects(request, /Account changed/);
});

test("signing out while login is pending prevents late login from restoring the session", async () => {
  const d = deferred();
  const h = fixture({
    fetch: async (url) => (url.endsWith("/login") ? d.promise : Response.json({})),
  });
  const login = h.identity.loginIdentity("fixture", "fake-password");
  await h.auth.logoutAuthor();
  d.resolve(Response.json(fixtureSession("c")));
  await assert.rejects(login, /Account changed/);
  assert.equal(h.auth.currentAuthor(), null);
});

test("aborting a waiting request does not retry it or cancel another caller's renewal", async () => {
  const d = deferred();
  const h = fixture({
    fetch: async (url) =>
      url.endsWith("/token/refresh") ? d.promise : new Response(null, { status: 401 }),
  });
  const controller = new AbortController();
  const request = h.authenticated("https://example.invalid/test", { signal: controller.signal });
  await h.flush();
  const other = h.auth.refreshToken();
  controller.abort();
  d.resolve(rotated());
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(await other, true);
  assert.equal(h.requests.length, 2);
});

test("revoked origin does not sign out the profile selected during refresh", async () => {
  const d = deferred();
  const h = fixture({ fetch: () => d.promise });
  const pending = h.auth.refreshToken();
  h.switchProfile("p2");
  d.resolve(Response.json({ error: "refresh_invalid" }, { status: 401 }));
  assert.equal(await pending, false);
  assert.equal(h.stored("p1"), null);
  assert.equal(h.auth.currentAuthor().id, "b");
});

test("retry backoff is capped and a runner notices request-initiated failures", async () => {
  let failed = false;
  const h = fixture({
    fetch: async () => {
      if (failed) throw new Error("offline");
      return rotated();
    },
  });
  const stop = h.runner.startSessionRefresh();
  await h.flush();
  failed = true;
  await h.auth.refreshToken();
  assert.equal(h.requests.length, 2);
  await h.advance(30_000);
  assert.equal(h.requests.length, 3);
  for (const delay of [60_000, 120_000, 240_000, 300_000]) await h.advance(delay);
  assert.equal(h.auth.sessionRefreshDelay(), 300_000);
  stop();
});

test("logging out twice is safe", async () => {
  const h = fixture();
  await h.auth.logoutAuthor();
  await h.auth.logoutAuthor();
  assert.equal(h.auth.currentAuthor(), null);
  assert.equal(h.requests.length, 1);
});
