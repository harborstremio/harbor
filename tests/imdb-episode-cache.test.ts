// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";
import { lruSet } from "../src/lib/cache.ts";

const minute = 60_000;
const hour = 60 * minute;

function fixture() {
  let now = 0;
  let requests = 0;
  let response: () => Promise<unknown> = async () => ({ ok: true, json: async () => ({ ratings: { "3:1": 7 } }) });
  const evictors = new Map<string, (aggressive: boolean) => void>();
  const mocks: Record<string, unknown> = {
    "@/lib/cache": { lruSet },
    "@/lib/maintenance": { registerEvictable: (name: string, evict: (aggressive: boolean) => void) => evictors.set(name, evict) },
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://fixture.invalid" },
    "@/lib/safe-fetch": {},
    "@/lib/providers/csm": {},
  };
  const source = readFileSync(new URL("../src/lib/providers/harbor-imdb.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, any> = {};
  new Function("require", "exports", "fetch", "Date", compiled)((id: string) => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports, () => { requests++; return response(); }, { now: () => now });
  return {
    get: exports.harborImdbEpisodes as (id: string) => Promise<Map<string, number>>,
    cached: exports.harborImdbEpisodesCached as (id: string) => Map<string, number> | undefined,
    advance: (ms: number) => { now += ms; },
    requests: () => requests,
    respond: (next: () => Promise<unknown>) => { response = next; },
    ratings: (ratings: Record<string, unknown>) => { response = async () => ({ ok: true, json: async () => ({ ratings }) }); },
    evict: (aggressive: boolean) => evictors.get("harbor-imdb-episodes")!(aggressive),
  };
}

test("episode ratings reuse fresh data but refresh a partial season after an hour", async () => {
  const f = fixture();
  const initial = await f.get("tt1");
  f.ratings({ "3:1": 7.1, "3:5": 8.6 });
  f.advance(hour - 1);
  assert.equal(await f.get("tt1"), initial);
  assert.equal(f.requests(), 1);
  f.advance(1);
  assert.equal(f.cached("tt1"), undefined);
  const refreshed = await f.get("tt1");
  assert.equal(refreshed.get("3:1"), 7.1);
  assert.equal(refreshed.get("3:5"), 8.6);
  assert.equal(f.requests(), 2);
});

for (const kind of ["HTTP failure", "network failure", "invalid JSON", "empty success"] as const) {
  test(`${kind} backs off briefly and allows episode ratings to recover without restarting`, async () => {
    const f = fixture();
    f.respond(async () => {
      if (kind === "network failure") throw new Error("offline");
      return {
        ok: kind !== "HTTP failure",
        json: async () => {
          if (kind === "invalid JSON") throw new Error("invalid response");
          return { ratings: {} };
        },
      };
    });
    assert.equal((await f.get("tt1")).size, 0);
    f.ratings({ "1:1": 8.2 });
    f.advance(minute - 1);
    assert.equal((await f.get("tt1")).size, 0);
    assert.equal(f.requests(), 1);
    f.advance(1);
    assert.equal((await f.get("tt1")).get("1:1"), 8.2);
    assert.equal(f.requests(), 2);
  });
}

test("concurrent refreshes share one request and cache age starts at completion", async () => {
  const f = fixture();
  await f.get("tt1");
  f.advance(hour);
  let finish!: (value: unknown) => void;
  f.respond(() => new Promise((resolve) => { finish = resolve; }));
  const first = f.get("tt1");
  const second = f.get("tt1");
  assert.equal(f.requests(), 2);
  f.advance(minute);
  finish({ ok: true, json: async () => ({ ratings: { "3:2": 8 } }) });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, b);
  assert.equal(a.get("3:2"), 8);
  f.advance(hour - 1);
  assert.equal(f.cached("tt1"), a);
  f.advance(1);
  assert.equal(f.cached("tt1"), undefined);
});

test("cached getter and maintenance preserve bounded per-title ownership", async () => {
  const f = fixture();
  const first = await f.get("tt1");
  f.ratings({ "1:1": 9 });
  await f.get("tt2");
  assert.equal(f.cached("tt1"), first);
  assert.equal(f.cached("tt2")?.get("1:1"), 9);
  f.evict(false);
  assert.equal(f.cached("tt1"), first);
  for (let i = 3; i <= 201; i++) await f.get(`tt${i}`);
  assert.equal(f.cached("tt1"), undefined);
  assert.equal(f.cached("tt2")?.get("1:1"), 9);
  f.evict(true);
  assert.equal(f.cached("tt2"), undefined);
  assert.equal(f.cached("tt201"), undefined);
});

test("non-IMDb identifiers make no request and existing invalid-rating filtering remains", async () => {
  const f = fixture();
  assert.equal((await f.get("tmdb:tv:1")).size, 0);
  assert.equal(f.requests(), 0);
  f.ratings({ "1:1": "8.2", "1:2": null, "1:3": 0, "1:4": "N/A", "1:5": -1 });
  assert.deepEqual([...await f.get("tt1")], [["1:1", 8.2]]);
});
