// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import {
  aniZipLookupKey,
  applyAniZipEpisode,
  needsAniZipSyncIds,
} from "../src/lib/cw-anime-episode.ts";
import { stripFranchiseSuffix } from "../src/lib/providers/jikan.ts";
import { buildBody } from "../src/lib/simkl/scrobble-body.ts";
import {
  animeCoordPairs,
  findAnimeEntryNumber,
  selectSiblingWindows,
} from "../src/lib/streams/anime-identity-core.ts";
import { stremioIdToTraktTarget } from "../src/lib/trakt/ids.ts";

const MUSHOKU = {
  mappings: { kitsu_id: 49002, thetvdb_id: 371310, imdb_id: "tt13293588" },
  episodes: {
    "6": { tvdbId: 11872046, seasonNumber: 3, episodeNumber: 6, absoluteEpisodeNumber: 55 },
  },
};

test("a Continue Watching episode arrives without the ids the trackers need", () => {
  assert.equal(needsAniZipSyncIds("kitsu:49002", { season: 1, episode: 6 }), true);
  assert.equal(needsAniZipSyncIds("tt10329862", { season: 2, episode: 5 }), false);
  assert.equal(
    needsAniZipSyncIds("kitsu:49002", {
      season: 1,
      episode: 6,
      tvdbEpisodeId: 1,
      imdbSeason: 3,
      imdbEpisode: 6,
    }),
    false,
  );
  assert.equal(needsAniZipSyncIds("kitsu:49002", undefined), false);
});

test("enrichment fills every id the trackers key on", () => {
  const out = applyAniZipEpisode({ season: 1, episode: 6 }, MUSHOKU);
  assert.equal(out.tvdbEpisodeId, 11872046);
  assert.equal(out.imdbSeason, 3);
  assert.equal(out.imdbEpisode, 6);
  assert.equal(out.absoluteNumber, 55);
  assert.equal(out.imdbId, "tt13293588");
  assert.equal(out.kitsuStreamId, "kitsu:49002:6");
});

test("enrichment never overwrites ids the caller already resolved", () => {
  const out = applyAniZipEpisode(
    { season: 1, episode: 6, tvdbEpisodeId: 999, imdbSeason: 9, imdbId: "tt0000001" },
    MUSHOKU,
  );
  assert.equal(out.tvdbEpisodeId, 999);
  assert.equal(out.imdbSeason, 9);
  assert.equal(out.imdbId, "tt0000001");
});

test("a missing mapping leaves the episode untouched instead of throwing", () => {
  const ep = { season: 1, episode: 6 };
  assert.deepEqual(applyAniZipEpisode(ep, null), ep);
  assert.deepEqual(applyAniZipEpisode(ep, { mappings: {}, episodes: {} }), ep);
});

test("Trakt silently dropped the anime scrobble before enrichment and accepts it after", () => {
  const bare = { season: 1, episode: 6 };
  const before = stremioIdToTraktTarget("kitsu:49002", bare);
  assert.equal(before.ok, false);

  const after = stremioIdToTraktTarget("kitsu:49002", applyAniZipEpisode(bare, MUSHOKU));
  assert.equal(after.ok, true);
  if (!after.ok) return;
  assert.equal(after.target.season, 3, "must scrobble season 3, not the Kitsu season 1");
  assert.equal(after.target.number, 6);
  assert.deepEqual(after.target.episodeIds, { tvdb: 11872046 });
});

test("Simkl gets the imdb id as a second way to match a brand new season", () => {
  const enriched = applyAniZipEpisode({ season: 1, episode: 6 }, MUSHOKU);
  const body = buildBody("kitsu:49002", enriched, 100) as { anime: { ids: Record<string, unknown> } };
  assert.equal(body.anime.ids.kitsu, 49002);
  assert.equal(body.anime.ids.imdb, "tt13293588");
});

test("non-anime scrobbles are byte for byte what they were", () => {
  assert.deepEqual(buildBody("tt10329862", { season: 2, episode: 5 }, 100), {
    progress: 100,
    show: { ids: { imdb: "tt10329862" } },
    episode: { season: 2, number: 5 },
  });
});

test("anime lookups are only attempted for anime id schemes", () => {
  assert.deepEqual(aniZipLookupKey("kitsu:49002"), { scheme: "kitsu", id: 49002 });
  assert.deepEqual(aniZipLookupKey("mal:59193"), { scheme: "mal", id: 59193 });
  assert.equal(aniZipLookupKey("tt13293588"), null);
  assert.equal(aniZipLookupKey("tmdb:tv:94664"), null);
});

