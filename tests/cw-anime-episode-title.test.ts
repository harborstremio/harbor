// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  applyAniZipEpisode,
  effectiveAnimeLookupId,
  needsAniZipEpisodeLookup,
} from "../src/lib/cw-anime-episode.ts";

const AN_ENCOUNTER = {
  mappings: { kitsu_id: 50350, imdb_id: "tt39304754" },
  episodes: {
    "1": {
      episodeNumber: 1,
      seasonNumber: 1,
      tvdbId: 11460127,
      title: { en: "An Encounter", ja: "出会い" },
    },
  },
};

test("Continue Watching looks up a generic title even when synchronization ids are complete", () => {
  assert.equal(
    needsAniZipEpisodeLookup("kitsu:50350", {
      season: 1,
      episode: 1,
      name: "Episode 1",
      tvdbEpisodeId: 11460127,
      imdbSeason: 1,
      imdbEpisode: 1,
    }),
    true,
  );
  assert.equal(
    needsAniZipEpisodeLookup("kitsu:50350", {
      season: 1,
      episode: 1,
      name: "An Encounter",
      tvdbEpisodeId: 11460127,
      imdbSeason: 1,
      imdbEpisode: 1,
    }),
    false,
  );
});

test("Continue Watching replaces a generic name and preserves a real one", () => {
  assert.equal(
    applyAniZipEpisode({ season: 1, episode: 1, name: "Episode 01" }, AN_ENCOUNTER).name,
    "An Encounter",
  );
  assert.equal(
    applyAniZipEpisode({ season: 1, episode: 1, name: "Pilot" }, AN_ENCOUNTER).name,
    "Pilot",
  );
});

test("IMDb Continue Watching items enrich generic titles through their stored anime id", () => {
  const lookupId = effectiveAnimeLookupId("tt39304754", "kitsu:50350");

  assert.equal(lookupId, "kitsu:50350");
  assert.equal(
    needsAniZipEpisodeLookup(lookupId ?? "tt39304754", {
      season: 1,
      episode: 1,
      name: "Episode 1",
      tvdbEpisodeId: 11460127,
      imdbSeason: 1,
      imdbEpisode: 1,
    }),
    true,
  );
  const episode = applyAniZipEpisode(
    { season: 1, episode: 1, name: "Episode 1" },
    AN_ENCOUNTER,
  );
  assert.equal(episode.name, "An Encounter");
  assert.equal(episode.kitsuStreamId, "kitsu:50350:1");
});
