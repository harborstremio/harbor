// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";

function loadHistory(respond: (body: any) => any) {
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/simkl/history.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports: any = {};
  const bodies: any[] = [];
  const mocks: Record<string, unknown> = {
    "@/lib/active-profile-id": { activeProfileId: () => "p" },
    "./session": { getSession: () => ({}) },
    "@/lib/tracker-resolve": {},
    "./activities/gate": { currentActivitiesAll: async () => null },
    "./client": {
      simklRequest: async (_path: string, opts: { body: any }) => {
        bodies.push(opts.body);
        return respond(opts.body);
      },
    },
    "./ids": { simklTargetIds: () => ({}) },
  };
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in mocks, `unexpected import ${id}`);
    return mocks[id];
  }, exports);
  return { api: exports, bodies };
}

test("an anime episode already in Simkl history counts as recorded", async () => {
  const { api } = loadHistory(() => ({
    added: { episodes: 0 },
    not_found: { shows: [], episodes: [] },
  }));
  assert.equal(await api.markAnimeEpisodesWatched({ kitsu: 1444, mal: 1604 }, [175]), true);
});

test("any not_found entry, including an anime one, is a missed write", async () => {
  for (const nf of [{ episodes: [{}] }, { shows: [{}] }, { anime: [{}] }]) {
    const { api } = loadHistory(() => ({ added: { episodes: 0 }, not_found: nf }));
    assert.equal(await api.markAnimeEpisodesWatched({ kitsu: 1444 }, [175]), false);
    assert.equal(await api.markTvdbAnimeEpisodesWatched({ imdb: "tt1224144" }, 7, [22]), false);
  }
});

test("a failed request is not a recorded watch", async () => {
  const { api } = loadHistory(() => {
    throw new Error("network");
  });
  assert.equal(await api.markAnimeEpisodesWatched({ kitsu: 1444 }, [175]), false);
});

test("the TVDB-anime fallback asks Simkl to map TVDB seasons", async () => {
  const { api, bodies } = loadHistory(() => ({ added: { episodes: 1 }, not_found: {} }));
  assert.equal(await api.markTvdbAnimeEpisodesWatched({ imdb: "tt1224144" }, 7, [22]), true);
  assert.equal(bodies[0].shows[0].use_tvdb_anime_seasons, true);
  assert.equal(bodies[0].shows[0].seasons[0].number, 7);
});
