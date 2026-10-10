// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";
import {
  buildKitsuEpisodes,
  mergeAniZipEpisodes,
  mergeTmdbEpisodes,
  mergeTvdbEpisodes,
} from "../src/lib/providers/anime-episode-build.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";

function episode(overrides: Partial<KitsuEpisode> = {}): KitsuEpisode {
  return {
    id: 1, number: 1, seasonNumber: 1, imdbSeason: 3, imdbEpisode: 1,
    title: "Episode 1", synopsis: "", thumbnail: null, airdate: null, length: 24,
    ...overrides,
  };
}

function load(path: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, any> = {};
  new Function("require", "exports", compiled)((id: string) => {
    assert.ok(id in mocks, `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports);
  return exports;
}

function enrichment({ videos = [], ratings = new Map(), thumbs = null }: {
  videos?: any[]; ratings?: Map<string, number>; thumbs?: any;
} = {}) {
  return load("src/lib/providers/anime-episode-enrich.ts", {
    "@/lib/providers/anime-mapping": { kitsuToMal: async () => null, kitsuToTvdb: async () => 1 },
    "@/lib/providers/harbor-imdb": { harborImdbEpisodes: async () => ratings },
    "@/lib/anime-fillers": { fillerEpisodes: async () => new Set() },
    "@/lib/providers/anime-tvdb-thumbs": { fetchTvdbThumbs: async () => thumbs },
    "@/lib/cinemeta": { meta: async () => ({ videos }) },
    "@/lib/providers/tmdb/tmdb-details": { tmdbSeasonEpisodes: async () => [] },
    "@/lib/providers/tmdb/tmdb-image-rungs": { STILL_HD_RUNG: "w780", tmdbStillUrl: () => undefined },
    "@/lib/dates": load("src/lib/dates.ts", {}),
  }).enrichEpisodes;
}

test("a newer AniZip entry's lowercase air date still reaches the episode", () => {
  const ep = episode({ number: 2, airdate: null });
  mergeAniZipEpisodes([ep], {
    mappings: { kitsu_id: 50404 },
    episodes: { "2": { episode: "2", airdate: "2026-10-03" } },
  } as any);
  assert.equal(ep.airdate, "2026-10-03");
});

test("newer AniZip lowercase air dates are read by the episode list builder", () => {
  const src = readFileSync(new URL("../src/lib/series-episodes.ts", import.meta.url), "utf8");
  assert.match(src, /m\.airDateUtc \?\? m\.airDate \?\? m\.airdate/);
});

test("TVDB does not replace a mapped later cour with season-one metadata", () => {
  const ep = episode({ thumbnail: "cour-three.jpg" });
  mergeTvdbEpisodes([ep], [{ id: 11, number: 1, seasonNumber: 1, name: "Wrong pilot", image: "pilot.jpg" }]);
  assert.equal(ep.thumbnail, "cour-three.jpg");
  assert.equal(ep.title, "Episode 1");
});

test("TVDB still uses exact episode ID, absolute number and provider coordinates", () => {
  for (const mapping of [{ tvdbEpisodeId: 31 }, { absoluteNumber: 25 }, {}]) {
    const ep = episode(mapping);
    mergeTvdbEpisodes([ep], [{ id: 31, number: 1, seasonNumber: 3, absoluteNumber: 25, name: "The return", image: "correct.jpg" }]);
    assert.equal(ep.thumbnail, "correct.jpg");
    assert.equal(ep.title, "The return");
  }
});

test("TMDB never borrows a repeated episode number after a mapped season misses", () => {
  const ep = episode();
  mergeTmdbEpisodes([ep], [{ id: 11, seasonNumber: 1, episodeNumber: 1, name: "Wrong pilot", overview: "Wrong story" } as any]);
  assert.equal(ep.title, "Episode 1");
  assert.equal(ep.synopsis, "");
});

test("TMDB merged-cour fallback targets season one at the absolute episode", () => {
  const ep = episode({ absoluteNumber: 25 });
  mergeTmdbEpisodes([ep], [
    { id: 125, seasonNumber: 1, episodeNumber: 25, name: "Merged cour episode" },
    { id: 225, seasonNumber: 2, episodeNumber: 25, name: "Other season episode" },
  ] as any);
  assert.equal(ep.title, "Merged cour episode");
});

test("unmapped episodes retain exact native season/episode enrichment", () => {
  const ep = episode({ imdbSeason: undefined, imdbEpisode: undefined });
  mergeTmdbEpisodes([ep], [{ id: 11, seasonNumber: 1, episodeNumber: 1, name: "Pilot" } as any]);
  assert.equal(ep.title, "Pilot");
  mergeTvdbEpisodes([ep], [{ id: 11, number: 1, seasonNumber: 1, image: "pilot.jpg" }]);
  assert.equal(ep.thumbnail, "pilot.jpg");
});

test("Cinemeta cannot fill a missing later-season thumbnail with the pilot", async () => {
  const ep = episode();
  await enrichment({ videos: [{ season: 1, episode: 1, thumbnail: "pilot.jpg" }] })([ep], {}, 1, "tt1");
  assert.equal(ep.thumbnail, null);
});

test("missing Cinemeta artwork does not shift absolute episode positions", async () => {
  const ep = episode({ absoluteNumber: 2 });
  await enrichment({ videos: [
    { season: 0, episode: 1, thumbnail: "special.jpg" },
    { season: 1, episode: 1 },
    { season: 1, episode: 2, thumbnail: "second.jpg" },
    { season: 1, episode: 3, thumbnail: "third.jpg" },
  ] })([ep], {}, 1, "tt1");
  assert.equal(ep.thumbnail, "second.jpg");
});

test("TVDB thumbnail fallback requires a known absolute episode number", async () => {
  const ep = episode();
  await enrichment({ thumbs: { bySeasonEpisode: new Map(), byAbsolute: new Map([[1, "pilot.jpg"]]) } })([ep], { tvdbKey: "fixture" }, 1, "tt1");
  assert.equal(ep.thumbnail, null);
});

test("duplicate Cinemeta coordinates can fill art without shifting later episodes", async () => {
  const first = episode({ absoluteNumber: 1 }), second = episode({ absoluteNumber: 2 });
  await enrichment({ videos: [
    { season: 1, episode: 1 },
    { season: 1, episode: 1, thumbnail: "first.jpg" },
    { season: 1, episode: 2, thumbnail: "second.jpg" },
  ] })([first, second], {}, 1, "tt1");
  assert.equal(first.thumbnail, "first.jpg");
  assert.equal(second.thumbnail, "second.jpg");
});

test("ratings cannot fall back to episode one of another season", async () => {
  const ep = episode();
  await enrichment({ ratings: new Map([["1:1", 9.5]]) })([ep], {}, 1, "tt1");
  assert.equal(ep.rating, undefined);
  assert.equal(ep.ratingIsImdb, undefined);
});

test("unaired episodes receive no IMDb rating even when the map carries their key", async () => {
  const ep = episode({ imdbSeason: 2, imdbEpisode: 2, absoluteNumber: 172, airdate: "2999-10-10" });
  await enrichment({ ratings: new Map([["2:2", 8.2]]) })([ep], {}, 1, "tt1");
  assert.equal(ep.rating, undefined);
  assert.equal(ep.ratingIsImdb, undefined);
});

test("undated episodes beyond the airing frontier receive no borrowed rating", async () => {
  const aired = episode({ id: 1, number: 1, imdbSeason: 2, imdbEpisode: 1, airdate: "2026-10-03" });
  const upcoming = episode({
    id: 2, number: 2, imdbSeason: 2, imdbEpisode: 2, airdate: "2999-10-10",
  });
  const undated = episode({
    id: 5, number: 5, imdbSeason: undefined, imdbEpisode: undefined, title: "Episode 5",
  });
  await enrichment({ ratings: new Map([["2:1", 7.8], ["1:5", 7.9]]) })(
    [aired, upcoming, undated], {}, 1, "tt1",
  );
  assert.equal(aired.rating, 7.8);
  assert.equal(upcoming.rating, undefined);
  assert.equal(undated.rating, undefined);
  assert.equal(undated.ratingIsImdb, undefined);
});

test("undated episodes beyond the airing frontier are not given another season's thumbnail", async () => {
  const aired = episode({ id: 1, number: 1, imdbSeason: 2, imdbEpisode: 1, airdate: "2026-10-03" });
  const upcoming = episode({
    id: 2, number: 2, imdbSeason: 2, imdbEpisode: 2, airdate: "2999-10-10",
  });
  const undated = episode({
    id: 5, number: 5, imdbSeason: undefined, imdbEpisode: undefined, title: "Episode 5",
  });
  await enrichment({ videos: [{ season: 1, episode: 5, thumbnail: "s1e5.jpg" }] })(
    [aired, upcoming, undated], {}, 1, "tt1",
  );
  assert.equal(undated.thumbnail, null);
});

test("a list with no aired anchor still enriches its undated episodes", async () => {
  const ep = episode({ imdbSeason: undefined, imdbEpisode: undefined });
  await enrichment({ ratings: new Map([["1:1", 7.3]]) })([ep], {}, 1, "tt1");
  assert.equal(ep.rating, 7.3);
  assert.equal(ep.ratingIsImdb, true);
});

test("the Kitsu addon's shared season-start released date does not mark unaired episodes aired", () => {
  const raw = [
    episode({ id: 11, number: 1, airdate: "2026-10-03" }),
    episode({ id: 12, number: 2, airdate: null }),
  ];
  const out = buildKitsuEpisodes({
    videos: [
      { episode: 1, season: 1, released: "2026-10-03T00:00:00.000Z" },
      { episode: 2, season: 1, released: "2026-10-03T00:00:00.000Z" },
    ],
  } as any, raw);
  assert.equal(out[0].airdate, "2026-10-03");
  assert.equal(out[1].airdate, null);
});

test("distinct addon released dates still win over the Kitsu raw air date", () => {
  const out = buildKitsuEpisodes({
    videos: [
      { episode: 1, season: 1, released: "2026-10-03T00:00:00.000Z" },
      { episode: 2, season: 1, released: "2026-10-10T00:00:00.000Z" },
    ],
  } as any, []);
  assert.equal(out[0].airdate, "2026-10-03T00:00:00.000Z");
  assert.equal(out[1].airdate, "2026-10-10T00:00:00.000Z");
});

test("an unaired episode is not given another season's thumbnail", async () => {
  const ep = episode({ imdbSeason: 2, imdbEpisode: 2, absoluteNumber: 172, airdate: "2999-10-10" });
  await enrichment({
    videos: [{ season: 1, episode: 2, thumbnail: "s1e2.jpg" }],
    thumbs: { bySeasonEpisode: new Map([["1:2", "s1e2.jpg"]]), byAbsolute: new Map([[2, "s1e2.jpg"]]) },
  })([ep], { tvdbKey: "fixture" }, 1, "tt1");
  assert.equal(ep.thumbnail, null);
});

test("exact provider matches and known absolute fallback remain usable", async () => {
  const exact = episode(), absolute = episode({ number: 2, imdbEpisode: 2, absoluteNumber: 26 });
  await enrichment({
    videos: [{ season: 3, episode: 1, thumbnail: "exact.jpg" }],
    ratings: new Map([["3:1", 8.1], ["1:26", 8.2]]),
    thumbs: { bySeasonEpisode: new Map(), byAbsolute: new Map([[26, "absolute.jpg"]]) },
  })([exact, absolute], { tvdbKey: "fixture" }, 1, "tt1");
  assert.equal(exact.thumbnail, "exact.jpg");
  assert.equal(exact.rating, 8.1);
  assert.equal(absolute.thumbnail, "absolute.jpg");
  assert.equal(absolute.rating, 8.2);
});

test("TVDB absolute numbering uses provider numbers rather than response positions", async () => {
  const { fetchTvdbThumbs } = load("src/lib/providers/anime-tvdb-thumbs.ts", {
    "@/lib/providers/tvdb": {
      tvdbEpisodesAbsolute: async () => [
        { id: 25, seasonNumber: 1, number: 25, absoluteNumber: 25, image: "twenty-five.jpg" },
        { id: 26, seasonNumber: 1, number: 26, image: "twenty-six.jpg" },
      ],
    },
  });
  const index = await fetchTvdbThumbs("fixture", 1, [3]);
  assert.equal(index.byAbsolute.get(25), "twenty-five.jpg");
  assert.equal(index.byAbsolute.get(26), "twenty-six.jpg");
  assert.equal(index.byAbsolute.has(1), false);
});

test("a partial TVDB season list cannot invent global absolute positions", async () => {
  const { fetchTvdbThumbs } = load("src/lib/providers/anime-tvdb-thumbs.ts", {
    "@/lib/providers/tvdb": {
      tvdbEpisodesAbsolute: async () => [],
      tvdbEpisodes: async () => [
        { id: 31, seasonNumber: 3, number: 1, image: "three-one.jpg" },
        { id: 32, seasonNumber: 3, number: 2, absoluteNumber: 26, image: "three-two.jpg" },
      ],
    },
  });
  const index = await fetchTvdbThumbs("fixture", 1, [3]);
  assert.equal(index.byAbsolute.has(1), false);
  assert.equal(index.byAbsolute.get(26), "three-two.jpg");
  assert.equal(index.bySeasonEpisode.get("3:1"), "three-one.jpg");
});
