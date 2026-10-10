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

test("the top-match warm resolves only anime-looking catalog metas", async () => {
  const calls: string[] = [];
  const { warmAnimeResolution } = load("src/lib/anime-detect.ts", {
    react: { useSyncExternalStore: () => 0 },
    "@/lib/cinemeta": { meta: async () => null },
    "@/lib/providers/anime-mapping": {
      imdbToKitsu: async (id: string) => {
        calls.push(`imdb:${id}`);
        return 49847;
      },
      tmdbTvToKitsu: async (id: number) => {
        calls.push(`tmdb:${id}`);
        return 49847;
      },
    },
    "@/lib/providers/kitsu": {
      kitsuAnime: async (id: number) => {
        calls.push(`kitsu:${id}`);
        return { year: "2026" };
      },
    },
    "@/lib/storage-recovery": { setItemWithRecovery: () => {} },
  });
  warmAnimeResolution({
    id: "tmdb:tv:45790",
    type: "series",
    name: "JoJo's Bizarre Adventure",
    genres: ["Animation"],
    country: "JP",
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(calls.includes("tmdb:45790"), calls.join(","));
  assert.ok(calls.includes("kitsu:49847"), calls.join(","));

  const before = calls.length;
  warmAnimeResolution({
    id: "tt123",
    type: "series",
    name: "Some Drama",
    genres: ["Drama"],
    country: "US",
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls.length, before, calls.join(","));
});

test("the detail page seeds detection from the recorded mapping", () => {
  const detail = readFileSync(new URL("../src/views/detail.tsx", import.meta.url), "utf8");
  assert.ok(detail.includes("getAnimeCanonicalId(meta.id)"));
  assert.ok(detail.includes("setDetectedKitsu(recordedKitsu)"));
  const overlay = readFileSync(
    new URL("../src/components/search/search-overlay.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(overlay.includes("warmAnimeResolution"));
});
