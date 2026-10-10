// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";

test("remote Stremio ticks decode even when Cinemeta metadata is turned off", async () => {
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/stremio-watched-pull.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports: any = {};
  const applied: any[] = [];
  const cinemetaCalls: any[] = [];
  const videos = [{ id: "tt1224144:9:10", season: 9, episode: 10 }];
  const mocks: Record<string, unknown> = {
    "@/lib/cinemeta": {
      // Mirrors cinemeta.ts: a disabled source answers null unless the caller forces it.
      meta: async (type: string, id: string, force?: boolean) => {
        cinemetaCalls.push({ type, id, force });
        return force ? { id, videos } : null;
      },
    },
    "@/lib/stremio-watched": {
      decodeWatchedEpisodes: async () => new Set(["9:10"]),
    },
    "@/lib/manual-watched": {
      applyRemoteWatched: (id: string, add: unknown[], unset: unknown[]) =>
        applied.push({ id, add, unset }),
      manualWatchedState: () => undefined,
      remoteWatchedKeys: () => new Set(),
      unwatchedAt: () => undefined,
    },
    "@/lib/movie-watched": { isMovieWatchedLocal: () => false, setMovieWatchedLocal: () => {} },
  };
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in mocks, `unexpected import ${id}`);
    return mocks[id];
  }, exports);
  exports.reconcileRemoteWatched([
    {
      _id: "tt1224144",
      type: "series",
      _mtime: "2026-10-08T17:47:43.000Z",
      state: { watched: "tt1224144:9:10:200:x" },
    },
  ]);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(cinemetaCalls[0]?.force, true);
  assert.deepEqual(applied, [{ id: "tt1224144", add: [{ season: 9, episode: 10 }], unset: [] }]);
});
