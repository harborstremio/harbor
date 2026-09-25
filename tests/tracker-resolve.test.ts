// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import { clearResolved } from "../src/lib/tracker-resolve/cache.ts";
import {
  daysBetween,
  episodeMatches,
  findEpisodeInSeasons,
  isDistinctiveTitle,
  movieMatches,
  normalizeTitle,
} from "../src/lib/tracker-resolve/match.ts";
import { resolveEpisode, type CatalogDeps } from "../src/lib/tracker-resolve/resolve.ts";
import type { EpisodeIdentity, SeasonListing } from "../src/lib/tracker-resolve/types.ts";
import { flushPendingStops, listPendingStops, recordPendingStop } from "../src/lib/trakt/pending-sync.ts";

const GRAND_TOUR_REBOOT_TVDB = 11884343;
const TWIN_PEAKS_RETURN_IMDB = "tt4108304";

const grandTour: EpisodeIdentity = {
  showTitle: "The Grand Tour",
  showYear: 2016,
  season: 7,
  number: 1,
  name: "The Next Generation",
  airDate: "2026-09-04T08:00:00.000Z",
  episodeTvdbId: GRAND_TOUR_REBOOT_TVDB,
};

const twinPeaks: EpisodeIdentity = {
  showTitle: "Twin Peaks",
  showYear: 2017,
  season: 1,
  number: 1,
  name: "Part 1",
  airDate: "2017-05-21T00:00:00.000Z",
  episodeImdbId: TWIN_PEAKS_RETURN_IMDB,
};

function season(number: number, episodes: SeasonListing["episodes"]): SeasonListing {
  return { number, episodes };
}

test("normalizeTitle folds case, punctuation and a leading article", () => {
  assert.equal(normalizeTitle("The Grand Tour"), "grand tour");
  assert.equal(normalizeTitle("Twin Peaks: The Return"), "twin peaks the return");
});

test("isDistinctiveTitle rejects generic episode names", () => {
  assert.equal(isDistinctiveTitle("The Next Generation"), true);
  assert.equal(isDistinctiveTitle("Part 1"), false);
  assert.equal(isDistinctiveTitle("Episode 5"), false);
  assert.equal(isDistinctiveTitle(""), false);
});

test("daysBetween only answers when both dates parse", () => {
  assert.equal(daysBetween("2026-09-04", "2026-09-06"), 2);
  assert.equal(daysBetween(undefined, "2026-09-06"), null);
  assert.equal(daysBetween("not-a-date", "2026-09-06"), null);
});

test("episodeMatches prefers the episode's own external id over any heuristic", () => {
  const candidate = { number: 1, title: "Different Title", airDate: null, tvdbId: GRAND_TOUR_REBOOT_TVDB };
  assert.equal(episodeMatches(grandTour, candidate), true);
});

test("findEpisodeInSeasons searches beyond the reported season", () => {
  const seasons = [
    season(1, [{ number: 1, title: "Pilot", airDate: "1990-04-08" }]),
    season(2, [{ number: 1, title: "May the Giant Be with You", airDate: "1990-09-30" }]),
    season(3, [{ number: 1, title: "Part 1", airDate: "2017-05-21", imdbId: TWIN_PEAKS_RETURN_IMDB }]),
  ];
  assert.deepEqual(findEpisodeInSeasons(twinPeaks, seasons), { season: 3, number: 1 });
});

const dailyShow: EpisodeIdentity = {
  showTitle: "Daily Show",
  season: 1,
  number: 2,
  airDate: "2026-01-02",
  episodeTvdbId: 202,
};

test("an exact episode id wins over a nearer season that only date-matches", () => {
  const seasons = [
    season(1, [
      { number: 1, title: "First", airDate: "2026-01-01", tvdbId: 101 },
      { number: 2, title: "Second", airDate: "2026-01-02", tvdbId: 202 },
    ]),
  ];
  assert.deepEqual(findEpisodeInSeasons(dailyShow, seasons), { season: 1, number: 2 });
});

test("a conflicting episode id cannot fall through to the date window", () => {
  const wrongEpisode = { number: 1, title: "First", airDate: "2026-01-01", tvdbId: 101 };
  assert.equal(episodeMatches(dailyShow, wrongEpisode), false);
});

test("an exact id on a later candidate beats a date guess on an earlier one", async () => {
  clearResolved();
  const deps: CatalogDeps = {
    searchShows: async () => [
      { showIds: { imdb: "tt1111111", trakt: 1 }, title: "Daily Show", year: 2020 },
      { showIds: { imdb: "tt2222222", trakt: 2 }, title: "Daily Show", year: 2026 },
    ],
    fetchShowSeasons: async (showIds) =>
      showIds.trakt === 1
        ? [season(1, [{ number: 1, title: "First", airDate: "2026-01-01" }])]
        : [season(1, [{ number: 2, title: "Second", airDate: "2026-01-02", tvdbId: 202 }])],
  };
  const result = await resolveEpisode(dailyShow, deps);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.episode.showIds.trakt, 2);
  assert.equal(result.episode.number, 2);
});

