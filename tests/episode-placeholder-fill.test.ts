// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import {
  fillAiredPlaceholderTitles,
  firstRealEpisodeText,
  isPlaceholderEpisodeText,
} from "../src/lib/providers/episode-placeholder.ts";
import { isStaleTvdbOrder } from "../src/lib/providers/tvdb-order-cache.ts";
import type { OrderedEpisode } from "../src/lib/providers/tvdb-order.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";
import ts from "typescript";

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

const NOW = Date.parse("2026-10-03T12:00:00Z");

function episode(overrides: Partial<KitsuEpisode> = {}): KitsuEpisode {
  return {
    id: 1,
    number: 3,
    seasonNumber: 6,
    title: "TBA",
    synopsis: "",
    thumbnail: null,
    airdate: null,
    length: 24,
    ...overrides,
  };
}

function poolEpisode(overrides: Partial<KitsuEpisode> = {}): KitsuEpisode {
  return episode({
    id: 77,
    title: "The Desert-Born Outlaws",
    synopsis: "At camp, Johnny catches a glimpse of Gyro's past.",
    airdate: "2026-10-02",
    ...overrides,
  });
}

test("placeholder text is detected regardless of casing and spacing", () => {
  for (const text of ["TBA", "tba", "TBD", "TBC", "N/A", "n/a", "unknown", "To Be Announced", "  TBA  "]) {
    assert.equal(isPlaceholderEpisodeText(text), true, text);
  }
  for (const text of ["The Desert-Born Outlaws", "Episode 3", "The TBA Story", "", null, undefined]) {
    assert.equal(isPlaceholderEpisodeText(text), false, String(text));
  }
});

test("the first real text wins over a placeholder", () => {
  assert.equal(
    firstRealEpisodeText(["TBA", "The Desert-Born Outlaws"]),
    "The Desert-Born Outlaws",
  );
  assert.equal(firstRealEpisodeText([null, undefined, "TBA"]), "TBA");
  assert.equal(firstRealEpisodeText(["", "  "]), undefined);
});

test("an aired placeholder takes the real title and synopsis from the pool", () => {
  const row = episode({
    tvdbEpisodeId: 11872174,
    imdbSeason: 6,
    imdbEpisode: 3,
    absoluteNumber: 193,
    airdate: "2026-10-02",
  });
  const pool = [poolEpisode({ tvdbEpisodeId: 11872174, imdbSeason: 6, imdbEpisode: 3, absoluteNumber: 193 })];
  const [filled] = fillAiredPlaceholderTitles([row], pool, NOW);
  assert.equal(filled.title, "The Desert-Born Outlaws");
  assert.equal(filled.synopsis, "At camp, Johnny catches a glimpse of Gyro's past.");
  assert.notEqual(filled, row);
});

test("an unaired generic episode title becomes TBA", () => {
  const row = episode({
    title: "Episode 4",
    tvdbEpisodeId: 11872175,
    imdbSeason: 6,
    imdbEpisode: 4,
    airdate: "2026-10-09",
  });
  const out = fillAiredPlaceholderTitles([row], [], NOW);
  assert.equal(out[0].title, "TBA");
  assert.notEqual(out[0], row);
});

test("an aired generic title takes the pool's real name", () => {
  const row = episode({
    title: "Episode 3",
    tvdbEpisodeId: 11872174,
    imdbSeason: 6,
    imdbEpisode: 3,
    airdate: "2026-10-02",
  });
  const pool = [poolEpisode({ tvdbEpisodeId: 11872174, imdbSeason: 6, imdbEpisode: 3 })];
  const [filled] = fillAiredPlaceholderTitles([row], pool, NOW);
  assert.equal(filled.title, "The Desert-Born Outlaws");
});

test("an aired generic title stays when no source knows the real name", () => {
  const row = episode({ title: "Episode 3", airdate: "2026-10-02" });
  const out = fillAiredPlaceholderTitles([row], [], NOW);
  assert.equal(out[0], row);
});

test("an unaired placeholder stays TBA even when the pool has a title", () => {
  const row = episode({
    tvdbEpisodeId: 11872175,
    imdbSeason: 6,
    imdbEpisode: 4,
    airdate: "2026-10-09",
  });
  const pool = [poolEpisode({ tvdbEpisodeId: 11872175, imdbSeason: 6, imdbEpisode: 4 })];
  const out = fillAiredPlaceholderTitles([row], pool, NOW);
  assert.equal(out[0], row);
  assert.equal(out[0].title, "TBA");
});

