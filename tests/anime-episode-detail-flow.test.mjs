import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { animePlayEpisode, resolveAnimeDetailTarget } from "../src/views/detail/anime-episodes/anime-season-key.ts";
import { cinemetaEpisodeDetail } from "../src/lib/cinemeta-episode.ts";

function load(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id) => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  }, module, module.exports);
  return module.exports;
}

const parent = { id: "kitsu:parent", type: "series", name: "Franchise" };
const entry = {
  id: "kitsu:part2", type: "series", name: "Part two",
  videos: [{ season: 3, episode: 13, name: "Wrong entry-relative video" }],
};
const row = {
  id: 7, number: 1, seasonNumber: 1, title: "Selected episode", synopsis: "Selected synopsis",
  thumbnail: "https://example.test/still.jpg", airdate: "2020-01-01", length: 24,
  streamId: "kitsu:part2:1", sourceMetaId: entry.id,
  imdbId: "tt2560140", imdbSeason: 3, imdbEpisode: 13, absoluteNumber: 50, tvdbEpisodeId: 123,
};

function fetcher({ tmdb = null, canonical = null, fail = false } = {}) {
  const requests = [], writes = [];
  const { fetchEpisodeData } = load("../src/lib/episode-data-fetcher.ts", {
    "@/lib/cinemeta": { meta: async (type, id) => {
      requests.push({ type, id });
      if (fail) throw new Error("Provider unavailable");
      return canonical;
    } },
    "@/lib/providers/tmdb/tmdb-client": { get: async () => ({ tv_results: [{ id: 1429 }] }) },
    "@/lib/providers/tmdb/tmdb-episode-details": { tmdbEpisodeDetail: async (...args) => {
      requests.push({ tmdb: args });
      return tmdb;
    } },
    "@/lib/providers/tmdb/tmdb-episode-cache": {
      getCachedEpisode: () => null, cacheEpisode: (...args) => writes.push(args),
    },
    "@/lib/cinemeta-episode": { cinemetaEpisodeDetail },
  });
  return { fetchEpisodeData, requests, writes };
}

