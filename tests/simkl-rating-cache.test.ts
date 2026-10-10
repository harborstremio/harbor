// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import {
  emptyCache,
  getLocalCache,
  indexItem,
  resetForProfile,
  saveLocalCache,
  type SimklCacheItem,
} from "../src/lib/simkl/activities/store.ts";
import {
  getCachedRatingByTarget,
  updateCachedRatingByTarget,
} from "../src/lib/simkl/activities/targets.ts";
import type { SimklTarget } from "../src/lib/simkl/types.ts";

let save: (() => void) | undefined;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    setTimeout: (fn: () => void) => { save = fn; return 1; },
    clearTimeout: () => { save = undefined; },
  },
});

function seed() {
  resetForProfile();
  localStorage.clear();
  const cache = emptyCache();
  const add = (simklId: number, type: SimklCacheItem["type"], rating: number) => {
    const item: SimklCacheItem = {
      simklId, type, title: `Title ${simklId}`, year: 2020,
      status: "watching", userRating: rating, watchedAt: null,
    };
    cache.items[String(simklId)] = item;
    return item;
  };
  indexItem(cache, add(101, "show", 8), { imdb: "tt1234567", tmdb: 7 });
  indexItem(cache, add(102, "movie", 6), { imdb: "tt7654321", tmdb: 7 });
  indexItem(cache, add(103, "anime", 9), { mal: 21, kitsu: 12 });
  saveLocalCache(cache);
  return cache;
}

const targets: Array<[string, SimklTarget, number]> = [
  ["IMDb show", { kind: "show", ids: { imdb: "tt1234567" } }, 8],
  ["TMDB show", { kind: "show", ids: { tmdb: "7" } }, 8],
  ["TMDB movie with the same numeric ID", { kind: "movie", ids: { tmdb: 7 } }, 6],
  ["MAL anime from the detail picker", { kind: "show", ids: { mal: 21 } }, 9],
  ["Kitsu anime", { kind: "anime", ids: { kitsu: 12 } }, 9],
  ["show episode", { kind: "episode", show: { ids: { imdb: "tt1234567" } }, season: 1, number: 2 }, 8],
  ["anime episode", { kind: "anime-episode", anime: { ids: { mal: 21 } }, season: 1, number: 2 }, 9],
  ["direct SIMKL identity", { kind: "show", ids: { simkl: 101 } }, 8],
];

for (const [label, target, rating] of targets) {
  test(`saved rating is readable by ${label}`, () => {
    seed();
    assert.equal(getCachedRatingByTarget(target), rating);
  });
}

test("rating changes and removal survive reopening and a cache reload", () => {
  const cache = seed();
  const target: SimklTarget = { kind: "show", ids: { imdb: "tt1234567" } };
  updateCachedRatingByTarget(target, 10);
  assert.equal(getCachedRatingByTarget(target), 10);
  assert.equal(cache.items["101"].status, "watching");
  assert.equal(cache.items["102"].userRating, 6);
  save?.();
  resetForProfile();
  assert.equal(getCachedRatingByTarget(target), 10);
  updateCachedRatingByTarget(target, null);
  assert.equal(getCachedRatingByTarget(target), null);
  save?.();
  resetForProfile();
  assert.equal(getCachedRatingByTarget(target), null);
  assert.equal(getLocalCache()?.items["101"].status, "watching");
});

test("unknown IDs do not overwrite another title or invent a SIMKL identity", () => {
  const cache = seed();
  const before = JSON.stringify(cache);
  for (const target of [
    { kind: "show", ids: { imdb: "tt9999999" } },
    { kind: "movie", ids: { tmdb: 99 } },
    { kind: "show", ids: {} },
  ] satisfies SimklTarget[]) {
    assert.equal(getCachedRatingByTarget(target), null);
    updateCachedRatingByTarget(target, 2);
  }
  assert.equal(JSON.stringify(cache), before);
});

test("an explicit SIMKL ID wins over an inconsistent external ID", () => {
  seed();
  const target: SimklTarget = { kind: "movie", ids: { simkl: 102, imdb: "tt1234567" } };
  updateCachedRatingByTarget(target, 7);
  assert.equal(getCachedRatingByTarget(target), 7);
  assert.equal(getCachedRatingByTarget({ kind: "show", ids: { simkl: 101 } }), 8);
});
