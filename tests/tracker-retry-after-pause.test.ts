// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";

function load(path: string, mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in mocks, `unexpected import ${id}`);
    return mocks[id];
  }, exports);
  return exports;
}

test("a lookup that failed after a long pause is retried, a resolved one stays cached", async () => {
  let kitsu: number | null = null;
  let lookups = 0;
  const api = load("src/lib/streams/anime-identity.ts", {
    "@/lib/providers/anizip": {
      aniZipByKitsu: async () => ({ episodes: { "5": { seasonNumber: 1, episodeNumber: 5 } } }),
    },
    "@/lib/providers/anime-mapping": {
      externalToKitsu: async () => null,
      findSiblingAnidbEntries: async () => [],
      imdbToKitsu: async () => {
        lookups++;
        return kitsu;
      },
      kitsuToAnidb: async () => null,
      loadAnidbMaps: async () => ({}),
      tmdbTvToKitsu: async () => null,
    },
    "@/lib/providers/anime-franchise-root": { franchiseRoot: async () => null },
    "./anime-identity-core": {
      animeAbsoluteFromScopedId: () => null,
      animeCoordPairs: () => [[1, 5]],
      findAnimeEntryNumber: (_az: unknown, pairs: number[][]) => pairs[0][1],
      isScopedSplitFranchiseRoot: () => false,
    },
    "./stream-ids": { buildStreamIds: () => [] },
    "@/lib/debug": { dlog: () => {} },
  });
  const coords = { season: 1, episode: 5 };
  assert.equal(await api.resolveAnimeIdentity("tt1", null, coords), null);
  await new Promise((r) => setTimeout(r, 0));
  kitsu = 42;
  assert.deepEqual(await api.resolveAnimeIdentity("tt1", null, coords), {
    streamId: "kitsu:42:5",
    kitsuId: 42,
    number: 5,
  });
  await api.resolveAnimeIdentity("tt1", null, coords);
  assert.equal(lookups, 2);
});

test("a truncated end that reloads in place does not lock Simkl out of the real end", () => {
  const hook = readFileSync(new URL("../src/lib/simkl/scrobble-hook.ts", import.meta.url), "utf8");
  const ended = hook.slice(
    hook.indexOf('if (snap.status === "ended")'),
    hook.indexOf("if (!loadResetSeenRef.current)"),
  );
  assert.match(ended, /lastActionRef\.current = endPct >= WATCHED_MARK_PCT \? "stop" : null;/);
});
