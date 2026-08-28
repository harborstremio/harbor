// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  animeSearchCoordsFromMapping,
  classifyAnimeNumbering,
} from "../src/lib/subtitles/anime-numbering.ts";

const ONE_PIECE_LIKE = {
  mappings: { kitsu_id: 21, thetvdb_id: 74796, imdb_id: "tt0388629" },
  episodes: {
    "1": { seasonNumber: 1, episodeNumber: 1, absoluteEpisodeNumber: 1 },
    "500": { seasonNumber: 12, episodeNumber: 42, absoluteEpisodeNumber: 500 },
    "1100": { seasonNumber: 21, episodeNumber: 3, absoluteEpisodeNumber: 1100 },
  },
};

const REZERO_LIKE = {
  episodes: {
    "1": { seasonNumber: 2, episodeNumber: 1 },
    "5": { seasonNumber: 2, episodeNumber: 5 },
    "13": { seasonNumber: 2, episodeNumber: 13 },
  },
};

const SPLIT_COUR_LIKE = {
  episodes: {
    "1": { seasonNumber: 2, episodeNumber: 14 },
    "12": { seasonNumber: 2, episodeNumber: 25 },
  },
};

const SPECIALS_ONLY = {
  episodes: {
    "1": { seasonNumber: 0, episodeNumber: 1 },
  },
};

test("entries spanning multiple seasons are long-running", () => {
  assert.equal(classifyAnimeNumbering(ONE_PIECE_LIKE), "longRunning");
});

test("single-season entries are seasonal", () => {
  assert.equal(classifyAnimeNumbering(REZERO_LIKE), "seasonal");
  assert.equal(classifyAnimeNumbering(SPLIT_COUR_LIKE), "seasonal");
});

test("specials-only or empty entries have no classification", () => {
  assert.equal(classifyAnimeNumbering(SPECIALS_ONLY), null);
  assert.equal(classifyAnimeNumbering({}), null);
  assert.equal(classifyAnimeNumbering(null), null);
});

test("One Piece is searched by absolute episode number without a season", () => {
  const out = animeSearchCoordsFromMapping(ONE_PIECE_LIKE, {
    season: 1,
    episode: 1100,
    imdbSeason: 23,
    imdbEpisode: 14,
  });
  assert.equal(out?.mode, "longRunning");
  assert.equal(out?.season, undefined);
  assert.equal(out?.episode, 1100);
});

test("long-running falls back to the record's absolute number", () => {
  const out = animeSearchCoordsFromMapping(ONE_PIECE_LIKE, { absoluteNumber: 1100 });
  assert.equal(out?.mode, "longRunning");
  assert.equal(out?.episode, 1100);
});

test("Re:Zero is searched by season and within-season episode", () => {
  const out = animeSearchCoordsFromMapping(REZERO_LIKE, { season: 1, episode: 5 });
  assert.equal(out?.mode, "seasonal");
  assert.equal(out?.season, 2);
  assert.equal(out?.episode, 5);
});

test("split cours search by the provider's continuous numbering", () => {
  const out = animeSearchCoordsFromMapping(SPLIT_COUR_LIKE, {
    season: 1,
    episode: 1,
    imdbEpisode: 14,
  });
  assert.equal(out?.mode, "seasonal");
  assert.equal(out?.season, 2);
  assert.equal(out?.episode, 14);
});

test("seasonal falls back to IMDb coordinates when the record is missing", () => {
  const out = animeSearchCoordsFromMapping(REZERO_LIKE, {
    season: 1,
    episode: 99,
    imdbSeason: 2,
    imdbEpisode: 9,
  });
  assert.equal(out?.mode, "seasonal");
  assert.equal(out?.season, 2);
  assert.equal(out?.episode, 9);
});

test("unresolvable coordinates return null so callers keep their fallback", () => {
  assert.equal(animeSearchCoordsFromMapping(REZERO_LIKE, { episode: 99 }), null);
  assert.equal(animeSearchCoordsFromMapping(null, { episode: 5 }), null);
});
