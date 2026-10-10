// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";

function loadMarks() {
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/anime-tracker-marks.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const rewinds: Array<{ tracker: string; id: string; target: number }> = [];
  const exports: any = {};
  const mocks: Record<string, unknown> = {
    "@/lib/providers/anime-mapping": {
      kitsuToMal: async () => 1604,
      kitsuToAnilist: async () => 1604,
      kitsuToAnidb: async () => 4747,
    },
    "@/lib/anilist/sync": {
      syncAnimeProgress: () => {},
      rewindAnimeProgress: (id: string, target: number) =>
        rewinds.push({ tracker: "anilist", id, target }),
    },
    "@/lib/mal/sync": {
      syncMalProgress: () => {},
      rewindMalProgress: (id: string, target: number) =>
        rewinds.push({ tracker: "mal", id, target }),
    },
    "@/lib/simkl/session": { getSession: () => null },
    "@/lib/simkl/history": {},
    // Reborn S9E1 is entry episode 192, so S9Ex maps to 191 + x.
    "./anime-entry-target": {
      animeEntryTarget: async (_m: string, r: { imdbEpisode: number }) => ({
        kitsuId: 1444,
        number: 191 + r.imdbEpisode,
      }),
    },
  };
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in mocks, `unexpected import ${id}`);
    return mocks[id];
  }, exports);
  return { pushAnimeMarks: exports.pushAnimeMarks, rewinds };
}

const row = (e: number) => ({ number: e, seasonNumber: 9, imdbSeason: 9, imdbEpisode: e });

test("unmarking rewinds to the last episode still watched, skipping an unwatched gap", async () => {
  const { pushAnimeMarks, rewinds } = loadMarks();
  // S9E1 watched, S9E2-8 unwatched, S9E9 being unmarked.
  const watchedRows = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((e) => ({
    row: row(e),
    watched: e === 1,
  }));
  await pushAnimeMarks("tt1224144", [row(9)], false, {
    title: "Reborn",
    anilist: true,
    mal: true,
    simkl: false,
    watchedRows,
  });
  assert.deepEqual(rewinds, [
    { tracker: "anilist", id: "kitsu:1444", target: 192 },
    { tracker: "mal", id: "kitsu:1444", target: 192 },
  ]);
});

test("unmarking with nothing else watched rewinds to zero", async () => {
  const { pushAnimeMarks, rewinds } = loadMarks();
  await pushAnimeMarks("tt1224144", [row(9)], false, {
    title: "Reborn",
    anilist: false,
    mal: true,
    simkl: false,
  });
  assert.deepEqual(rewinds, [{ tracker: "mal", id: "kitsu:1444", target: 0 }]);
});
