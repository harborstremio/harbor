// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  buildVodLibrary,
  type VodEpisode,
  type VodMovie,
  type VodSeries,
} from "../src/lib/iptv/vod.ts";
import {
  matchVodMovies,
  matchVodSeries,
  pickVodEpisode,
  vodQualityLabel,
  vodTitleKey,
} from "../src/lib/iptv/vod-lookup.ts";
import {
  searchedSourceLabels,
  sourceOrderRank,
  streamDebridService,
} from "../src/lib/streams/source-order.ts";

function movie(title: string, year: number | null, extra: Partial<VodMovie> = {}): VodMovie {
  return {
    id: `vod:${title}:${year}`,
    title,
    year,
    logo: null,
    group: null,
    url: `http://provider.test/movie/${encodeURIComponent(title)}.mkv`,
    playlistId: "p",
    playlistName: "Provider",
    ...extra,
  };
}

function series(title: string, extra: Partial<VodSeries> = {}): VodSeries {
  return {
    id: `vod:series:${title}`,
    title,
    logo: null,
    group: null,
    playlistId: "p",
    playlistName: "Provider",
    episodes: [],
    seasons: [],
    ...extra,
  };
}

function ep(season: number, episode: number, numbered = true): VodEpisode {
  return {
    season,
    episode,
    numbered,
    title: `S${season}E${episode}`,
    url: `http://provider.test/series/${season}-${episode}.mkv`,
    logo: null,
  };
}

const titles = (list: Array<{ title: string; year?: number | null }>) =>
  list.map((m) => `${m.title}|${m.year ?? ""}`);

test("title keys ignore case, accents, punctuation, '&' and a trailing article", () => {
  assert.equal(vodTitleKey("Amélie"), vodTitleKey("AMELIE"));
  assert.equal(vodTitleKey("Ocean's Eleven"), vodTitleKey("Oceans Eleven"));
  assert.equal(vodTitleKey("Fast & Furious"), vodTitleKey("Fast and Furious"));
  assert.equal(vodTitleKey("Matrix, The"), vodTitleKey("The Matrix"));
  assert.equal(vodTitleKey("Spider-Man: No Way Home"), vodTitleKey("Spider Man No Way Home"));
});

test("movies match on exact title and a year within one", () => {
  const catalog = [movie("Dune", 2021), movie("Dune", 1984), movie("Dune Part Two", 2024)];
  assert.deepEqual(titles(matchVodMovies(catalog, { type: "movie", title: "Dune", year: 2021 })), [
    "Dune|2021",
  ]);
  assert.deepEqual(titles(matchVodMovies(catalog, { type: "movie", title: "Dune", year: 2022 })), [
    "Dune|2021",
  ]);
  assert.deepEqual(matchVodMovies(catalog, { type: "movie", title: "Dune", year: 2019 }), []);
});

test("near-miss titles never match", () => {
  const catalog = [
    movie("Dune Part Two", 2024),
    movie("The Batman", 2022),
    movie("Batman Begins", 2005),
    movie("Alien", 1979),
    movie("Aliens", 1986),
  ];
  assert.deepEqual(matchVodMovies(catalog, { type: "movie", title: "Dune", year: 2024 }), []);
  assert.deepEqual(matchVodMovies(catalog, { type: "movie", title: "Batman", year: 2022 }), []);
  assert.deepEqual(titles(matchVodMovies(catalog, { type: "movie", title: "Alien", year: 1979 })), [
    "Alien|1979",
  ]);
  assert.deepEqual(matchVodMovies(catalog, { type: "movie", title: "Aliens", year: 1979 }), []);
});

test("a movie without a year on either side is not guessed", () => {
  const catalog = [movie("Dune", null)];
  assert.deepEqual(matchVodMovies(catalog, { type: "movie", title: "Dune", year: 2021 }), []);
  assert.deepEqual(matchVodMovies([movie("Dune", 2021)], { type: "movie", title: "Dune" }), []);
});

test("a TMDB id on both sides decides, whatever the title says", () => {
  const catalog = [
    movie("Dune: Part One", 2021, { tmdbId: 438631 }),
    movie("Dune", 2021, { tmdbId: 841 }),
  ];
  assert.deepEqual(
    titles(matchVodMovies(catalog, { type: "movie", title: "Dune", year: 2021, tmdbId: 438631 })),
    ["Dune: Part One|2021"],
  );
  assert.deepEqual(
    titles(
      matchVodMovies([movie("Dune", 2021)], {
        type: "movie",
        title: "Dune",
        year: 2021,
        tmdbId: 438631,
      }),
    ),
    ["Dune|2021"],
  );
});

