// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import { localDateTimeFromIso } from "../src/lib/calendar-time.ts";

type Api = {
  fetchLibraryCalendar: (
    authKey: string,
    year: number,
    month: number,
    opts: { tmdbKey: string; includeTrakt: boolean },
  ) => Promise<Array<{ id: string; name: string; releaseDate: string }>>;
};

function load(overrides: Record<string, unknown> = {}): Api {
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/calendar-library.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const mocks: Record<string, unknown> = {
    "./cinemeta": { meta: async () => null },
    "./stremio": { library: async () => [] },
    "./watchlist": { readLocalEntries: () => [] },
    "./local-cw": { listLocalCw: () => [] },
    "./manual-watched": { manualWatchedLibraryItems: () => [] },
    "./trakt/watchlist": { fetchWatchlist: async () => [] },
    "./providers/tvmaze": { tvmazeUpcoming: async () => null },
    "./providers/tmdb/tmdb-calendar": {
      tmdbFindByImdb: async () => ({ tvId: null, movieId: null }),
      tmdbMovieRelease: async () => null,
      tmdbTvPoster: async () => null,
      tmdbTvUpcoming: async () => null,
    },
    "./providers/anizip": {
      aniZipByAnilist: async () => null,
      aniZipByKitsu: async () => null,
      aniZipByMal: async () => null,
      pickEpisodeTitle: () => null,
    },
    "./providers/anime-mapping": { imdbToKitsu: async () => null, tmdbTvToKitsu: async () => null },
    "./providers/anime-franchise-root": { franchiseRoot: async (id: string) => id },
    "./calendar-time": { localDateTimeFromIso },
    ...overrides,
  };
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in mocks, `Unexpected import ${id}`);
    return mocks[id];
  }, exports);
  return exports as Api;
}

const TOUGEN_S2 = {
  titles: { en: "Tougen Anki: Nikko Kegon Falls Arc" },
  mappings: {},
  episodes: {
    "1": { episode: "1", airdate: "2026-10-02" },
    "2": { episode: "2", airdate: "2026-10-09" },
  },
};

test("a locally started anime reaches the library calendar without a Stremio entry", async () => {
  const api = load({
    "./local-cw": {
      listLocalCw: () => [{ id: "mal:63181", type: "series", name: "Tougen Anki", t: Date.now() }],
    },
    "./providers/anizip": {
      aniZipByAnilist: async () => null,
      aniZipByKitsu: async () => null,
      aniZipByMal: async (id: number) => (id === 63181 ? TOUGEN_S2 : null),
      pickEpisodeTitle: () => null,
    },
  });
  const out = await api.fetchLibraryCalendar("key", 2026, 9, { tmdbKey: "", includeTrakt: false });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, "mal:63181:1:1");
  assert.equal(out[0].releaseDate, "2026-10-02");
});

test("manual-watched anime also becomes a candidate", async () => {
  const api = load({
    "./manual-watched": {
      manualWatchedLibraryItems: () => [
        {
          _id: "kitsu:51018",
          type: "series",
          name: "Tougen Anki",
          _mtime: new Date().toISOString(),
        },
      ],
    },
    "./providers/anizip": {
      aniZipByAnilist: async () => null,
      aniZipByKitsu: async (id: number) => (id === 51018 ? TOUGEN_S2 : null),
      aniZipByMal: async () => null,
      pickEpisodeTitle: () => null,
    },
  });
  const out = await api.fetchLibraryCalendar("key", 2026, 9, { tmdbKey: "", includeTrakt: false });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, "kitsu:51018:1:1");
});

test("a merged parent-season episode does not duplicate the real sequel airing", async () => {
  const api = load({
    "./stremio": {
      library: async () => [
        {
          _id: "tt33258199",
          type: "series",
          name: "A Wild Last Boss Appeared!",
          removed: false,
          temp: false,
          _mtime: new Date().toISOString(),
        },
      ],
    },
    // TMDB merges the sequel into the parent season: the same airing is reported
    // as both S1E14 and S2E03.
    "./providers/tmdb/tmdb-calendar": {
      tmdbFindByImdb: async () => ({ tvId: 280042, movieId: null }),
      tmdbTvUpcoming: async () => ({
        name: "A Wild Last Boss Appeared!",
        poster: null,
        isAnime: true,
        episodes: [
          { season: 1, number: 14, name: "Episode 14", airDate: "2026-10-10", image: null, overview: "", voteAverage: 0 },
          { season: 2, number: 3, name: "Episode 3", airDate: "2026-10-10", image: null, overview: "", voteAverage: 0 },
        ],
      }),
      tmdbMovieRelease: async () => null,
      tmdbTvPoster: async () => null,
    },
  });
  const out = await api.fetchLibraryCalendar("key", 2026, 9, { tmdbKey: "k", includeTrakt: false });
  assert.equal(out.length, 1, "the merged S1 label must not survive");
  assert.match(out[0].name, /S02E03/);
});

test("a catalog row in the same franchise as an anime row is dropped", async () => {
  const api = load({
    "./local-cw": {
      listLocalCw: () => [
        { id: "kitsu:49444", type: "series", name: "Bleach: Thousand-Year Blood War - The Calamity", t: Date.now() },
        { id: "tmdb:tv:30984", type: "series", name: "Bleach", t: Date.now() },
      ],
    },
    "./providers/anime-franchise-root": { franchiseRoot: async () => "kitsu:244" },
    "./providers/anime-mapping": {
      imdbToKitsu: async () => null,
      tmdbTvToKitsu: async (id: number) => (id === 30984 ? 244 : null),
    },
    "./providers/anizip": {
      aniZipByAnilist: async () => null,
      aniZipByKitsu: async (id: number) =>
        id === 49444
          ? {
              titles: { en: "Bleach: Thousand-Year Blood War - The Calamity" },
              mappings: {},
              episodes: { "9": { episode: "9", seasonNumber: 17, episodeNumber: 49, airdate: "2026-10-19" } },
            }
          : null,
      aniZipByMal: async () => null,
      pickEpisodeTitle: () => null,
    },
    "./providers/tmdb/tmdb-calendar": {
      tmdbFindByImdb: async () => ({ tvId: 30984, movieId: null }),
      tmdbTvUpcoming: async () => ({
        name: "Bleach",
        poster: null,
        isAnime: true,
        episodes: [
          { season: 2, number: 49, name: "THE BLADE", airDate: "2026-10-20", image: null, overview: "", voteAverage: 0 },
        ],
      }),
      tmdbMovieRelease: async () => null,
      tmdbTvPoster: async () => null,
    },
  });
  const out = await api.fetchLibraryCalendar("key", 2026, 9, { tmdbKey: "k", includeTrakt: false });
  assert.equal(out.length, 1, "the catalog duplicate must be dropped");
  assert.equal(out[0].releaseDate, "2026-10-19");
  assert.match(out[0].name, /S17E49/);
});
