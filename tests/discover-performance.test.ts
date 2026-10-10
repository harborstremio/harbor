import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import {
  catalogModule,
  clientFixture,
  loadModule,
  measureFeatured,
  railFixture,
  readSource,
} from "../scripts/benchmark-discover.mjs";

const discover = readSource("src/views/discover.tsx");
const railSource = readSource("src/views/discover/discover-rail.tsx");

test("eligible fast banner is visible before full enrichment starts returning", async () => {
  const result = await measureFeatured(discover);
  assert.equal(result.firstContentMs, 600);
  assert.equal(result.events.find((event) => event.type === "full:start").at, 600);
});

test("failed enrichment preserves the fast banner", async () => {
  assert.equal((await measureFeatured(discover, { fullFails: true })).firstContentMs, 600);
});

test("failed fast lane still falls back to the full build", async () => {
  assert.equal((await measureFeatured(discover, { fastFails: true })).firstContentMs, 10600);
});

test("both failed sources settle readiness rather than leaving a pending gate", async () => {
  const result = await measureFeatured(discover, { fastFails: true, fullFails: true });
  assert.equal(result.ready, true);
  assert.equal(result.firstContentMs, null);
});

test("slow external history keeps the existing four-second cap, then rescores on completion", async () => {
  const result = await measureFeatured(discover, { historyMs: 6000 });
  assert.equal(result.firstContentMs, 4000);
  assert.ok(result.events.some((event) => event.type === "state" && event.at === 6000));
});

test("unmount cancels state updates and avoids starting unneeded enrichment", async () => {
  const result = await measureFeatured(discover, { cancelAt: 100 });
  assert.equal(
    result.events.some((event) => event.type === "full:start"),
    false,
  );
  assert.equal(
    result.events.some((event) => event.type === "state" && event.at > 100),
    false,
  );
  const later = await measureFeatured(discover, { cancelAt: 1000 });
  assert.equal(
    later.events.some((event) => event.type === "state" && event.at > 1000),
    false,
  );
});

test("offscreen rails do not fetch until near the scroll viewport", () => {
  const fixture = railFixture(railSource);
  assert.deepEqual(fixture.requests, []);
  assert.equal(fixture.options().rootMargin, "1000px 0px");
  fixture.intersect(true);
  assert.deepEqual(fixture.requests, ["fixture"]);
  fixture.cleanup();
});

test("parked Discover does not fetch or paginate rails", () => {
  const fixture = railFixture(railSource, false);
  fixture.intersect(true);
  assert.deepEqual(fixture.requests, []);
  const tree = fixture.render({ deduped: { fixture: [{ id: "one" }] } });
  assert.equal(tree.props.children.props.onEndReached, undefined);
  fixture.cleanup();
});

test("focus activates a row; leaving the viewport does not discard its items", () => {
  const fixture = railFixture(railSource);
  fixture.render().props.onFocusCapture();
  fixture.render();
  assert.deepEqual(fixture.requests, ["fixture"]);
  const items = [{ id: "one" }];
  fixture.render({ deduped: { fixture: items } });
  fixture.intersect(false);
  const tree = fixture.render();
  assert.equal(tree.props.children.props.items, items);
  assert.equal(tree.props.children.props.onEndReached, undefined);
  fixture.cleanup();
});

test("catalog cache expires, remains bounded and isolates mutable results", () => {
  let now = 0;
  const { createCatalogCache } = catalogModule();
  const cache = createCatalogCache(() => now);
  const data = { results: [{ name: "original" }] };
  cache.set("page", data);
  data.results[0].name = "mutated input";
  cache.get("page").results[0].name = "mutated output";
  assert.equal(cache.get("page").results[0].name, "original");
  now = 300000;
  assert.equal(cache.get("page"), undefined);
  for (let i = 0; i < 129; i++) cache.set(String(i), { id: i });
  assert.equal(cache.get("0"), undefined);
  assert.deepEqual(cache.get("128"), { id: 128 });
  cache.set("failure", null);
  assert.equal(cache.get("failure"), undefined);
});

test("cache allowlist excludes account, search and details endpoints", () => {
  const { isCatalogPath } = catalogModule();
  for (const path of ["discover/movie", "tv/top_rated", "trending/movie/week"])
    assert.equal(isCatalogPath(path), true);
  for (const path of [
    "account/1",
    "search/movie",
    "movie/12",
    "authentication/token/new",
    "movie/12/external_ids",
  ])
    assert.equal(isCatalogPath(path), false);
});

