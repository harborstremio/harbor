// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";

// Runs the real useAnimeTvdbPanel builder against a Black Clover S2 replica:
// a currently-airing sequel cour whose TVDB rows carry dates only for the
// first episodes and whose IMDb rating map (the Harbor backend grid) has a
// rating for every "2:N" key, aired or not. Dates are relative to the clock.

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

const DAY = 86_400_000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

function row(partial: any, sourceMetaId = "kitsu:50024"): any {
  return {
    id: 0, number: 0, seasonNumber: 1, title: "", synopsis: "", thumbnail: null,
    airdate: null, length: null, ...partial, sourceMetaId,
  };
}

// Pool rows replicating fetchEntryEpisodes(50024) under the current code:
// E1-4 carry AniZip data, E5-13 are identity-less and undated (the bogus
// shared addon released date is gone and Kitsu raw has no dates).
const pool: any[] = [];
const aniZipMeta: Record<number, { tvdbId: number; air: string; abs: number }> = {
  1: { tvdbId: 11965847, air: day(-1), abs: 171 },
  2: { tvdbId: 11975216, air: day(6), abs: 172 },
  3: { tvdbId: 12006277, air: day(13), abs: 173 },
  4: { tvdbId: 12006278, air: day(20), abs: 174 },
};
for (let n = 1; n <= 13; n++) {
  const az = aniZipMeta[n];
  pool.push(row({
    id: n, number: n,
    title: n === 1 ? "The Battle Begins" : `Episode ${n}`,
    airdate: az ? az.air : null,
    imdbSeason: az ? 2 : undefined,
    imdbEpisode: az ? n : undefined,
    absoluteNumber: az ? az.abs : undefined,
    tvdbEpisodeId: az ? az.tvdbId : undefined,
    rating: undefined,
  }));
}
// A couple of season 1 rows so the pool looks like a franchise pool.
pool.push(row({ id: 101, number: 170, imdbSeason: 1, imdbEpisode: 170, absoluteNumber: 170 }, "kitsu:13209"));

const franchise = [
  { meta: { id: "kitsu:13209", type: "series", name: "Black Clover" }, year: 2017, startDate: "2017-10-03", isCurrent: false, isUpcoming: false },
  { meta: { id: "kitsu:50024", type: "series", name: "Black Clover 2nd Season" }, year: 2026, startDate: day(-1), isCurrent: true, isUpcoming: false },
];

// Real TVDB rows for 331753 season 2 (fetched from the harbor proxy): dates
// exist only for the first episodes; the rest are undated.
const tvdbRows = [
  { id: 11965847, seasonNumber: 2, episodeNumber: 1, name: "開戦", airDate: day(-1), image: "e1.jpg", overview: "real" },
  { id: 11975216, seasonNumber: 2, episodeNumber: 2, name: "TBA", airDate: day(6), image: null, overview: "TBA" },
  { id: 12006277, seasonNumber: 2, episodeNumber: 3, name: "TBA", airDate: day(13), image: null, overview: "TBA" },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: 12006278 + i, seasonNumber: 2, episodeNumber: 4 + i, name: "TBA", airDate: null, image: null, overview: "TBA",
  })),
];
const ordering = {
  seasons: [{ seasonNumber: 2, name: "Season 2", airDate: day(-1) }],
  bySeason: new Map([[2, tvdbRows]]),
  absByEpId: new Map(tvdbRows.map((e) => [e.id, 170 + e.episodeNumber])),
  imageByAbs: new Map(),
};

// Pre-seed useState in call order: seriesId, ordering, orderTypes, activeType,
// sel, touched, resolved, foreignSeasons.
const states: any[] = [
  331753, ordering, [{ value: "aired", label: "Aired Order" }], "aired",
  null, false, "has", new Set(),
];
let call = 0;
const react = {
  useState: (init: any) => {
    const i = call++;
    const v = states[i] !== undefined ? states[i] : init;
    return [v, () => {}];
  },
  useEffect: () => {},
  useMemo: (fn: () => any) => fn(),
  useCallback: (fn: any) => fn,
  useRef: (v: any) => ({ current: v }),
};

const { useAnimeTvdbPanel } = load("src/views/detail/anime-episodes/use-anime-tvdb-panel.ts", {
  react,
  "@/lib/i18n": { useT: () => (s: string) => s },
  "@/lib/providers/anime-episode-build": {
    isForeignScriptTitle: (t?: string | null) =>
      !!t && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(t),
    isGenericEpisodeName: (t?: string | null) => !!t && /^episode\s*\d+$/i.test(t.trim()),
  },
  "@/lib/providers/kitsu": { parseKitsuId: (id: string) => Number(String(id).slice(6)) },
  "@/lib/providers/anime-mapping": { kitsuToTvdb: async () => 331753 },
  "@/lib/providers/anime-detail": { isFranchiseExtra: () => false },
  "@/lib/providers/tvdb": {
    tvdbLangFromIso1: () => "eng",
    tvdbOrderTypeHasEpisodes: async () => true,
    tvdbSeasonTypes: async () => [{ value: "aired", label: "Aired Order" }],
    tvdbSeriesByRemote: async () => null,
  },
  "@/lib/providers/tmdb/tmdb-client": { tmdbLanguageIso: () => "en" },
  "@/lib/localized-text": {
    pickLocalizedText: (cands: Array<{ text?: string | null }>) =>
      cands.find((c) => c?.text != null && c.text !== "")?.text,
  },
  "@/lib/providers/harbor-imdb": {
    // The backend grid for tt7441658 carries a rating for every "2:N" key,
    // unaired episodes included.
    harborImdbEpisodesCached: () =>
      new Map([["2:1", 7.8], ["2:2", 8], ["2:3", 8.2], ["2:4", 6.7],
        ["2:5", 8], ["2:6", 7.8], ["2:7", 7.5], ["2:8", 6.8], ["2:9", 7.6],
        ["2:10", 7.8], ["2:11", 6.9], ["2:12", 7.2], ["2:13", 7.3]]),
  },
  "@/lib/providers/tvdb-order": {
    seasonDateRange: (eps: any[]) => {
      let from: string | undefined, to: string | undefined;
      for (const e of eps) {
        if (!e.airDate) continue;
        if (!from || e.airDate < from) from = e.airDate;
        if (!to || e.airDate > to) to = e.airDate;
      }
      return { from, to };
    },
    fetchTvdbOrderBySeriesId: async () => ordering,
  },
  "@/lib/streams/anime-identity": { foreignAnimeProviderSeasons: async () => new Set() },
  "@/lib/dates": load("src/lib/dates.ts", {}),
  "./anime-slot-match": load("src/views/detail/anime-episodes/anime-slot-match.ts", {}),
});

test("an ongoing TVDB season rates only its aired episodes", () => {
  const result = useAnimeTvdbPanel(
    13209, "tt7441658", [], "default", "", true, pool, undefined, "2", franchise, "kitsu:13209",
  );
  assert.ok(result.panel, "panel should resolve");
  const rows = result.panel.visibleEpisodes;
  assert.equal(rows.length, 13);
  assert.equal(rows[0].rating, 7.8, "the aired episode keeps its IMDb rating");
  for (const ep of rows.slice(1)) {
    assert.equal(ep.rating, undefined, `E${ep.number} must have no rating`);
    assert.equal(ep.ratingIsImdb, undefined, `E${ep.number} must not be marked imdb`);
  }
  assert.equal(rows[1].airdate, day(6), "dated rows keep their air date");
  assert.equal(rows[4].airdate, null, "undated rows stay undated rather than faking aired");
});
