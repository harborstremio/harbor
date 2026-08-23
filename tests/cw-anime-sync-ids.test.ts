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
  needsAniZipEpisodeLookup,
} from "../src/lib/cw-anime-episode.ts";
import { stripFranchiseSuffix } from "../src/lib/providers/jikan.ts";
import { buildBody } from "../src/lib/simkl/scrobble-body.ts";
import { stremioIdToTraktTarget } from "../src/lib/trakt/ids.ts";

const MUSHOKU = {
  mappings: { kitsu_id: 49002, thetvdb_id: 371310, imdb_id: "tt13293588" },
  episodes: {
    "6": { tvdbId: 11872046, seasonNumber: 3, episodeNumber: 6, absoluteEpisodeNumber: 55 },
  },
};

test("a Continue Watching episode arrives without the ids the trackers need", () => {
  assert.equal(needsAniZipEpisodeLookup("kitsu:49002", { season: 1, episode: 6 }), true);
  assert.equal(needsAniZipEpisodeLookup("tt10329862", { season: 2, episode: 5 }), false);
  assert.equal(
    needsAniZipEpisodeLookup("kitsu:49002", {
      season: 1,
      episode: 6,
      name: "An Encounter",
      tvdbEpisodeId: 1,
      imdbSeason: 3,
      imdbEpisode: 6,
    }),
    false,
  );
  assert.equal(
    needsAniZipEpisodeLookup("kitsu:49002", {
      season: 1,
      episode: 6,
      tvdbEpisodeId: 1,
      imdbSeason: 3,
      imdbEpisode: 6,
    }),
    true,
    "a missing title still needs enrichment even when synchronization ids are complete",
  );
  assert.equal(needsAniZipEpisodeLookup("kitsu:49002", undefined), false);
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