test("actual client reuses catalog pages and scopes keys to language, key, filters and page", async () => {
  const fixture = clientFixture();
  const { client } = fixture;
  const get = (key = "fixture-key", params = { page: "1", region: "US" }) =>
    client.get(key, "discover/movie", params);
  await get();
  await get("fixture-key", { region: "US", page: "1" });
  assert.equal(fixture.requests(), 1);
  client.setTmdbLanguage("ar");
  await get();
  await get("other-key");
  await get("fixture-key", { page: "2", region: "US" });
  await get("fixture-key", { page: "1", region: "SA" });
  assert.equal(fixture.requests(), 5);
});

test("simultaneous catalog callers share transport but not mutable response objects", async () => {
  const fixture = clientFixture({ latency: 1 });
  const [a, b] = await Promise.all([
    fixture.client.get("key", "discover/movie"),
    fixture.client.get("key", "discover/movie"),
  ]);
  assert.equal(fixture.requests(), 1);
  a.results[0].title = "changed";
  assert.equal(b.results[0].title, "Fixture");
  assert.equal((await fixture.client.get("key", "discover/movie")).results[0].title, "Fixture");
});

test("failed requests are not cached and a subsequent call can recover", async () => {
  let first = true;
  const fixture = clientFixture({
    fetch: () => {
      if (first) {
        first = false;
        throw new Error("fixture transport failure");
      }
      return Response.json({ results: [{ id: 1 }] });
    },
  });
  assert.equal(await fixture.client.get("key", "discover/movie"), null);
  assert.deepEqual(await fixture.client.get("key", "discover/movie"), { results: [{ id: 1 }] });
  assert.equal(fixture.requests(), 2);
});

test("fast candidates are identity-warmed and filtered again before exposure", async () => {
  let warmed = false;
  const meta = { id: "tmdb:movie:1", background: "fixture" };
  const module = loadModule(readSource("src/lib/feed/featured/index.ts"), {
    "@/lib/cinemeta": {},
    "@/lib/discover/store": { getStore: () => ({ affinity: {} }) },
    "../exclude": {
      buildExclusionSets: () => ({}),
      isExcluded: () => warmed,
      warmCandidateIds: async (key, metas) => {
        assert.deepEqual(metas, [meta]);
        warmed = true;
      },
    },
    "../preferences": {},
    "./diversify": { diversify: (items) => items },
    "./normalize": { mergeAndDedup: (items) => items },
    "./score": { passesFloor: () => true, scoreFeatured: () => 1 },
    "./sources": { fastLanes: async () => [{ meta }] },
  });
  assert.equal((await module.buildFeaturedFast("key", { region: "US" })).featured.length, 0);
  assert.equal(warmed, true);
});

function discoverCallback(name, deps) {
  const ast = ts.createSourceFile(
    "discover.tsx",
    discover,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
      callback = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback);
  const output = ts.transpile(`const callback = ${callback}`, { target: ts.ScriptTarget.ES2022 });
  return new Function(...Object.keys(deps), `${output}; return callback;`)(...Object.values(deps));
}

test("old pagination response cannot contaminate a new catalog generation", async () => {
  let resolve;
  const response = new Promise((done) => {
    resolve = done;
  });
  const epochRef = { current: 1 };
  const loading = { current: {} };
  const pages = { current: { row: 1 } };
  let writes = 0;
  const callback = discoverCallback("loadMore", {
    railLoadingRef: loading,
    railExhaustedRef: { current: {} },
    railPagesRef: pages,
    MAX_RAIL_PAGES: 10,
    MIN_PAGE_YIELD: 4,
    dailyRows: [{ id: "row", fetch: () => response }],
    epoch: 1,
    epochRef,
    startTransition: (fn) => fn(),
    setRails: () => writes++,
  });
  callback("row");
  epochRef.current = 2;
  loading.current = { row: true };
  resolve([{ id: "old" }]);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(writes, 0);
  assert.equal(pages.current.row, 1);
  assert.equal(loading.current.row, true);
});

test("rejected first page remains retryable and a later success settles it", async () => {
  const pages = { current: {} };
  const exhausted = { current: {} };
  const loading = { current: {} };
  let calls = 0;
  let writes = 0;
  const callback = discoverCallback("ensureLoaded", {
    railPagesRef: pages,
    railExhaustedRef: exhausted,
    railLoadingRef: loading,
    epoch: 1,
    epochRef: { current: 1 },
    MIN_PAGE_YIELD: 4,
    dailyRows: [
      {
        id: "row",
        fetch: async () => {
          calls++;
          if (calls === 1) throw new Error("fixture failure");
          return [{ id: "recovered" }];
        },
      },
    ],
    startTransition: (fn) => fn(),
    setRails: () => writes++,
  });
  callback("row");
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(pages.current.row, undefined);
  assert.equal(exhausted.current.row, undefined);
  callback("row");
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(calls, 2);
  assert.equal(pages.current.row, 1);
  assert.equal(writes, 1);
  callback("row");
  assert.equal(calls, 2);
});