test("an aired row with a real name but a placeholder synopsis still gets the description", () => {
  const row = episode({
    title: "The Desert-Born Outlaws",
    synopsis: "TBA",
    tvdbEpisodeId: 11872174,
    imdbSeason: 6,
    imdbEpisode: 3,
    airdate: "2026-10-02",
  });
  const pool = [poolEpisode({ tvdbEpisodeId: 11872174, imdbSeason: 6, imdbEpisode: 3 })];
  const [filled] = fillAiredPlaceholderTitles([row], pool, NOW);
  assert.equal(filled.title, "The Desert-Born Outlaws");
  assert.equal(filled.synopsis, "At camp, Johnny catches a glimpse of Gyro's past.");
  assert.notEqual(filled, row);
});

test("an unaired placeholder synopsis is left alone", () => {
  const row = episode({
    title: "The Desert-Born Outlaws",
    synopsis: "TBA",
    tvdbEpisodeId: 11872175,
    imdbSeason: 6,
    imdbEpisode: 4,
    airdate: "2026-10-09",
  });
  const pool = [poolEpisode({ tvdbEpisodeId: 11872175, imdbSeason: 6, imdbEpisode: 4 })];
  const out = fillAiredPlaceholderTitles([row], pool, NOW);
  assert.equal(out[0], row);
});

test("a generic pool name is not an improvement over TBA", () => {
  const row = episode({
    tvdbEpisodeId: 11872176,
    imdbSeason: 6,
    imdbEpisode: 5,
    airdate: "2026-10-01",
  });
  const pool = [poolEpisode({ tvdbEpisodeId: 11872176, imdbSeason: 6, imdbEpisode: 5, title: "Episode 5" })];
  const [filled] = fillAiredPlaceholderTitles([row], pool, NOW);
  assert.equal(filled.title, "TBA");
  // A real description is still an improvement over the empty one.
  assert.equal(filled.synopsis, "At camp, Johnny catches a glimpse of Gyro's past.");
});

test("matching falls back to the provider pair and absolute number", () => {
  const pool = [poolEpisode({ imdbSeason: 6, imdbEpisode: 3 })];
  const byPair = fillAiredPlaceholderTitles(
    [episode({ imdbSeason: 6, imdbEpisode: 3, airdate: "2026-10-02" })],
    pool,
    NOW,
  );
  assert.equal(byPair[0].title, "The Desert-Born Outlaws");
  const byAbs = fillAiredPlaceholderTitles(
    [episode({ absoluteNumber: 193, airdate: "2026-10-02" })],
    [poolEpisode({ absoluteNumber: 193 })],
    NOW,
  );
  assert.equal(byAbs[0].title, "The Desert-Born Outlaws");
});

test("a real row is left alone and an unchanged list keeps its identity", () => {
  const row = episode({ title: "The Desert-Born Outlaws", airdate: "2026-10-02" });
  const rows = [row];
  const out = fillAiredPlaceholderTitles(rows, [poolEpisode()], NOW);
  assert.equal(out, rows);
  assert.equal(out[0], row);
});

test("the TVDB order falls through placeholders instead of dropping the name", () => {
  const src = readFileSync(new URL("../src/lib/providers/tvdb-order.ts", import.meta.url), "utf8");
  assert.ok(src.includes("firstRealEpisodeText([tr?.name, trEn?.name, e.name])"));
  assert.ok(src.includes("firstRealEpisodeText([tr?.overview, trEn?.overview, e.overview])"));
});

