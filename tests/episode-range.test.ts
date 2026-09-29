// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  availableDownloadEpisodes,
  endsInFinalSeason,
  episodeRange,
  remainingEpisodeIndex,
  remainingSeasonRange,
  requiresPerEpisodeDownload,
  type DownloadEpisode,
} from "../src/lib/download/episode-range.ts";

test("remaining preset stops at the current season while entire series retains all seasons", () => {
  const episodes: DownloadEpisode[] = [
    { season: 1, episode: 1, watched: true },
    { season: 1, episode: 2, watched: true },
    { season: 1, episode: 3, watched: false },
    { season: 2, episode: 1, watched: false },
    { season: 2, episode: 2, watched: false },
  ];
  const range = remainingSeasonRange(episodes, 1, { season: 1, episode: 2 });
  assert.deepEqual(episodeRange(episodes, range.start, range.end), episodes.slice(1, 3));
  assert.deepEqual(episodeRange(episodes, 0, episodes.length - 1), episodes);
  assert.deepEqual(remainingSeasonRange(episodes, 2, { season: 1, episode: 2 }), {
    start: 3,
    end: 4,
  });
});

test("an exhausted season does not spill into the next season", () => {
  const episodes: DownloadEpisode[] = [
    { season: 1, episode: 1, watched: true },
    { season: 2, episode: 1, watched: false },
  ];
  const range = remainingSeasonRange(episodes, 1);
  assert.deepEqual(episodeRange(episodes, range.start, range.end), []);
  assert.deepEqual(remainingSeasonRange([], 1), { start: 0, end: -1 });
});

test("a single season package cannot cover different canonical seasons or series identities", () => {
  assert.equal(
    requiresPerEpisodeDownload([
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]),
    false,
  );
  assert.equal(
    requiresPerEpisodeDownload([
      { season: 1, episode: 2 },
      { season: 2, episode: 1 },
    ]),
    true,
  );
  assert.equal(
    requiresPerEpisodeDownload([
      { season: 1, episode: 12, imdbSeason: 1 },
      { season: 1, episode: 13, imdbSeason: 2 },
    ]),
    true,
  );
  assert.equal(
    requiresPerEpisodeDownload([
      { season: 1, episode: 1, sourceMetaId: "kitsu:1" },
      { season: 1, episode: 2, sourceMetaId: "kitsu:2" },
    ]),
    true,
  );
});

test("remaining episodes begin at the current Resume episode even if tracking marks it watched", () => {
  const episodes: DownloadEpisode[] = [
    { season: 1, episode: 1, watched: false },
    { season: 1, episode: 2, watched: false },
    { season: 1, episode: 3, watched: false },
    { season: 1, episode: 4, watched: false },
    { season: 1, episode: 5, watched: true },
    { season: 1, episode: 6, watched: false },
    { season: 1, episode: 7, watched: false },
    { season: 2, episode: 12, watched: true },
  ];

  const start = remainingEpisodeIndex(episodes, { season: 2, episode: 12 });

  assert.equal(start, 7);
  assert.deepEqual(episodeRange(episodes, start, episodes.length - 1), [episodes[7]]);
});

test("remaining episodes fall back to the first unwatched episode across seasons", () => {
  const episodes: DownloadEpisode[] = [
    { season: 1, episode: 1, watched: false },
    { season: 1, episode: 2, watched: false },
    { season: 2, episode: 1, watched: false },
    { season: 2, episode: 2, watched: true },
    { season: 3, episode: 1, watched: false },
  ];

  const start = remainingEpisodeIndex(episodes);

  assert.equal(start, 0);
  assert.deepEqual(episodeRange(episodes, start, episodes.length - 1), episodes);
});

test("all watched episodes leave no range when no Resume target exists", () => {
  const episodes: DownloadEpisode[] = [
    { season: 1, episode: 1, watched: true },
    { season: 1, episode: 2, watched: true },
    { season: 2, episode: 1, watched: true },
  ];
  const start = remainingEpisodeIndex(episodes);

  assert.equal(start, episodes.length);
  assert.deepEqual(episodeRange(episodes, start, episodes.length - 1), []);
});

test("missing Resume target falls back to first unwatched, and aliases match canonical coordinates", () => {
  const episodes: DownloadEpisode[] = [
    { season: 1, episode: 1, watched: true },
    { season: 1, episode: 2, watched: false },
    { season: 2, episode: 1, imdbSeason: 1, imdbEpisode: 12, watched: false },
  ];

  assert.equal(remainingEpisodeIndex(episodes, { season: 9, episode: 1 }), 1);
  assert.equal(remainingEpisodeIndex(episodes, { season: 1, episode: 12 }), 2);
});

test("episode ranges use inclusive bounds and reject invalid bounds", () => {
  const episodes = ["one", "two", "three", "four"];

  assert.deepEqual(episodeRange(episodes, 1, 2), ["two", "three"]);
  assert.deepEqual(episodeRange(episodes, 2, 2), ["three"]);
  assert.deepEqual(episodeRange(episodes, 2, 1), []);
  assert.deepEqual(episodeRange(episodes, -1, 1), []);
  assert.deepEqual(episodeRange(episodes, 1, episodes.length), []);
  assert.deepEqual(episodeRange(episodes, 1.5, 2), []);
});

test("available episodes sort aired episodes, exclude specials and future episodes, and retain source identity", () => {
  const identity = {
    imdbId: "tt-season-1-episode-1",
    sourceMetaId: "source-1",
    videoId: "video-1",
  };
  const airedLater: DownloadEpisode = {
    season: 1,
    episode: 3,
    watched: false,
    airDate: "2020-01-03",
  };
  const future: DownloadEpisode = {
    season: 2,
    episode: 1,
    watched: false,
    airDate: "2999-01-01",
  };
  const airedFirst: DownloadEpisode = {
    season: 1,
    episode: 1,
    watched: false,
    airDate: "2020-01-01",
    ...identity,
  };
  const special: DownloadEpisode = { season: 0, episode: 1, watched: false, airDate: "2020-01-01" };
  const invalidEpisode: DownloadEpisode = {
    season: 1,
    episode: 0,
    watched: false,
    airDate: "2020-01-01",
  };

  const available = availableDownloadEpisodes([
    future,
    special,
    airedLater,
    invalidEpisode,
    airedFirst,
  ]);

  assert.deepEqual(available, [airedFirst, airedLater]);
  assert.strictEqual(available[0], airedFirst);
  assert.equal(available[0].imdbId, identity.imdbId);
  assert.equal(available[0].sourceMetaId, identity.sourceMetaId);
  assert.equal(available[0].videoId, identity.videoId);
});

test("final-season marker depends on the selected end episode", () => {
  const episodes = [
    { season: 1, episode: 1 },
    { season: 2, episode: 1 },
    { season: 2, episode: 2 },
  ];

  assert.equal(endsInFinalSeason(episodes[2], episodes), true);
  assert.equal(endsInFinalSeason(episodes[0], episodes), false);
  assert.equal(endsInFinalSeason(undefined, episodes), false);
  assert.equal(endsInFinalSeason(episodes[2], []), false);
});
