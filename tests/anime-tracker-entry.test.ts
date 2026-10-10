// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import "./_localstorage-stub.ts";
import {
  animeCoordPairs,
  findAnimeEntryNumber,
} from "../src/lib/streams/anime-identity-core.ts";

function load(mocks: Record<string, unknown>) {
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/anime-tracker-entry.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", code)(
    (id: string) => {
      assert.ok(id in mocks, `Unexpected import: ${id}`);
      return mocks[id];
    },
    exports,
  );
  return exports as {
    resolveTrackerAnimeEntry: (
      metaId: string,
      coords: unknown,
      deps: unknown,
    ) => Promise<{ id: string; episode: number } | null>;
  };
}

const base = {
  "@/lib/providers/anizip": { aniZipByKitsu: async () => null, aniZipByAnilist: async () => null },
  "@/lib/providers/anime-mapping": {
    externalToKitsu: async () => null,
    imdbToKitsu: async () => null,
    kitsuToAnilist: async () => null,
    tmdbTvToKitsu: async () => null,
  },
  "@/lib/providers/kitsu": { parseKitsuId: () => null },
  "@/lib/streams/anime-identity-core": { animeCoordPairs, findAnimeEntryNumber },
};

// A base entry that only ever aired provider season 1, plus a later cour that
// restarted at episode 1 (the new-cour shape AniZip publishes days late).
const BASE_S1 = {
  mappings: { kitsu_id: 49147 },
  episodes: { "1": { seasonNumber: 1, episodeNumber: 1 }, "12": { seasonNumber: 1, episodeNumber: 12 } },
};
const SEQUEL_FLAT = {
  mappings: { kitsu_id: 50404 },
  episodes: { "1": {}, "2": {}, "3": {} },
};

test("an existing season is resolved by the base entry, not the franchise walk", async () => {
  const api = load(base);
  const entry = await api.resolveTrackerAnimeEntry("tt33258199", { season: 1, episode: 1 }, {
    baseKitsuId: async () => 49147,
    azByKitsu: async () => BASE_S1,
    anilistOfKitsu: async () => {
      throw new Error("must not walk the franchise for a covered season");
    },
    sequels: async () => [],
    kitsuOfAnilist: async () => null,
  });
  assert.deepEqual(entry, { id: "kitsu:49147", episode: 1, baseId: "kitsu:49147" });
});

test("a newly aired sequel resolves to its own Kitsu entry when that entry is mapped", async () => {
  const api = load(base);
  const entry = await api.resolveTrackerAnimeEntry("tt33258199", { season: 2, episode: 2 }, {
    baseKitsuId: async () => 49147,
    azByKitsu: async (id: number) => (id === 49147 ? BASE_S1 : SEQUEL_FLAT),
    anilistOfKitsu: async () => 180523,
    sequels: async () => [{ id: 204389 }],
    kitsuOfAnilist: async () => 50404,
  });
  assert.deepEqual(entry, { id: "kitsu:50404", episode: 2, baseId: "kitsu:49147" });
});

test("an AniList-only sequel is named by its AniList id when no Kitsu entry is linked", async () => {
  const api = load(base);
  const entry = await api.resolveTrackerAnimeEntry("tt32344704", { season: 2, episode: 1 }, {
    baseKitsuId: async () => 48834,
    azByKitsu: async () => BASE_S1,
    anilistOfKitsu: async () => 177474,
    sequels: async () => [{ id: 204650 }],
    kitsuOfAnilist: async () => null,
  });
  assert.deepEqual(entry, { id: "anilist:204650", episode: 1, baseId: "kitsu:48834" });
});

test("a season the mapped entry already covers never hops to a sequel", async () => {
  const api = load(base);
  const entry = await api.resolveTrackerAnimeEntry("tt100", { season: 2, episode: 6 }, {
    baseKitsuId: async () => 1,
    azByKitsu: async () => ({
      mappings: { kitsu_id: 1 },
      episodes: { "1": { seasonNumber: 1, episodeNumber: 1 }, "6": { seasonNumber: 2, episodeNumber: 6 } },
    }),
    anilistOfKitsu: async () => {
      throw new Error("must not hop past a covered season");
    },
    sequels: async () => [],
    kitsuOfAnilist: async () => null,
  });
  assert.deepEqual(entry, { id: "kitsu:1", episode: 6, baseId: "kitsu:1" });
});

test("a row whose ids never reach an anime entry resolves to nothing", async () => {
  const api = load(base);
  const entry = await api.resolveTrackerAnimeEntry("tt100", { season: 2, episode: 1 }, {
    baseKitsuId: async () => null,
    azByKitsu: async () => null,
    anilistOfKitsu: async () => null,
    sequels: async () => [],
    kitsuOfAnilist: async () => null,
  });
  assert.equal(entry, null);
});

test("no coordinates means no resolution", async () => {
  const api = load(base);
  const entry = await api.resolveTrackerAnimeEntry("tt100", {}, {
    baseKitsuId: async () => {
      throw new Error("must not resolve without coordinates");
    },
    azByKitsu: async () => null,
    anilistOfKitsu: async () => null,
    sequels: async () => [],
    kitsuOfAnilist: async () => null,
  });
  assert.equal(entry, null);
});
