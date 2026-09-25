import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function fixture(transport: (url: string, init: RequestInit) => Promise<Response>) {
  const values = new Map<string, string>();
  const view = new EventTarget();
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return transport(url, init);
  };
  const select = (activeId: string) => {
    values.set(
      "harbor.profiles.v1",
      JSON.stringify({ activeId, profiles: [{ id: "a", isPrimary: true }, { id: "b" }] }),
    );
    view.dispatchEvent(new Event("harbor:profiles-updated"));
  };
  select("a");
  const context = vm.createContext({
    fetch,
    window: view,
    Headers,
    Response,
    AbortSignal,
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    },
  });
  const dependencies: Record<string, unknown> = {
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://fixture.invalid" },
    "@/lib/safe-fetch": { safeFetch: fetch },
  };
  function load<T>(path: string): T {
    const output = ts.transpileModule(
      readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    );
    const exports = {};
    vm.runInContext(`(function(require, exports) {${output.outputText}\n})`, context)(
      (name: string) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
      exports,
    );
    return exports as T;
  }
  // Only storage, transport and the public endpoint are controlled. Session
  // generation, refresh rotation, retry and response guards use production code.
  const auth = load<typeof import("../src/lib/theme-auth.ts")>("src/lib/theme-auth.ts");
  dependencies["@/lib/theme-auth"] = auth;
  dependencies["@/lib/account/authenticated-fetch"] = load(
    "src/lib/account/authenticated-fetch.ts",
  );
  const api = load<typeof import("../src/lib/social/client.ts")>("src/lib/social/client.ts");
  const login = (id: string) =>
    auth.applyAuthResult({
      token: `access-${id}`,
      refresh: `refresh-${id}`,
      user: { id, username: id },
    });
  login("author-a");
  return {
    auth,
    api,
    requests,
    select,
    login,
    flush: async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    },
  };
}

const renewed = () => Response.json({ token: "renewed-a", refresh: "rotated-a" });
type Api = typeof import("../src/lib/social/client.ts");
const methods: Record<string, (api: Api) => Promise<unknown>> = {
  POST: (api) => api.socialPost("/social/friends/remove", { handle: "fixture-friend" }),
  DELETE: (api) => api.socialDelete("/fixture/delete"),
  PATCH: (api) => api.socialPatch("/fixture/patch", { title: "Fixture" }),
};

for (const [name, run] of Object.entries(methods)) {
  test(`${name}: changing profile during refresh prevents an authenticated retry`, async () => {
    const refresh = deferred<Response>();
    const h = fixture(async (url) =>
      url.endsWith("/token/refresh") ? refresh.promise : new Response(null, { status: 401 }),
    );
    const request = run(h.api);
    await h.flush();
    assert.equal(h.requests.length, 2);
    h.select("b");
    h.login("author-b");
    refresh.resolve(renewed());
    await assert.rejects(request, /account changed/i);
    assert.equal(h.requests.length, 2, "the old mutation is never sent with the new account");
    assert.equal(h.auth.authToken(), "access-author-b");
  });

  test(`${name}: a valid session receives one refreshed retry and no infinite 401 loop`, async () => {
    const h = fixture(async (url) =>
      url.endsWith("/token/refresh") ? renewed() : new Response(null, { status: 401 }),
    );
    await assert.rejects(run(h.api), /sign in/i);
    const mutations = h.requests.filter((entry) => !entry.url.endsWith("/token/refresh"));
    assert.equal(mutations.length, 2);
    assert.equal(
      h.requests.length,
      3,
      "one refresh transport call occurs between the two attempts",
    );
    assert.equal(mutations[0].init.method, name);
    assert.equal(mutations[1].init.method, name);
    assert.equal(mutations[1].init.body, mutations[0].init.body);
    assert.equal(
      new Headers(mutations[0].init.headers).get("Authorization"),
      "Bearer access-author-a",
    );
    assert.equal(new Headers(mutations[1].init.headers).get("Authorization"), "Bearer renewed-a");
  });

  test(`${name}: an account switch while decoding a response cannot acknowledge the old mutation`, async () => {
    const body = deferred<{ saved: boolean }>();
    let decoding = false;
    const response = Response.json({ saved: true });
    response.json = () => {
      decoding = true;
      return body.promise;
    };
    const h = fixture(async () => response);
    const request = run(h.api);
    await h.flush();
    assert.equal(decoding, true);
    h.login("author-b");
    body.resolve({ saved: true });
    await assert.rejects(request, /account changed/i);
    assert.equal(h.requests.length, 1);
  });
}
