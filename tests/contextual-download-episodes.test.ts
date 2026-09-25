import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import * as React from "react";
import { createRoot } from "react-dom/client";
import ts from "typescript";
import { episodeSpoilerMasks } from "../src/lib/spoilers";
import type { PlayEpisode } from "../src/lib/view";

test("an explicit mapped anime episode opens its displayed season while progress keeps verified source coordinates", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost/" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const episodes: PlayEpisode[] = [
    { season: 1, episode: 2, imdbSeason: 4, imdbEpisode: 7, imdbId: "tt123", name: "Controlled" },
    { season: 1, episode: 3, imdbSeason: 4, imdbEpisode: 8, imdbId: "tt123", name: "Concealed" },
  ];
  const title = {
    meta: { id: "kitsu:123", type: "series", name: "Controlled" },
    imdbId: null,
    pending: false,
  };
  const settings = {
    tmdbKey: "",
    tvdbKey: "",
    hideSpoilers: true,
    spoilerHideThumbnails: true,
    spoilerHideTitles: true,
    spoilerHideDescriptions: true,
    spoilerSkipNext: true,
  };
  const hidden = new Set();
  const stills = {};
  const loadedSeasons: number[] = [];
  const progressCalls: unknown[][] = [];
  const projections: unknown[] = [];
  let unavailable = true;
  const mocks: Record<string, unknown> = {
    react: React,
    "@/lib/context-watched-state": {
      readContextWatchedSnapshot: async (input: unknown) => {
        projections.push(input);
        return {
          keys: [],
          providers: [{ provider: "Trakt", watched: unavailable ? null : new Set(["1:2"]) }],
        };
      },
    },
    "@/lib/episode-progress": {
      resumeDefaultSeason: () => 4,
      getEpisodeProgress: (...args: unknown[]) => {
        progressCalls.push(args);
        return { watched: (args[6] as Set<string>).has(`${args[1]}:${args[2]}`), ratio: 0 };
      },
    },
    "@/lib/hidden-episodes": { useHiddenEpisodes: () => hidden },
    "@/lib/manual-watched": {
      manualEpisodeKeys: () => ({ watched: [], unwatched: [] }),
      subscribeManualWatched: () => () => {},
      manualWatchedVersion: () => 0,
    },
    "@/lib/providers/tmdb": {},
    "@/lib/series-episodes": {
      isAnimeId: () => true,
      fetchSeasonList: async () => [4],
      fetchSeasonEpisodes: async (_meta: unknown, season: number) => {
        loadedSeasons.push(season);
        return season === 4 ? episodes : [];
      },
    },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/settings/episode-order": { effectiveOrderProvider: () => "tmdb" },
    "@/lib/spoilers": { episodeSpoilerMasks },
    "@/views/detail/series-episodes/use-episode-enrich": {
      useEpisodeEnrich: ({ episodes }: { episodes: unknown }) => ({ episodes }),
    },
    "@/views/detail/series-episodes/use-episode-order": { useEpisodeOrder: () => null },
    "@/views/detail/series-episodes/use-series-tvdb-stills": { useSeriesTvdbStills: () => stills },
  };
  const output = ts.transpileModule(
    readFileSync(
      new URL("../src/components/context-menu/use-download-episodes.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  const module = {
    exports: {} as typeof import("../src/components/context-menu/use-download-episodes"),
  };
  new Function("require", "module", "exports", output)(
    (id: string) => {
      assert.ok(id in mocks, id);
      return mocks[id];
    },
    module,
    module.exports,
  );
  let result: ReturnType<typeof module.exports.useDownloadEpisodes>;
  function Harness() {
    result = module.exports.useDownloadEpisodes(title, episodes[0], () => true);
    return null;
  }
  const root = createRoot(document.querySelector("#root")!);
  try {
    await React.act(() => root.render(React.createElement(Harness)));
    assert.deepEqual(
      loadedSeasons,
      [4],
      "source-local season 1 must not request the wrong displayed group",
    );
    assert.equal(result!.episodes.length, 2);
    assert.equal(
      result!.masks.get(episodes[0])?.thumb,
      true,
      "unknown provider state cannot reveal next-up",
    );
    assert.ok(
      progressCalls.some(
        (args) =>
          args[0] === "kitsu:123" &&
          args[1] === 1 &&
          args[2] === 2 &&
          args[4] === "tt123" &&
          args[10] === 4 &&
          args[11] === 7,
      ),
    );
    assert.equal((projections[0] as { episodeProjection: unknown }).episodeProjection, episodes);
    unavailable = false;
    await React.act(() => result!.retry());
    assert.equal(result!.masks.get(episodes[0])?.thumb, false);
    assert.equal(
      result!.masks.get(episodes[1])?.thumb,
      false,
      "verified next-up follows the watched episode",
    );
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
  }
});
