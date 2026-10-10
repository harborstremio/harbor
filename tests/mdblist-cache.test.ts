import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { lruGet, lruSet } from "../src/lib/cache.ts";

const minute = 60_000;
const day = 24 * 60 * minute;
const response = (value = 82) => ({ ok: true, json: async () => ({ ratings: [{ source: "simkl", value }] }) });

function fixture() {
  let now = 0;
  const requests: URL[] = [];
  let reply: (url: URL) => Promise<unknown> = async () => response();
  const mocks: Record<string, unknown> = {
    react: {},
    "@/lib/cache": { lruGet, lruSet },
    "@/lib/safe-fetch": { safeFetch: (url: string) => {
      const parsed = new URL(url);
      requests.push(parsed);
      return reply(parsed);
    } },
  };
  const compiled = ts.transpileModule(readFileSync("src/lib/providers/mdblist.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, any> = {};
  new Function("require", "exports", "Date", compiled)((id: string) => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports, { now: () => now });
  return {
    get: exports.mdblistScores as (key: string, id: string, type?: "movie" | "show") => Promise<any>,
    advance: (ms: number) => { now += ms; },
    respond: (next: typeof reply) => { reply = next; },
    requests,
  };
}

test("correcting an invalid key retries without restarting the app", async () => {
  const f = fixture();
  f.respond(async (url) => url.searchParams.get("apikey") === "test-invalid"
    ? { ok: false } : response());
  assert.equal(await f.get("test-invalid", "tt1"), null);
  assert.equal((await f.get("test-corrected", "tt1")).simkl, 8.2);
  assert.equal(f.requests.length, 3, "failed key tries modern and legacy; corrected key succeeds");
});

test("an old pending lookup cannot replace a corrected key's result", async () => {
  const f = fixture();
  let finish!: (value: unknown) => void;
  f.respond((url) => url.searchParams.get("apikey") === "test-old"
    ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(response(94)));
  const old = f.get("test-old", "tt1");
  const current = f.get("test-new", "tt1");
  assert.equal(f.requests.length, 2, "requests for different credentials must not deduplicate");
  assert.equal((await current).simkl, 9.4);
  finish(response(65));
  assert.equal((await old).simkl, 6.5);
  assert.equal((await f.get("test-new", "tt1")).simkl, 9.4);
});

for (const failure of ["http", "network", "invalid JSON", "empty ratings"] as const) {
  test(`${failure} backs off briefly, then recovers on the next lookup`, async () => {
    const f = fixture();
    f.respond(async () => {
      if (failure === "network") throw new Error("fixture offline");
      return { ok: failure !== "http", json: async () => {
        if (failure === "invalid JSON") throw new Error("fixture invalid JSON");
        return { ratings: [] };
      } };
    });
    const failed = await f.get("test-key", "tt1");
    assert.equal(failed?.simkl ?? null, null);
    const count = f.requests.length;
    f.respond(async () => response());
    f.advance(minute - 1);
    assert.equal(await f.get("test-key", "tt1"), failed);
    assert.equal(f.requests.length, count);
    f.advance(1);
    assert.equal((await f.get("test-key", "tt1")).simkl, 8.2);
    assert.equal(f.requests.length, count + 1);
  });
}

test("populated scores refresh after a day, with age measured from completion", async () => {
  const f = fixture();
  let finish!: (value: unknown) => void;
  f.respond(() => new Promise((resolve) => { finish = resolve; }));
  const first = f.get("test-key", "tt1");
  const second = f.get("test-key", "tt1");
  assert.equal(first, second);
  f.advance(minute);
  finish(response());
  const initial = await first;
  f.respond(async () => response(93));
  f.advance(day - 1);
  assert.equal(await f.get("test-key", "tt1"), initial);
  assert.equal(f.requests.length, 1);
  f.advance(1);
  assert.equal((await f.get("test-key", "tt1")).simkl, 9.3);
  assert.equal(f.requests.length, 2);
});

test("normalized keys deduplicate, while title and media type remain distinct", async () => {
  const f = fixture();
  await f.get(" test-key ", "tt1");
  await f.get("test-key", "tt1");
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].searchParams.get("apikey"), "test-key");
  await f.get("test-key", "tt2");
  await f.get("test-key", "tt1", "show");
  assert.equal(f.requests.length, 3);
  assert.equal(await f.get(" ", "tt1"), null);
  assert.equal(await f.get("test-key", "tmdb:1"), null);
  assert.equal(f.requests.length, 3);
});

test("modern and legacy parsing stay compatible", async () => {
  const f = fixture();
  f.respond(async (url) => url.hostname === "api.mdblist.com" ? { ok: false } : {
    ok: true, json: async () => ({ scoreaverage: 81, ratings: [
      { source: "letterboxd", value: 3.7 }, { source: "popcorn", value: 84 },
      { source: "simkl", value: 8.2 },
    ] }),
  });
  const scores = await f.get("test-key", "tt1");
  assert.deepEqual(scores, { score: 81, letterboxd: 3.7, trakt: null,
    metacritic: null, rtAudience: 84, simkl: 8.2 });
  assert.equal(f.requests.length, 2);
});

test("cached credentials and scores remain bounded and recently used results survive", async () => {
  const f = fixture();
  const recent = await f.get("test-key", "tt0");
  for (let i = 1; i < 256; i++) await f.get("test-key", `tt${i}`);
  assert.equal(await f.get("test-key", "tt0"), recent);
  await f.get("test-key", "tt256");
  assert.equal(await f.get("test-key", "tt0"), recent);
  const count = f.requests.length;
  await f.get("test-key", "tt1");
  assert.equal(f.requests.length, count + 1);
});
