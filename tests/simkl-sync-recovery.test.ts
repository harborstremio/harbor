import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function compile(path: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (id: string) => {
      assert.ok(id in mocks, `unexpected import ${id}`);
      return mocks[id];
    },
    module,
    module.exports,
  );
  return module.exports;
}

const revision = "2026-10-01T12:00:00Z";
const nextRevision = "2026-10-02T12:00:00Z";
const entry = (
  seasons: unknown[] = [{ number: 1, episodes: [{ number: 1, watched_at: revision }] }],
) => ({
  status: "watching",
  show: { title: "Fixture", ids: { simkl: 100, imdb: "tt100" } },
  seasons,
});

function fixture() {
  let session: object | null = {},
    cache: any = null;
  let activity: any = { all: revision },
    data: any = { shows: [entry()] };
  let fail = "",
    writes = 0;
  const requests: string[] = [];
  const store = compile("src/lib/simkl/activities/store.ts", {
    "@/lib/active-profile-id": { activeProfileId: () => "fixture" },
  });
  const api = compile("src/lib/simkl/activities/sync.ts", {
    "../session": { getSession: () => session },
    "@/lib/active-profile-id": { activeProfileId: () => "fixture" },
    "./store": {
      ...store,
      getLocalCache: () => cache,
      saveLocalCache: (c: any) => {
        writes++;
        cache = c;
      },
    },
    "../client": {
      simklRequest: async (path: string) => {
        requests.push(path);
        if (fail && path.includes(fail)) throw new Error("offline");
        if (path === "/sync/activities") return activity;
        if (path === "/sync/ratings") return {};
        return data;
      },
    },
  });
  return {
    api,
    requests,
    get cache() {
      return cache;
    },
    get writes() {
      return writes;
    },
    activity: (a: any) => {
      activity = a;
    },
    data: (d: any) => {
      data = d;
    },
    fail: (f: string) => {
      fail = f;
    },
    session: (s: object | null) => {
      session = s;
    },
  };
}

test("a failed bootstrap leaves no successful watermark and can retry", async () => {
  const h = fixture();
  h.fail("/anime/");
  await assert.rejects(h.api.syncWatchlistCache(), /offline/);
  assert.equal(h.writes, 0);
  h.fail("");
  await h.api.syncWatchlistCache();
  assert.equal(h.cache.lastSync, revision);
  assert.deepEqual(h.cache.items[100].watchedEpisodes, ["1:1"]);
});

test("a failed delta keeps both the saved revision and original episodes", async () => {
  const h = fixture();
  await h.api.syncWatchlistCache();
  const previous = h.cache;
  h.activity({ all: nextRevision });
  h.fail("date_from");
  await assert.rejects(h.api.syncWatchlistCache(), /offline/);
  assert.equal(h.cache, previous);
  assert.equal(h.cache.lastSync, revision);
  h.fail("");
  h.data({ shows: [entry([])] });
  await h.api.syncWatchlistCache();
  assert.deepEqual(h.cache.items[100].watchedEpisodes, []);
  assert.deepEqual(previous.items[100].watchedEpisodes, ["1:1"]);
  assert.equal(h.cache.lastSync, nextRevision);
  assert.ok(h.requests.some((p) => p.includes("date_from=") && p.includes("extended=full")));
});

test("a failed removal check cannot erase the library or commit a partial update", async () => {
  const h = fixture();
  await h.api.syncWatchlistCache();
  h.activity({ all: nextRevision, shows: { removed_from_list: nextRevision } });
  h.data({ shows: [entry([])] });
  h.fail("simkl_ids_only");
  await assert.rejects(h.api.syncWatchlistCache(), /offline/);
  assert.equal(h.cache.lastSync, revision);
  assert.deepEqual(h.cache.items[100].watchedEpisodes, ["1:1"]);
});

test("a response from a disconnected account cannot persist into the new session", async () => {
  const h = fixture();
  const pending = h.api.syncWatchlistCache();
  h.session({});
  await assert.rejects(pending, /session changed/);
  assert.equal(h.writes, 0);
});

test("activities are cleared on account changes and failures do not masquerade as unchanged activity", async () => {
  let reset!: () => void,
    session = {},
    response: any = { all: revision };
  const api = compile("src/lib/simkl/activities/gate.ts", {
    "../session": {
      getSession: () => session,
      subscribeSession: (fn: () => void) => {
        reset = fn;
      },
    },
    "../client": {
      simklRequest: async () => {
        if (response instanceof Error) throw response;
        return response;
      },
    },
  });
  assert.equal(await api.currentActivitiesAll(), revision);
  session = {};
  reset();
  response = new Error("offline");
  assert.equal(await api.currentActivitiesAll(), null);
  response = { all: nextRevision };
  assert.equal(await api.currentActivitiesAll(), nextRevision);
});
