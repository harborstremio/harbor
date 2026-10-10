import assert from "node:assert/strict";
import test from "node:test";
import { createSportsArtworkCache, artworkCacheKey } from "../src/lib/sports/hub-artwork.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";

test("featured artwork survives reload without waiting for an API or deleting the stale frame", () => {
  let saved = "",
    now = 100000;
  const pending: (() => void)[] = [];
  const storage = {
    getItem: () => saved,
    setItem: (_key: string, value: string) => {
      saved = value;
    },
  };
  const first = createSportsArtworkCache({
    storage,
    now: () => now,
    schedule: (callback) => pending.push(callback),
  });
  first.write("UFC:one:1:2", { home: "https://a.espncdn.com/one.png" }, true);
  first.write("UFC:one:1:2", { away: "https://a.espncdn.com/two.png" }, true);
  assert.equal(pending.length, 1);
  assert.equal(saved, "");
  pending[0]();
  const reload = createSportsArtworkCache({ storage, now: () => now });
  assert.deepEqual(reload.read("UFC:one:1:2")?.art, {
    home: "https://a.espncdn.com/one.png",
    away: "https://a.espncdn.com/two.png",
  });
  now += 2 * 86400000;
  assert.equal(reload.fresh(reload.read("UFC:one:1:2")), false);
  assert.ok(reload.read("UFC:one:1:2")?.art.home);
});

test("failed refresh retains earlier artwork and can retry after a minute", () => {
  let now = 100000;
  const cache = createSportsArtworkCache({ now: () => now });
  cache.write("EPL:42", { backdrop: "https://r2.thesportsdb.com/football.jpg" }, true);
  const failed = cache.write("EPL:42", { backdrop: undefined }, false);
  assert.equal(failed.art.backdrop, "https://r2.thesportsdb.com/football.jpg");
  assert.equal(cache.fresh(failed), true);
  now += 61000;
  assert.equal(cache.fresh(failed), false);
});

test("cache bounds metadata and rejects old entries or credentialed and inline images", () => {
  const cache = createSportsArtworkCache({ now: () => 100000 });
  for (let i = 0; i < 43; i++)
    cache.write(`event:${i}`, { backdrop: `https://images.example/${i}.jpg` }, true);
  assert.equal(cache.read("event:0"), undefined);
  assert.equal(cache.read("event:2"), undefined);
  assert.ok(cache.read("event:3"));
  const saved = JSON.stringify({
    version: 1,
    entries: [
      [
        "bad",
        {
          at: 100000,
          art: {
            backdrop: "https://user:password@images.example/image.jpg",
            home: "data:image/png;base64,abc",
          },
        },
      ],
      [
        "old",
        {
          at: -8 * 86400000,
          art: { backdrop: "https://images.example/old.jpg" },
        },
      ],
    ],
  });
  const restored = createSportsArtworkCache({
    now: () => 100000,
    storage: { getItem: () => saved, setItem: () => {} },
  });
  assert.equal(restored.read("bad"), undefined);
  assert.equal(restored.read("old"), undefined);
});

test("different bouts on one fight card have different portrait identities", () => {
  const game = {
    league: "UFC",
    id: "event|bout",
    context: { id: "event" },
    home: { id: "1" },
    away: { id: "2" },
  } as SportsGame;
  assert.notEqual(
    artworkCacheKey(game),
    artworkCacheKey({ ...game, home: { ...game.home, id: "3" } }),
  );
});

test("full localStorage still mirrors artwork to async storage and hydrates it before fetching", async () => {
  let saved = "";
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("Full", "QuotaExceededError");
    },
  };
  const asyncStorage = {
    getItem: async () => saved || null,
    setItem: async (_key: string, value: string) => {
      saved = value;
    },
  };
  const writer = createSportsArtworkCache({
    storage,
    asyncStorage,
    schedule: (callback) => callback(),
  });
  await writer.ready;
  writer.write("saved", { home: "https://a.espncdn.com/one.png" }, true);
  assert.ok(saved);
  const reload = createSportsArtworkCache({ storage, asyncStorage });
  assert.equal(reload.isReady(), false);
  await reload.ready;
  assert.equal(reload.isReady(), true);
  assert.equal(reload.read("saved")?.art.home, "https://a.espncdn.com/one.png");
});