test("the anime episode list fills aired placeholders from its pool", () => {
  const src = readFileSync(new URL("../src/views/detail/anime-episodes.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("fillAiredPlaceholderTitles(baseDisplay, franchiseEpisodes, Date.now(), tmdbLanguageIso())"));
  assert.ok(src.includes("episodeArtworkFor"));
  // Unaired rows must not receive artwork-map stills: providers number their
  // seasons differently, so any hit for an unaired episode is another
  // season's image.
  assert.ok(src.includes("unairedIds.has(ep.id)"));
});

test("episode artwork prefers TMDB and falls back to Cinemeta", async () => {
  const { episodeArtworkFor } = load("src/lib/providers/anime-episode-enrich.ts", {
    "@/lib/providers/anime-mapping": { kitsuToMal: async () => null, kitsuToTvdb: async () => 1 },
    "@/lib/providers/harbor-imdb": { harborImdbEpisodes: async () => new Map() },
    "@/lib/anime-fillers": { fillerEpisodes: async () => new Set() },
    "@/lib/providers/anime-tvdb-thumbs": { fetchTvdbThumbs: async () => null },
    "@/lib/dates": load("src/lib/dates.ts", {}),
    "@/lib/cinemeta": {
      meta: async () => ({
        moviedb_id: 45790,
        videos: [
          { season: 6, episode: 3, thumbnail: "https://metahub/6-3.jpg" },
          { season: 6, episode: 4, thumbnail: "https://metahub/6-4.jpg" },
        ],
      }),
    },
    "@/lib/providers/tmdb/tmdb-details": {
      tmdbSeasonEpisodes: async () => [
        {
          seasonNumber: 6,
          episodeNumber: 3,
          name: "The Desert-Born Outlaws",
          overview: "At camp, Johnny catches a glimpse of Gyro's past.",
          stillPath: "/still3.jpg",
          runtime: 25,
        },
        {
          seasonNumber: 6,
          episodeNumber: 4,
          name: "Episode 4",
          overview: "",
          stillPath: null,
          runtime: null,
        },
      ],
    },
    "@/lib/providers/tmdb/tmdb-image-rungs": {
      STILL_HD_RUNG: "w780",
      tmdbStillUrl: (p: string | null, rung?: string) =>
        p ? `https://image.tmdb.org/t/p/${rung ?? "w300"}${p}` : undefined,
    },
  });
  const map = await episodeArtworkFor({ imdbId: "tt2359704", tmdbKey: "k", seasons: [6] });
  // TMDB's still, overview and runtime win over the Cinemeta thumbnail.
  assert.equal(map.get("6:3")?.thumbnail, "https://image.tmdb.org/t/p/w780/still3.jpg");
  assert.equal(map.get("6:3")?.synopsis, "At camp, Johnny catches a glimpse of Gyro's past.");
  assert.equal(map.get("6:3")?.runtime, 25);
  // No TMDB still for this one: the Cinemeta thumbnail is kept.
  assert.equal(map.get("6:4")?.thumbnail, "https://metahub/6-4.jpg");
});

test("the big-picture episode list fills aired placeholders too", () => {
  const src = readFileSync(
    new URL("../src/views/big-picture/use-bp-anime-detail.ts", import.meta.url),
    "utf8",
  );
  assert.ok(src.includes("fillAiredPlaceholderTitles(visible, episodes)"));
});

test("a cached order with a placeholder on an aired episode is stale", () => {
  const ep = (name: string, airDate: string) =>
    ({ id: 1, seasonNumber: 6, episodeNumber: 3, name, airDate }) as unknown as OrderedEpisode;
  assert.equal(isStaleTvdbOrder([[6, [ep("TBA", "2026-10-02")]]], NOW), true);
  // Not aired yet: the placeholder is expected, not stale.
  assert.equal(isStaleTvdbOrder([[6, [ep("TBA", "2026-10-09")]]], NOW), false);
  assert.equal(isStaleTvdbOrder([[6, [ep("The Desert-Born Outlaws", "2026-10-02")]]], NOW), false);
});

test("both order caches and the TVDB response cache reject stale data", () => {
  const persisted = readFileSync(
    new URL("../src/lib/providers/tvdb-order-cache.ts", import.meta.url),
    "utf8",
  );
  assert.ok(persisted.includes("isStaleTvdbOrder(s.bySeason)"));
  assert.ok(persisted.includes('const PREFIX = "harbor.tvdbo.v7."'));
  const order = readFileSync(new URL("../src/lib/providers/tvdb-order.ts", import.meta.url), "utf8");
  assert.ok(order.includes("isStaleTvdbOrder(cached.order.bySeason)"));
  assert.ok(order.includes("ORDER_CACHE_TTL_MS"));
  const tvdb = readFileSync(new URL("../src/lib/providers/tvdb.ts", import.meta.url), "utf8");
  assert.ok(tvdb.includes("RESPONSE_TTL_MS"));
});
