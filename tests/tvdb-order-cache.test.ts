// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import type { Episode } from "../src/lib/providers/tmdb.ts";
import type { TvdbOrder } from "../src/lib/providers/tvdb-order.ts";
import {
  readOrderCache,
  readOrderCacheEntry,
  writeOrderCache,
} from "../src/lib/providers/tvdb-order-cache.ts";
import {
  TVDB_ORDER_CACHE_TTL_MS,
  TVDB_ORDER_TRANSIENT_CACHE_TTL_MS,
  tvdbOrderMemoryExpiresAt,
} from "../src/lib/providers/tvdb-order-cache-policy.ts";

const NOW = 1_700_000_000_000;

function order(...episodes: Array<{ number: number; name: string }>): TvdbOrder {
  return {
    seasons: [],
    bySeason: new Map([
      [
        34,
        episodes.map(
          ({ number, name }): Episode => ({
            id: number,
            episodeNumber: number,
            seasonNumber: 34,
            name,
            overview: "",
            stillPath: null,
            airDate: null,
            runtime: null,
            voteAverage: null,
          }),
        ),
      ],
    ]),
    absByEpId: new Map(),
    imageByAbs: new Map(),
  };
}

test("TVDB orders with generic or blank titles expire after the bounded retry window", () => {
  const originalNow = Date.now;
  let now = NOW;
  Date.now = () => now;

  try {
    const generic = order({ number: 14, name: "Episode 14" });
    const blank = order({ number: 14, name: " " });
    writeOrderCache(1001, "aired", generic);
    writeOrderCache(1002, "aired", blank);

    const persisted = readOrderCacheEntry(1001, "aired");
    assert.ok(persisted);
    assert.equal(persisted.cachedAt, NOW);
    assert.equal(
      tvdbOrderMemoryExpiresAt(persisted.order, persisted.cachedAt),
      NOW + TVDB_ORDER_TRANSIENT_CACHE_TTL_MS,
    );
    now = NOW + TVDB_ORDER_TRANSIENT_CACHE_TTL_MS - 1;
    assert.ok(readOrderCache(1001, "aired"));
    assert.ok(readOrderCache(1002, "aired"));
    now += 2;
    assert.equal(readOrderCache(1001, "aired"), null);
    assert.equal(readOrderCache(1002, "aired"), null);
  } finally {
    Date.now = originalNow;
    localStorage.clear();
  }
});

test("TVDB orders with complete titles retain the long persisted and memory cache policy", () => {
  const originalNow = Date.now;
  let now = NOW;
  Date.now = () => now;

  try {
    const complete = order(
      { number: 13, name: "The Trouble with Truffles" },
      { number: 14, name: "Bringing Jay Home" },
    );
    writeOrderCache(1003, "aired", complete);

    assert.equal(tvdbOrderMemoryExpiresAt(complete, NOW), null);
    now = NOW + TVDB_ORDER_TRANSIENT_CACHE_TTL_MS + 1;
    assert.ok(readOrderCache(1003, "aired"));
    now = NOW + TVDB_ORDER_CACHE_TTL_MS - 1;
    assert.ok(readOrderCache(1003, "aired"));
    now += 2;
    assert.equal(readOrderCache(1003, "aired"), null);
  } finally {
    Date.now = originalNow;
    localStorage.clear();
  }
});
