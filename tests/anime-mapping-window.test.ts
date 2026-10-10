// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
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

// ARM says kitsu 50024 is anidb 19433; anime-lists pins that entry to season 2
// of TVDB series 331753 with no episode offset (the real Black Clover case).
const ARM_JSON = JSON.stringify({ anidb: 19433, kitsu: 50024 });
const XML =
  `<anime anidbid="19432" tvdbid="331753" defaulttvdbseason="1" episodeoffset="0" />` +
  `<anime anidbid="19433" tvdbid="331753" defaulttvdbseason="2" episodeoffset="0" tmdbtv="73223" imdbid="" />`;

const realFetch = globalThis.fetch;
test.before(() => {
  globalThis.fetch = (async (url: any) => {
    const u = String(url);
    if (u.includes("relations.yuna.moe")) {
      return { ok: true, json: async () => JSON.parse(ARM_JSON) } as any;
    }
    if (u.includes("anime-list-master.xml")) {
      return { ok: true, text: async () => XML } as any;
    }
    return { ok: false } as any;
  }) as any;
});
test.after(() => {
  globalThis.fetch = realFetch;
});

const { applyAnidbSeasonWindow } = load("src/lib/providers/anime-mapping.ts", {
  "@/lib/providers/anizip": {
    aniZipByAnidb: async () => null,
    aniZipByAnilist: async () => null,
    aniZipByImdb: async () => null,
    aniZipByKitsu: async () => null,
    aniZipByMal: async () => null,
    aniZipByTmdbTv: async () => null,
  },
  "@/lib/providers/kitsu": { kitsuMainTvSeries: async () => null },
  "@/lib/streams/anime-identity-core": { selectSiblingWindows: () => [] },
  "./mapping-store": {
    mappingStore: () => ({ get: () => undefined, set: () => {} }),
  },
});

function episode(partial: Record<string, unknown>): any {
  return {
    id: 0, number: 1, seasonNumber: 1, title: "", synopsis: "", thumbnail: null,
    airdate: null, length: null, imdbSeason: undefined, imdbEpisode: undefined,
    tvdbEpisodeId: undefined, absoluteNumber: undefined, ...partial,
  };
}

test("the anime-lists window gives uncovered sequel-cour rows their provider season", async () => {
  // E1-2 carry AniZip coordinates; E3-5 are identity-less (AniZip has no
  // records yet) and the Kitsu addon labels them season 1.
  const episodes = [
    episode({ id: 1, number: 1, imdbSeason: 2, imdbEpisode: 1, absoluteNumber: 171 }),
    episode({ id: 2, number: 2, imdbSeason: 2, imdbEpisode: 2, absoluteNumber: 172 }),
    episode({ id: 3, number: 3 }),
    episode({ id: 4, number: 4 }),
    episode({ id: 5, number: 5 }),
  ];
  await applyAnidbSeasonWindow(episodes, 50024);
  assert.equal(episodes[0].imdbSeason, 2, "AniZip-covered rows keep their coordinates");
  assert.equal(episodes[2].imdbSeason, 2, "uncovered rows get the window's season");
  assert.equal(episodes[2].imdbEpisode, 3);
  assert.equal(episodes[4].imdbEpisode, 5);
  assert.equal(episodes[4].seasonNumber, 1, "the entry-local season is untouched");
});
