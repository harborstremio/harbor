// @ts-nocheck -- Node's built-in test types are intentionally outside the browser tsconfig.
import assert from "node:assert/strict";
import test from "node:test";
import { applyAniZipEpisodeMapping, formatCwEpisodeLabel } from "../src/lib/cw-episode.ts";
import { cwRowKey, dedupeCwFranchises } from "../src/lib/cw-list.ts";
import {
  lastPlayedEpisode,
  readResumeEntry,
  saveResumeBatch,
  saveResumeMs,
} from "../src/lib/resume.ts";
import { buildStreamIds } from "../src/lib/streams/stream-ids.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});

test("builds fallback episode IDs for every supported anime provider", () => {
  const episode = { season: 1, episode: 7 };

  for (const metaId of ["kitsu:10", "mal:20", "anilist:30", "anidb:40"]) {
    assert.deepEqual(buildStreamIds(metaId, episode, null), [`${metaId}:7`]);
  }
});

test("resume entries retain separate display season and episode numbers", () => {
  storage.clear();

  saveResumeMs("kitsu:10", 90_000, 1, 31, 3, 4);

  assert.deepEqual(readResumeEntry("kitsu:10", 1, 31), {
    ms: 90_000,
    t: lastPlayedEpisode("kitsu:10")?.t,
    displaySeason: 3,
    displayEpisode: 4,
  });
  assert.equal(lastPlayedEpisode("kitsu:10")?.displaySeason, 3);
  assert.equal(lastPlayedEpisode("kitsu:10")?.displayEpisode, 4);
});

test("cloud resume batches do not erase a known display season", () => {
  storage.clear();
  saveResumeMs("kitsu:10", 90_000, 1, 7, 3);

  saveResumeBatch([{ id: "kitsu:10", ms: 120_000, season: 1, episode: 7 }]);

  assert.equal(readResumeEntry("kitsu:10", 1, 7)?.displaySeason, 3);
});

test("formats Continue Watching labels from the most specific season mapping", () => {
  assert.equal(
    formatCwEpisodeLabel({
      mapped: { season: 3, episode: 4 },
      episode: { season: 1, episode: 31 },
      animeEpisode: 31,
    }),
    "S3 · E04",
  );
  assert.equal(
    formatCwEpisodeLabel({
      episode: { season: 2, episode: 7 },
      animeEpisode: 19,
    }),
    "S2E7",
  );
  assert.equal(formatCwEpisodeLabel({ animeEpisode: 19 }), "Ep 19");
});

test("fills fallback anime episode IDs from AniZip", () => {
  const episode = { season: 1, episode: 31 };

  applyAniZipEpisodeMapping(episode, {
    mappings: { kitsu_id: 10, imdb_id: "tt123" },
    episodes: {
      "31": { episodeNumber: 4, seasonNumber: 3 },
    },
  });

  assert.deepEqual(episode, {
    season: 1,
    episode: 31,
    kitsuStreamId: "kitsu:10:31",
    imdbId: "tt123",
    imdbSeason: 3,
    imdbEpisode: 4,
  });
});

test("keeps the newest Continue Watching item for a known franchise root", () => {
  const items = [{ _id: "kitsu:2" }, { _id: "kitsu:1" }, { _id: "tt123" }];
  const roots = new Map([
    ["kitsu:2", "kitsu:1"],
    ["kitsu:1", "kitsu:1"],
  ]);

  assert.deepEqual(
    dedupeCwFranchises(items, (id) => roots.get(id) ?? null),
    [{ _id: "kitsu:2" }, { _id: "tt123" }],
  );
});

test("retains items whose franchise root has not loaded", () => {
  const items = [{ _id: "kitsu:2" }, { _id: "kitsu:1" }];

  assert.deepEqual(
    dedupeCwFranchises(items, () => null),
    items,
  );
});

test("changes the Continue Watching row key when its first item changes", () => {
  assert.equal(cwRowKey([]), "home:cw");
  assert.equal(cwRowKey([{ _id: "tt123" }]), "home:cw:tt123");
  assert.equal(cwRowKey([{ _id: "tt456" }]), "home:cw:tt456");
});