const grandTourDeps: CatalogDeps = {
  searchShows: async () => [
    { showIds: { imdb: "tt5712554", trakt: 108999, tmdb: 67557 }, title: "The Grand Tour", year: 2016 },
    { showIds: { imdb: "tt44974627", trakt: 326664, tmdb: 329471 }, title: "The Grand Tour", year: 2026 },
  ],
  fetchShowSeasons: async (showIds) => {
    if (showIds.trakt === 326664) {
      return [
        season(1, [
          { number: 1, title: "The Next Generation", airDate: "2026-09-04", tvdbId: GRAND_TOUR_REBOOT_TVDB },
          { number: 2, title: "Sweat, Sports Cars and Singapore", airDate: "2026-09-04", tvdbId: 11908204 },
        ]),
      ];
    }
    return [
      season(1, [{ number: 1, title: "The Holy Trinity", airDate: "2016-11-18", tvdbId: 5929209 }]),
      season(6, [{ number: 1, title: "One for the Road", airDate: "2024-09-13", tvdbId: 10455327 }]),
    ];
  },
};

test("a merged season resolves onto the entry the tracker actually holds", async () => {
  clearResolved();
  const result = await resolveEpisode(grandTour, grandTourDeps);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.episode.showIds.imdb, "tt44974627");
  assert.equal(result.episode.season, 1);
  assert.equal(result.episode.number, 1);
});

const twinPeaksDeps: CatalogDeps = {
  searchShows: async () => [{ showIds: { imdb: "tt0098936", tmdb: 1920 }, title: "Twin Peaks", year: 1990 }],
  fetchShowSeasons: async () => [
    season(1, [{ number: 1, title: "Pilot", airDate: "1990-04-08" }]),
    season(2, [{ number: 1, title: "May the Giant Be with You", airDate: "1990-09-30" }]),
    season(3, [{ number: 1, title: "Part 1", airDate: "2017-05-21", imdbId: TWIN_PEAKS_RETURN_IMDB }]),
  ],
};

test("a split entry resolves back onto its parent show's season", async () => {
  clearResolved();
  const result = await resolveEpisode(twinPeaks, twinPeaksDeps);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.episode.showIds.imdb, "tt0098936");
  assert.equal(result.episode.season, 3);
  assert.equal(result.episode.number, 1);
});

const blackMirror: EpisodeIdentity = {
  showTitle: "Black Mirror",
  showYear: 2011,
  season: 0,
  number: 1,
  name: "White Christmas",
  airDate: "2014-12-16T00:00:00.000Z",
  episodeTvdbId: 99999999,
};

const blackMirrorDeps: CatalogDeps = {
  searchShows: async () => [{ showIds: { imdb: "tt2085059", trakt: 97718 }, title: "Black Mirror", year: 2011 }],
  fetchShowSeasons: async () => [
    season(1, [{ number: 1, title: "The National Anthem", airDate: "2011-12-04", tvdbId: 4109540 }]),
  ],
};

test("an episode the tracker does not carry is reported absent, not failed", async () => {
  clearResolved();
  const result = await resolveEpisode(blackMirror, blackMirrorDeps);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not-found");
});

test("an unresolvable comparison stays retryable instead of being cached as absent", async () => {
  clearResolved();
  const blank: EpisodeIdentity = { showTitle: "Some Show", season: 4, number: 2 };
  const result = await resolveEpisode(blank, {
    searchShows: async () => [{ showIds: { imdb: "tt1111111" }, title: "Some Show", year: 2001 }],
    fetchShowSeasons: async () => [season(4, [{ number: 2 }])],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "error");
});

test("a resolved episode is remembered instead of re-searching the catalog", async () => {
  clearResolved();
  let searches = 0;
  const deps: CatalogDeps = {
    ...grandTourDeps,
    searchShows: async (title) => {
      searches += 1;
      return grandTourDeps.searchShows(title);
    },
  };
  await resolveEpisode(grandTour, deps);
  await resolveEpisode(grandTour, deps);
  assert.equal(searches, 1);
});

test("a season 0 special matches the movie it is filed under on the tracker", () => {
  const whiteChristmas: EpisodeIdentity = {
    showTitle: "Black Mirror",
    showYear: 2011,
    season: 0,
    number: 1,
    name: "White Christmas",
    airDate: "2014-12-16T03:00:00.000Z",
  };
  assert.equal(movieMatches(whiteChristmas, { title: "Black Mirror: White Christmas", year: 2014 }), true);
  assert.equal(movieMatches(whiteChristmas, { title: "White Christmas", year: 1954 }), false);
  assert.equal(movieMatches(whiteChristmas, { title: "Black Christmas", year: 1974 }), false);
  assert.equal(
    movieMatches(whiteChristmas, { title: "Backstage Stories from 'White Christmas'", year: null }),
    false,
  );
});

function clearQueue() {
  localStorage.removeItem("harbor.trakt.pendingstops.v1.default");
}

test("a not-found episode is dropped from the queue instead of replaying forever", async () => {
  clearQueue();
  recordPendingStop("tt2085059", { season: 0, episode: 1 }, 100);
  const result = await flushPendingStops({
    hasSession: () => true,
    resolveTarget: () => ({
      kind: "episode",
      show: { ids: { imdb: "tt2085059" } },
      season: 0,
      number: 1,
    }),
    commit: async () => "not-found",
  });
  assert.equal(result.flushed, 1);
  assert.equal(listPendingStops().length, 0);
});

test("a transient failure stays queued for the next reconnect", async () => {
  clearQueue();
  recordPendingStop("tt1234567", { season: 1, episode: 2 }, 100);
  const result = await flushPendingStops({
    hasSession: () => true,
    resolveTarget: () => ({
      kind: "episode",
      show: { ids: { imdb: "tt1234567" } },
      season: 1,
      number: 2,
    }),
    commit: async () => "failed",
  });
  assert.equal(result.flushed, 0);
  assert.equal(listPendingStops().length, 1);
});