// Exercise the actual detail page's Play handler, not a parallel implementation.
function playFromDetail(seriesMeta, episodeData, playback) {
  const source = ts.createSourceFile("detail.tsx", readFileSync(new URL("../src/views/episode-detail.tsx", import.meta.url), "utf8"), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  let declaration;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handlePlay") declaration = node.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(declaration);
  const code = ts.transpileModule(`const ${declaration}; handlePlay();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let selection;
  const scope = { seriesMeta, episodeData, playback, settings: { instantPlay: true },
    useCallback: (fn) => fn, getImageUrl: (url) => url,
    openPicker: (...args) => { selection = args; },
  };
  new Function(...Object.keys(scope), code)(...Object.values(scope));
  return selection;
}

test("split-cour lookup uses canonical metadata but Play keeps every source identifier", async () => {
  const target = resolveAnimeDetailTarget(row, parent, entry);
  const canonical = { id: target.seriesId, videos: [{ season: 3, episode: 13, name: "Canonical episode" }] };
  const h = fetcher({ canonical });
  const data = await h.fetchEpisodeData(target.seriesId, entry, target.season, target.episode, {}, target.playback.episode);
  assert.equal(data.name, "Canonical episode");
  assert.deepEqual(h.requests, [{ type: "series", id: "tt2560140" }]);
  const [meta, episode, options] = playFromDetail(target.seriesMeta, data, target.playback);
  assert.equal(meta, entry);
  assert.deepEqual(episode, animePlayEpisode(row));
  assert.deepEqual(options, { autoPlay: true });
});

test("TMDB enrichment uses mapped coordinates without changing long-running absolute playback", async () => {
  const selected = { ...row, number: 1089, absoluteNumber: 1089, imdbSeason: 21, imdbEpisode: 45 };
  const target = resolveAnimeDetailTarget(selected, parent, entry);
  const tmdb = { seasonNumber: 21, episodeNumber: 45, name: "TMDB episode" };
  const h = fetcher({ tmdb });
  const data = await h.fetchEpisodeData(target.seriesId, parent, 21, 45, { tmdbKey: "fixture" }, target.playback.episode);
  assert.equal(data, tmdb);
  assert.deepEqual(h.requests, [{ tmdb: ["fixture", 1429, 21, 45] }]);
  assert.equal(playFromDetail(parent, data, target.playback)[1].episode, 1089);
});

test("pure Kitsu detail works from its selected row without caching partial data", async () => {
  const target = resolveAnimeDetailTarget({ ...row, imdbId: undefined }, parent, { ...entry, videos: [] });
  const h = fetcher();
  const data = await h.fetchEpisodeData(target.seriesId, target.playback.meta, 1, 1, {}, target.playback.episode);
  assert.equal(data.name, row.title);
  assert.equal(data.overview, row.synopsis);
  assert.equal(data.runtime, 24);
  assert.equal(data.airDate, row.airdate);
  assert.equal(data.stillPath, row.thumbnail);
  assert.equal(data.episodeNumber, 1);
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.length, 0);
});

test("provider failure still shows the selected row, never a different cour's videos", async () => {
  const target = resolveAnimeDetailTarget(row, parent, entry);
  const h = fetcher({ fail: true });
  const data = await h.fetchEpisodeData(target.seriesId, entry, 3, 13, {}, target.playback.episode);
  assert.equal(data.name, row.title);
  assert.equal(h.writes.length, 0);
});

test("ordinary series detail reuses its existing metadata and preserves standard playback", async () => {
  const series = { id: "tt10", videos: [{ season: 2, episode: 6, name: "Normal episode" }] };
  const h = fetcher();
  const data = await h.fetchEpisodeData(series.id, series, 2, 6, {});
  assert.equal(data.name, "Normal episode");
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.length, 1);
  const [meta, episode] = playFromDetail(series, data);
  assert.equal(meta, series);
  assert.equal(episode.season, 2);
  assert.equal(episode.episode, 6);
});

test("both strip and grid information buttons pass the same playback payload as direct Play", () => {
  const calls = [];
  const jsx = (type, props) => ({ type, props });
  const marker = (name) => name;
  const { AnimeEpisodeStrip } = load("../src/views/detail/anime-episode-strip.tsx", {
    "react": { useMemo: (fn) => fn() },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": { Check: marker("check"), Eye: marker("eye") },
    "@/components/hover-tooltip": { HoverTooltip: marker("tooltip") },
    "@/components/drag-strip": { DragStrip: marker("strip") },
    "@/components/poster": { Poster: marker("poster") },
    "@/lib/settings": { useSettings: () => ({ settings: { instantPlay: true } }) },
    "@/lib/spoilers": {},
    "@/lib/view": { useView: () => ({
      openPicker: (...args) => calls.push({ play: args }),
      openEpisodeDetail: (...args) => calls.push({ detail: args }),
    }) },
    "./anime-episodes/anime-season-key": { animePlayEpisode, resolveAnimeDetailTarget, animeSeasonKey: () => 1 },
    "@/lib/dates": { formatAirDate: (value) => value },
    "@/lib/i18n": { useT: () => (value) => value },
    "./episode-grid": { EpisodeGrid: marker("grid") },
    "./badges": { FillerBadge: marker("filler"), UpcomingBadge: marker("upcoming") },
    "./helpers": { isUpcomingDate: () => false },
    "./episode-rating-badge": { EpisodeRatingBadge: marker("rating") },
  });
  const props = { meta: parent, episodes: [row], metaForEp: () => entry,
    progressFor: () => ({ ratio: 0, watched: false, startedAt: 0 }) };
  const grid = AnimeEpisodeStrip({ ...props, layout: "grid" }).props.episodes[0];
  grid.play();
  grid.openDetail();
  const strip = AnimeEpisodeStrip({ ...props, layout: "strip" });
  const cardElement = strip.props.children[0].props.children;
  const card = cardElement.type(cardElement.props);
  const buttons = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === "button") buttons.push(node.props);
    visit(node.props?.children);
  }
  visit(card);
  buttons.find((b) => !b["aria-label"]).onClick();
  buttons.find((b) => b["aria-label"] === "Episode details").onClick();
  const direct = calls.find((call) => call.play).play;
  assert.equal(calls.filter((call) => call.play).length, 2);
  const details = calls.filter((call) => call.detail);
  assert.equal(details.length, 2);
  for (const { detail } of details) {
    assert.deepEqual(detail.slice(0, 4), ["tt2560140", 3, 13, parent]);
    assert.equal(detail[4].meta, direct[0]);
    assert.deepEqual(detail[4].episode, direct[1]);
  }
});
