// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import { buildStreamIds } from "../src/lib/streams/stream-ids.ts";

type Api = {
  buildStreamIdsWithIdentity: (
    metaId: string,
    episode: unknown,
    imdbId: string | null,
    defaultVideoId?: string | null,
    title?: string | null,
  ) => Promise<string[]>;
};

function load(overrides: Record<string, unknown> = {}): Api {
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/streams/anime-identity.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const mocks: Record<string, unknown> = {
    "@/lib/providers/anizip": { aniZipByKitsu: async () => null },
    "@/lib/providers/anime-mapping": {
      externalToKitsu: async () => null,
      findSiblingAnidbEntries: async () => [],
      imdbToKitsu: async () => null,
      kitsuToAnidb: async () => null,
      loadAnidbMaps: async () => ({ tvdb: {}, imdb: {} }),
      tmdbTvToKitsu: async () => null,
    },
    "@/lib/providers/anime-franchise-root": { franchiseRoot: async (id: string) => id },
    "@/lib/providers/kitsu": { kitsuSearchAnime: async () => [] },
    "@/lib/debug": { dlog: () => {} },
    "./stream-ids": { buildStreamIds },
    "./anime-identity-core": {
      animeAbsoluteFromScopedId: () => null,
      animeCoordPairs: () => [],
      findAnimeEntryNumber: () => null,
      isScopedSplitFranchiseRoot: () => false,
    },
    ...overrides,
  };
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in mocks, `Unexpected import ${id}`);
    return mocks[id];
  }, exports);
  return exports as Api;
}

function mappingDeps(externalToKitsu: (source: string, id: number) => Promise<number | null>) {
  return {
    "@/lib/providers/anime-mapping": {
      externalToKitsu,
      findSiblingAnidbEntries: async () => [],
      imdbToKitsu: async () => null,
      kitsuToAnidb: async () => null,
      loadAnidbMaps: async () => ({ tvdb: {}, imdb: {} }),
      tmdbTvToKitsu: async () => null,
    },
  };
}

test("a mal row without provider coordinates is queried by its mapped Kitsu entry", async () => {
  const api = load(
    mappingDeps(async (source, id) => (source === "myanimelist" && id === 63140 ? 50404 : null)),
  );
  const ids = await api.buildStreamIdsWithIdentity(
    "mal:63140",
    { season: 1, episode: 1 },
    null,
    null,
    "A Wild Last Boss Appeared! Season 2",
  );
  assert.equal(ids[0], "kitsu:50404:1");
  assert.ok(ids.includes("mal:63140:1"), "the mal id stays for addons that accept it");
});

test("a mal row with no mapping falls back to the Kitsu entry for its title", async () => {
  const api = load({
    "@/lib/providers/kitsu": {
      kitsuSearchAnime: async () => [
        { id: 48834, title: "Tougen Anki", year: 2025, subtype: "TV" },
        { id: 51018, title: "Tougen Anki: Nikko Kegon Falls Arc", year: 2026, subtype: "TV" },
      ],
    },
  });
  const ids = await api.buildStreamIdsWithIdentity(
    "mal:63181",
    { season: 1, episode: 1 },
    null,
    null,
    "Tougen Anki: Nikko Kegon Falls Arc",
  );
  assert.equal(ids[0], "kitsu:51018:1");
});

test("an ambiguous title is never routed to an unrelated entry", async () => {
  const api = load({
    "@/lib/providers/kitsu": {
      kitsuSearchAnime: async () => [{ id: 999, title: "Some Other Show", year: 2026, subtype: "TV" }],
    },
  });
  const ids = await api.buildStreamIdsWithIdentity(
    "mal:63181",
    { season: 1, episode: 1 },
    null,
    null,
    "Tougen Anki: Nikko Kegon Falls Arc",
  );
  assert.deepEqual(ids, ["mal:63181:1"]);
});

test("a scoped stream id keeps its own entry instead of the mapped one", async () => {
  const api = load(
    mappingDeps(async (source, id) => (source === "myanimelist" && id === 63140 ? 50404 : null)),
  );
  const ids = await api.buildStreamIdsWithIdentity(
    "mal:63140",
    { season: 1, episode: 5, kitsuStreamId: "kitsu:45619:5" },
    null,
    null,
    "A Wild Last Boss Appeared! Season 2",
  );
  assert.equal(ids[0], "kitsu:45619:5");
  assert.ok(!ids.includes("kitsu:50404:5"), "the scoped cour must not be overwritten");
});