test("the season is not printed twice in the Continue Watching title", () => {
  assert.equal(
    stripFranchiseSuffix("Mushoku Tensei: Jobless Reincarnation Season 3"),
    "Mushoku Tensei: Jobless Reincarnation",
  );
  assert.equal(
    stripFranchiseSuffix("Skeleton Knight in Another World II"),
    "Skeleton Knight in Another World",
  );
  assert.equal(stripFranchiseSuffix("Silo"), "Silo");
});

test("an imdb id resolves to the same franchise root as its Kitsu id", () => {
  const src = readFileSync(new URL("../src/lib/providers/anime-franchise-root.ts", import.meta.url), "utf8");
  assert.match(src, /if \(id\.startsWith\("tt"\)\) \{/);
  assert.match(src, /parseKitsuId\(getAnimeCwId\(id\) \?\? ""\)/);
  assert.match(src, /return imdbToKitsu\(id\)\.catch\(\(\) => null\);/);
});

test("the Continue Watching card enriches before it hands the episode to the player", () => {
  const src = readFileSync(new URL("../src/components/continue-card.tsx", import.meta.url), "utf8");
  assert.match(src, /if \(needsAniZipSyncIds\(item\._id, episode\) && episode\) \{/);
  assert.doesNotMatch(
    src,
    /if \(episode && episode\.tvdbEpisodeId == null\) \{/,
    "enrichment must not be nested inside the !episode branch again",
  );
  assert.doesNotMatch(src, /imdbToKitsu/);
  assert.match(src, /const animeId = getAnimeCwId\(item\._id\);/);
});

const SEQUEL_BASE_ENTRY = {
  mappings: { kitsu_id: 43806, thetvdb_id: 400001, imdb_id: "tt13875348" },
  episodes: {
    "1": { seasonNumber: 1, episodeNumber: 1 },
    "12": { seasonNumber: 1, episodeNumber: 12 },
  },
};

const SEQUEL_SECOND_SEASON_ENTRY = {
  mappings: { kitsu_id: 49711, thetvdb_id: 400001, imdb_id: "tt13875348" },
  episodes: {
    "1": { seasonNumber: 2, episodeNumber: 1 },
    "4": { seasonNumber: 2, episodeNumber: 4 },
  },
};

test("an imdb keyed season 2 play never lands its progress on the season 1 list entry", () => {
  const pairs = animeCoordPairs({ season: 2, episode: 4 });
  assert.deepEqual(pairs, [[2, 4]]);
  assert.equal(findAnimeEntryNumber(SEQUEL_BASE_ENTRY, pairs), null);
});

test("the sibling entry that actually aired the season supplies the tracker episode number", () => {
  const windows = [
    { anidbId: 14205, season: 1, offset: 0 },
    { anidbId: 17654, season: 2, offset: 0 },
  ];
  assert.deepEqual(selectSiblingWindows(windows, 2, 14205), [17654]);
  assert.equal(
    findAnimeEntryNumber(SEQUEL_SECOND_SEASON_ENTRY, animeCoordPairs({ season: 2, episode: 4 })),
    4,
  );
});

test("an imdb keyed Continue Watching play no longer drops the AniList and MAL sync", () => {
  const src = readFileSync(
    new URL("../src/views/player/hooks/use-resume-autosave.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /animeIdentityEligible\(id, s\.episode\)/);
  assert.match(src, /resolveAnimeIdentity\(id, latestRef\.current\.resolvedImdbId, \{/);
  assert.match(src, /fireTrackers\(`kitsu:\$\{identity\.kitsuId\}`, identity\.number\)/);
  assert.doesNotMatch(
    src,
    /anilistAutoSyncRef\.current && trackId/,
    "a null anime track id must resolve through the identity chain, not silently skip",
  );
});

test("the AniList resolver still refuses to guess a media id from an imdb id", () => {
  const src = readFileSync(new URL("../src/lib/anilist/sync.ts", import.meta.url), "utf8");
  const body = /export async function resolveAnilistMediaId[\s\S]*?\r?\n\}/.exec(src)?.[0] ?? "";
  assert.ok(body.length > 0);
  assert.doesNotMatch(body, /startsWith\("tt"\)/);
  assert.doesNotMatch(body, /imdbToKitsu/);
});
