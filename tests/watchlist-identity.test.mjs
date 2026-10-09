import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Execute production functions with isolated storage and no network or React rendering.
function load(path, mocks = {}, storage = undefined) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", "localStorage", output)(
    (name) => mocks[name] ?? {},
    exports,
    storage,
  );
  return exports;
}

const tab = load("src/views/library/watchlist-tab.tsx", {
  "@/lib/trakt/to-meta": load("src/lib/trakt/to-meta.ts"),
  "@/lib/stremio": { libraryMetaType: (type) => type },
  "./shared": { parseTs: (value) => (value ? Date.parse(value) : null) },
});
const local = (id, imdbId) => ({ id, imdbId, type: "movie", name: "Aladdin", addedAt: 1 });
const cloud = (id) => ({ _id: id, type: "movie", name: "Aladdin", removed: false });
const trakt = (tmdb, imdb, year) => ({
  type: "movie",
  title: "Aladdin",
  year,
  ids: { tmdb, imdb },
});

test("same-name remakes with different years remain separate", () => {
  const result = tab.mergeWatchlist([], [], [trakt(1, "tt1", 1992), trakt(2, "tt2", 2019)]);
  assert.equal(result.length, 2);
});

test("unknown-year local and Stremio titles are not collapsed by name", () => {
  const result = tab.mergeWatchlist([local("tmdb:movie:2")], [cloud("tt1")], []);
  assert.equal(result.length, 2);
});

test("IMDb aliases combine local, Stremio and Trakt while preserving removal handles", () => {
  const result = tab.mergeWatchlist(
    [local("tmdb:movie:1", "tt1")],
    [cloud("tt1")],
    [trakt(1, "tt1", 1992)],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].stremioId, "tt1");
  assert.equal(result[0].localId, "tmdb:movie:1");
});

test("bookmarked-only filtering excludes temporary entries in both library modes", () => {
  for (const mode of ["library", "watchlist"]) {
    const items = [
      cloud("tt1"),
      { ...cloud("tt2"), temp: true },
      { ...cloud("tt3"), removed: true },
    ];
    assert.deepEqual(
      tab.filterLibrary(items, true, mode).map((item) => item._id),
      ["tt1"],
    );
  }
});

test("a late identity bridge collapses both pre-existing ID forms", () => {
  const result = tab.mergeWatchlist(
    [local("tmdb:movie:1", "tt1")],
    [cloud("tt1"), cloud("tmdb:movie:1")],
    [trakt(1, "tt1", 1992)],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].localId, "tmdb:movie:1");
});

function watchlist() {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  const api = load(
    "src/lib/watchlist.ts",
    {
      "@/lib/storage-recovery": {
        setItemWithRecovery: (key, value) => {
          data.set(key, value);
          return true;
        },
      },
      "@/lib/cinemeta": {
        persistableAddonOrigin: () => undefined,
        persistableVideos: () => undefined,
      },
      "@/lib/auth": { readActiveStremioAuthKey: () => null },
      "@/lib/trakt/ids": { stremioIdToTraktTarget: () => ({ ok: false }) },
      "@/lib/simkl/session": { isAuthenticated: () => false },
    },
    storage,
  );
  return api;
}

test("unchanged aggregate responses stop the subscriber refresh cycle", () => {
  const api = watchlist();
  let notifications = 0;
  api.subscribeWatchlist(() => {
    notifications++;
    assert.ok(notifications <= 1, "unchanged response must not recursively notify");
    api.setWatchlistAggregate(["tt2", "tt1", "tt1"]);
  });
  api.setWatchlistAggregate(["tt1", "tt2"]);
  assert.equal(notifications, 1);
});

test("removing a known film also removes its local IMDb/TMDB twin", () => {
  const api = watchlist();
  api.addToWatchlist(local("tmdb:movie:1", "tt1"));
  api.addToWatchlist(local("tt1"));
  api.setWatchlistAggregate(["tt1", "tmdb:movie:1", "tt2"]);
  assert.equal(api.toggleWatchlist({ ...local("tmdb:movie:1", "tt1") }), false);
  assert.deepEqual(api.readLocalEntries(), []);
  assert.deepEqual(api.watchlistAllIds(), ["tt2"]);
});

test("all library groupings retain virtualization and local removal wiring", () => {
  const source = read("src/views/library/watchlist-tab.tsx");
  const grids = source.match(/<GroupedGrid\b[\s\S]*?\/>/g);
  assert.equal(grids.length, 3);
  for (const grid of grids) {
    assert.match(grid, /onRemoveLocal=\{handleRemoveLocal\}/);
    assert.match(grid, /scrollRef=\{scrollRef\}/);
  }
  const shared = read("src/views/library/shared.tsx");
  assert.equal((shared.match(/\(\) => onRemoveLocal\(it.localId as string\)/g) ?? []).length, 2);
});

test("anime search fallback retains animation, full-name and exact-year guards", () => {
  const source = read("src/views/detail.tsx");
  assert.match(source, /if \(animeLike && name && name.trim\(\).length >= 2\)/);
  assert.match(source, /hits.filter\(\(h\) => norm\(h.name\) === target\)/);
  assert.match(source, /candidates.find\(\(h\) => parseInt\(h.year \?\? "", 10\) === yr\)/);
});

test("invalidated refreshes cannot publish or retain stale membership", async () => {
  const published = [];
  let finishTrakt;
  let current = true;
  const api = load("src/lib/watchlist-sync.tsx", {
    "@/lib/stremio": { library: async () => [cloud("tt1")] },
    "@/lib/trakt/watchlist": {
      fetchWatchlist: () =>
        new Promise((resolve) => {
          finishTrakt = resolve;
        }),
    },
    "@/lib/watchlist": { setWatchlistAggregate: (ids) => published.push(ids) },
  });
  const pending = api.refreshWatchlistAggregates("test-auth", true, false, () => current);
  await Promise.resolve();
  current = false;
  finishTrakt([trakt(1, "tt1", 1992)]);
  await pending;
  assert.deepEqual(published, []);
  api.setStremioAggregate(["tt2"]);
  assert.deepEqual(published, [["tt2"]]);
});

test("current refreshes combine all connected providers and exclude temporary items", async () => {
  const published = [];
  const api = load("src/lib/watchlist-sync.tsx", {
    "@/lib/stremio": { library: async () => [cloud("tt1"), { ...cloud("tt9"), temp: true }] },
    "@/lib/trakt/watchlist": { fetchWatchlist: async () => [trakt(2, "tt2", 1992)] },
    "@/lib/simkl/watchlist": { fetchWatchlist: async () => [trakt(3, "tt3", 2019)] },
    "@/lib/watchlist": { setWatchlistAggregate: (ids) => published.push(ids) },
  });
  const items = await api.refreshWatchlistAggregates("test-auth", true, true);
  assert.equal(items.length, 1);
  assert.deepEqual(published, [["tt1", "tt2", "tmdb:movie:2", "tt3", "tmdb:movie:3"]]);
});