test("series match on title, and on year only when both sides have one", () => {
  const catalog = [
    series("Doctor Who", { year: 1963 }),
    series("Doctor Who", { year: 2005 }),
    series("The Office"),
    series("The Office UK"),
  ];
  assert.deepEqual(
    matchVodSeries(catalog, { type: "series", title: "Doctor Who", year: 2005 }).map((s) => s.year),
    [2005],
  );
  assert.deepEqual(
    matchVodSeries(catalog, { type: "series", title: "The Office", year: 2005 }).map(
      (s) => s.title,
    ),
    ["The Office"],
  );
  assert.deepEqual(matchVodSeries(catalog, { type: "series", title: "Office" }), []);
  assert.deepEqual(matchVodSeries(catalog, { type: "movie", title: "The Office" }), []);
});

test("only the exact, explicitly numbered episode is picked", () => {
  const episodes = [ep(1, 1), ep(1, 2), ep(2, 1), ep(1, 3, false)];
  assert.equal(pickVodEpisode(episodes, 1, 2)?.url, "http://provider.test/series/1-2.mkv");
  assert.equal(pickVodEpisode(episodes, 2, 2), null);
  assert.equal(pickVodEpisode(episodes, 1, 3), null);
  assert.equal(pickVodEpisode(episodes, null, 1), null);
});

test("quality labels come from the entry name or category", () => {
  assert.equal(vodQualityLabel("Dune (2021) 4K", null), "4K");
  assert.equal(vodQualityLabel("Dune", "FHD Movies"), "1080p");
  assert.equal(vodQualityLabel("Dune", "English"), null);
});

test("sources are tried provider first, then Real-Debrid, then TorBox", () => {
  const provider = { addonId: "jl.provider-vod", url: "http://provider.test/movie/1.mkv" };
  const rd = { addonId: "com.stremio.torrentio.addon", name: "[RD+] Torrentio", url: "x" };
  const tb = { addonId: "app.torbox.stremio", name: "TorBox", url: "y" };
  const other = { addonId: "other", name: "Other", url: "z" };
  assert.equal(streamDebridService(rd), "rd");
  assert.equal(streamDebridService(tb), "tb");
  assert.equal(streamDebridService(other), null);
  assert.deepEqual(
    [other, tb, rd, provider].sort((a, b) => sourceOrderRank(a) - sourceOrderRank(b)),
    [provider, rd, tb, other],
  );
  assert.deepEqual(
    searchedSourceLabels(
      ["Home IPTV"],
      [
        { transportUrl: "https://addon.test/manifest.json", manifest: { id: "x", name: "Other" } },
        {
          transportUrl: "https://stremio.torbox.app/k/manifest.json",
          manifest: { id: "app.torbox.stremio", name: "TorBox" },
        },
        {
          transportUrl: "https://torrentio.strem.fun/realdebrid=k/manifest.json",
          manifest: { id: "com.stremio.torrentio.addon", name: "Torrentio" },
        },
      ],
    ),
    ["Your provider (Home IPTV)", "Real-Debrid (Torrentio)", "TorBox", "Other"],
  );
});

test("playlist VOD entries carry the year, TMDB id and quality the matcher needs", () => {
  const channel = (
    id: string,
    name: string,
    group: string,
    attrs: Record<string, string> = {},
  ) => ({
    id,
    tvgId: null,
    name,
    logo: null,
    group,
    url: `http://provider.test/movie/u/p/${id}.mkv`,
    catchupSource: null,
    durationSec: null,
    attrs,
  });
  const library = buildVodLibrary(
    [
      {
        id: "p",
        name: "Provider",
        url: "",
        epgUrl: null,
        fetchedAt: 0,
        groups: [],
        channels: [
          channel("1", "EN - Dune (2021) 4K", "Movies"),
          channel("2", "Arrival", "Movies", { "tvg-type": "movie", "release-year": "2016" }),
          channel("3", "Heat", "Movies", { "tvg-type": "movie", "tmdb-id": "949" }),
          channel("4", "CNN", "News"),
        ],
      },
    ],
    new Map([["p", "Provider"]]),
  );
  const query = (title: string, year: number, tmdbId?: number) =>
    titles(matchVodMovies(library.movies, { type: "movie", title, year, tmdbId }));
  assert.deepEqual(query("Dune", 2021), ["Dune|2021"]);
  assert.equal(library.movies.find((m) => m.title === "Dune")?.quality, "4K");
  assert.deepEqual(query("Arrival", 2016), ["Arrival|2016"]);
  assert.deepEqual(query("Heat", 1995, 949), ["Heat|"]);
  assert.deepEqual(query("Heat", 1995), []);
});
