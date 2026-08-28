// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  animeCoordPairs,
  findAnimeEntryNumber,
  isScopedSplitFranchiseRoot,
  partitionByExactAnimeEpisode,
  selectSiblingWindows,
} from "../src/lib/streams/anime-identity-core.ts";
import { buildStreamIds } from "../src/lib/streams/stream-ids.ts";

const ONE_PIECE = {
  mappings: { kitsu_id: 11243 },
  episodes: {
    "1": { seasonNumber: 1, episodeNumber: 1 },
    "1100": { seasonNumber: 23, episodeNumber: 13 },
    "1169": { seasonNumber: 23, episodeNumber: 14, absoluteEpisodeNumber: 1169 },
  },
};

test("long-running anime resolves provider season coordinates to the absolute episode", () => {
  const n = findAnimeEntryNumber(ONE_PIECE, [[23, 14]]);
  assert.equal(n, 1169);
});

test("entry-relative keys take precedence over absoluteEpisodeNumber", () => {
  const shifted = {
    mappings: { kitsu_id: 1 },
    episodes: {
      "7": { seasonNumber: 1, episodeNumber: 7, absoluteEpisodeNumber: 99 },
    },
  };
  assert.equal(findAnimeEntryNumber(shifted, [[1, 7]]), 7);
});

test("seasonal anime resolves its own cour-relative number", () => {
  const saoII = {
    mappings: { kitsu_id: 13307 },
    episodes: {
      "1": { seasonNumber: 2, episodeNumber: 1 },
      "24": { seasonNumber: 2, episodeNumber: 24 },
    },
  };
  assert.equal(findAnimeEntryNumber(saoII, [[2, 1]]), 1);
});

test("franchise trap: an entry that never aired the requested season yields null instead of guessing", () => {
  const drStoneS1 = {
    mappings: { kitsu_id: 41493 },
    episodes: {
      "1": { seasonNumber: 1, episodeNumber: 1 },
      "24": { seasonNumber: 1, episodeNumber: 24 },
    },
  };
  const coords = { imdbSeason: 2, imdbEpisode: 1, season: 2, episode: 1 };
  assert.equal(findAnimeEntryNumber(drStoneS1, animeCoordPairs(coords)), null);
});

test("an unknown first coordinate pair falls through to the provider pair", () => {
  const coords = { imdbSeason: 40, imdbEpisode: 12, season: 23, episode: 14 };
  assert.equal(findAnimeEntryNumber(ONE_PIECE, animeCoordPairs(coords)), 1169);
});

test("a known season with a missing episode bails instead of trying other pairs", () => {
  const hybrid = {
    mappings: { kitsu_id: 5 },
    episodes: {
      "1": { seasonNumber: 1, episodeNumber: 1 },
      "900": { seasonNumber: 23, episodeNumber: 13 },
    },
  };
  const pairs = animeCoordPairs({ imdbSeason: 1, imdbEpisode: 999, season: 23, episode: 14 });
  assert.deepEqual(pairs, [
    [1, 999],
    [23, 14],
  ]);
  assert.equal(findAnimeEntryNumber(hybrid, pairs), null);
});

test("invalid or absent coordinates produce no pairs and no resolution", () => {
  assert.deepEqual(animeCoordPairs(null), []);
  assert.deepEqual(animeCoordPairs({ season: 0, episode: 5 }), []);
  assert.deepEqual(animeCoordPairs({ season: 1, episode: 0 }), []);
  assert.equal(findAnimeEntryNumber(ONE_PIECE, []), null);
});

test("legacy stream ids are unchanged when identity cannot be resolved", () => {
  const episode = { season: 23, episode: 14 };
  const ids = buildStreamIds("tmdb:tv:37854", episode, "tt0388629");
  assert.ok(ids.includes("tmdb:tv:37854:23:14"));
  assert.ok(ids.includes("tt0388629:23:14"));
});

test("episode filter drops only confident single-episode mismatches", () => {
  const streams = [
    { label: "wrong single", episode: 1099, seasonPack: false },
    { label: "target single", episode: 1169, seasonPack: false },
    { label: "batch pack", episode: null, seasonPack: true },
    { label: "range batch keeps parsed low bound", episode: 1099, seasonPack: true },
    { label: "no episode token", episode: null, seasonPack: false },
  ];
  const { keep, drop } = partitionByExactAnimeEpisode(streams, new Set([1169]));
  assert.deepEqual(
    keep.map((s) => s.label),
    ["target single", "batch pack", "range batch keeps parsed low bound", "no episode token"],
  );
  assert.deepEqual(
    drop.map((s) => s.label),
    ["wrong single"],
  );
});

test("episode filter with no mismatches keeps everything", () => {
  const streams = [
    { episode: 1169, seasonPack: false },
    { episode: null, seasonPack: true },
  ];
  const { keep, drop } = partitionByExactAnimeEpisode(streams, new Set([1169]));
  assert.equal(keep.length, 2);
  assert.equal(drop.length, 0);
});

test("sibling selection returns distinct entries claiming the requested season", () => {
  const windows = [
    { anidbId: 2960, season: 1, offset: 0 },
    { anidbId: 16524, season: 17, offset: 0 },
    { anidbId: 16524, season: 18, offset: 0 },
    { anidbId: 16524, season: 17, offset: 0 },
  ];
  assert.deepEqual(selectSiblingWindows(windows, 17), [16524]);
});

test("sibling selection excludes the base entry and ignores absolute windows", () => {
  const windows = [
    { anidbId: 2960, season: 17, offset: 0 },
    { anidbId: 16524, season: "a" as const, offset: 0 },
    { anidbId: 16524, season: 17, offset: 0 },
  ];
  assert.deepEqual(selectSiblingWindows(windows, 17, 2960), [16524]);
});

test("sibling selection on empty or missing buckets yields nothing", () => {
  assert.deepEqual(selectSiblingWindows(undefined, 17), []);
  assert.deepEqual(selectSiblingWindows([], 1), []);
});

test("split-franchise scope allowlist admits only listed roots", () => {
  assert.equal(isScopedSplitFranchiseRoot(244), true);
  assert.equal(isScopedSplitFranchiseRoot(43078), false);
  assert.equal(isScopedSplitFranchiseRoot(null), false);
  assert.equal(isScopedSplitFranchiseRoot(undefined), false);
});
