// @ts-expect-error Node test types are outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser-only tsconfig.
import test from "node:test";
import type { Meta } from "../src/lib/cinemeta.ts";
import type { SearchResults } from "../src/lib/search.ts";
import { canPublishSearchResults, combineSearchResults } from "../src/lib/search-results.ts";
import { loadTsModule } from "./helpers/load-ts-module.ts";

const english: Meta = { id: "tmdb:tv:279388", type: "series", name: "Pursuit of Jade" };
const native: Meta = {
  id: "cnative:tt35316225",
  type: "series",
  name: "逐玉",
  imdb_id: "tt35316225",
  tmdb_id: 279388,
  description: "中文简介",
  addonOrigin: { id: "org.cnative.tv", name: "cNative", base: "https://native.example.test" },
};
const imdb: Meta = { id: "tt35316225", type: "series", name: english.name };
const unrelated: Meta = { id: "tt0944947", type: "series", name: "Game of Thrones" };
const empty = { movies: [], series: [] };
function base(query = "逐玉"): SearchResults {
  return {
    query,
    topMatch: { kind: "series", meta: english, popularity: 20 },
    movies: [],
    series: [english],
    people: [],
    liveTv: [],
    anime: [],
    manga: [],
    music: [],
    ebooks: [],
    sports: [],
    characters: [],
    addonGroups: [],
    addons: [],
    intent: null,
  };
}

test("exact Chinese addon title wins with native metadata and one identity", () => {
  const result = combineSearchResults(
    base(),
    { movies: [], series: [native] },
    { movies: [], series: [imdb, unrelated] },
    [],
  );
  assert.equal(result.topMatch?.meta, native);
  assert.equal(result.topMatch?.overview, "中文简介");
  assert.deepEqual(result.series, [native]);
});

test("native metadata from any addon can be the top match, including standard IMDb IDs", () => {
  const other = {
    ...native,
    id: imdb.id,
    addonOrigin: { id: "another.metadata", name: "Another addon" },
  };
  const result = combineSearchResults(base(), { movies: [], series: [other] }, empty, []);
  assert.equal(result.topMatch?.meta, other);
  assert.deepEqual(result.series, [other]);
});

test("native movie metadata uses the same ranking policy", () => {
  const movie: Meta = { ...native, type: "movie", name: "流浪地球" };
  const original = {
    ...base(movie.name),
    movies: [{ ...english, type: "movie" as const }],
    series: [],
  };
  const result = combineSearchResults(original, { movies: [movie], series: [] }, empty, []);
  assert.equal(result.topMatch?.kind, "movie");
  assert.equal(result.topMatch?.meta, movie);
  assert.deepEqual(result.movies, [movie]);
});

for (const query of ["Pursuit of Jade", "  PURSUIT   OF JADE  ", "Pursuit"]) {
  test(`English query retains the English card and deduplicates linked IDs: ${query}`, () => {
    const result = combineSearchResults(
      base(query),
      { movies: [], series: [native] },
      { movies: [], series: [imdb] },
      [],
    );
    assert.equal(result.topMatch?.meta, english);
    assert.deepEqual(result.series, [english]);
  });
}

test("without a native addon, Chinese queries retain the relevant English result", () => {
  const result = combineSearchResults(base(), empty, { movies: [], series: [unrelated] }, []);
  assert.equal(result.topMatch?.meta, english);
  assert.deepEqual(result.series, [english]);
});

test("partial native queries and normalized whitespace prefer matching addon titles", () => {
  for (const query of ["逐", "  逐玉  "]) {
    assert.equal(
      combineSearchResults(base(query), { movies: [], series: [native] }, empty, []).topMatch?.meta,
      native,
    );
  }
});

test("native matches arriving through addon groups are promoted and deduplicated", () => {
  const result = combineSearchResults(base(), empty, empty, [
    { id: "org.cnative.tv", name: "cNative", metas: [native] },
  ]);
  assert.equal(result.topMatch?.meta, native);
  assert.deepEqual(result.series, [native]);
  assert.deepEqual(result.addonGroups, []);
});

test("English Cinemeta search works without a TMDB top match", () => {
  const result = combineSearchResults(
    { ...base(english.name), topMatch: null, series: [] },
    { movies: [], series: [native] },
    { movies: [], series: [imdb] },
    [],
  );
  assert.equal(result.topMatch?.meta, imdb);
  assert.deepEqual(result.series, [imdb]);
});

test("a matching English addon can supply the top match without TMDB", () => {
  const result = combineSearchResults(
    { ...base(english.name), topMatch: null, series: [] },
    { movies: [], series: [native, imdb] },
    empty,
    [],
  );
  assert.equal(result.topMatch?.meta, imdb);
  assert.deepEqual(result.series, [imdb]);
});

test("unrelated Cinemeta feeds cannot reenter through installed addon groups", () => {
  const stray = { ...unrelated, addonOrigin: { id: "com.linvo.cinemeta", name: "Cinemeta" } };
  const result = combineSearchResults(base(), { movies: [], series: [native, stray] }, empty, [
    { id: "com.linvo.cinemeta", name: "Cinemeta", metas: [stray] },
  ]);
  assert.deepEqual(result.series, [native]);
  assert.deepEqual(result.addonGroups, []);
});

test("metadata aliases are resolved before selection, including late group links", () => {
  const result = combineSearchResults(base(english.name), { movies: [], series: [imdb] }, empty, [
    { id: "org.cnative.tv", name: "cNative", metas: [native] },
  ]);
  assert.deepEqual(result.series, [english]);
  assert.deepEqual(result.addonGroups, []);
});

test("search merging preserves beta's other result categories", () => {
  const original = base();
  const result = combineSearchResults(original, empty, empty, []);
  for (const key of [
    "music",
    "manga",
    "ebooks",
    "sports",
    "characters",
    "anime",
    "people",
  ] as const) {
    assert.equal(result[key], original[key]);
  }
});

test("native search waits for addons without flashing an English top match", () => {
  assert.equal(canPublishSearchResults("逐玉", false, base().topMatch), false);
  assert.equal(canPublishSearchResults("逐玉", true, base().topMatch), true);
  const topMatch = combineSearchResults(
    base(),
    { movies: [], series: [native] },
    empty,
    [],
  ).topMatch;
  assert.equal(canPublishSearchResults("逐玉", false, topMatch), true);
  assert.equal(canPublishSearchResults(english.name, false, base(english.name).topMatch), true);
});

test("addon search keeps same-ID language variants until ranking and sends the original query", async () => {
  const urls: string[] = [];
  const { searchAddonCatalogs } = loadTsModule<typeof import("../src/lib/search-addons.ts")>(
    "src/lib/search-addons.ts",
    {
      "./addons": { isCollectionCatalog: () => false },
      "./safe-fetch": {
        safeFetch: async (url: string) => {
          urls.push(url);
          return {
            ok: true,
            json: async () => ({
              metas: [{ ...imdb, name: url.includes("native.") ? native.name : english.name }],
            }),
          };
        },
      },
    },
  );
  const addons = ["english", "native"].map((name) => ({
    manifest: {
      id: name,
      name,
      version: "1.0.0",
      resources: ["catalog"],
      types: ["series"],
      catalogs: [{ id: "search", type: "series", extraSupported: ["search"] }],
    },
    transportUrl: `https://${name}.example.test/manifest.json`,
  }));
  const result = await searchAddonCatalogs(addons, "逐玉");
  assert.deepEqual(
    result.series.map((meta) => meta.name),
    [english.name, native.name],
  );
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => url.includes(`search=${encodeURIComponent("逐玉")}`)));
});
