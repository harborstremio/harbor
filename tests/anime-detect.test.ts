import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

type Meta = { genres?: string[]; country?: string; originalLanguage?: string };

function fixture(initial: Record<string, string> = {}) {
  const storage = new Map(Object.entries(initial));
  const metaCalls: string[] = [];
  const mappingCalls: string[] = [];
  const metadata = new Map<string, Meta>();
  const mapping = new Map<string, number>();
  const timers: Array<() => void> = [];
  const mocks: Record<string, unknown> = {
    react: { useSyncExternalStore: () => {} },
    "@/lib/cinemeta": { meta: async (_type: string, id: string) => {
      metaCalls.push(id);
      return metadata.get(id) ?? null;
    } },
    "@/lib/providers/anime-mapping": {
      imdbToKitsu: async (id: string) => {
        mappingCalls.push(id);
        return mapping.get(id) ?? null;
      },
      tmdbTvToKitsu: async () => null,
    },
    "@/lib/providers/kitsu": { kitsuAnime: async () => null },
    "@/lib/storage-recovery": { setItemWithRecovery: (key: string, value: string) => storage.set(key, value) },
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/anime-detect.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const api = {} as typeof import("../src/lib/anime-detect");
  new Function("require", "exports", "localStorage", "setTimeout", compiled)(
    (id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, api,
    { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) },
    (fn: () => void) => { timers.push(fn); return timers.length; },
  );
  return { api, metadata, mapping, metaCalls, mappingCalls, storage, timers };
}

test("non-Japanese animation with an exact anime mapping is recognized for CW filtering", async () => {
  const h = fixture();
  h.metadata.set("tt101", { genres: ["Animation", "Drama"], country: "China" });
  h.mapping.set("tt101", 501);
  await h.api.detectAnimeForCw([{ _id: "tt101", type: "series" }]);
  assert.equal(h.api.isDetectedAnime("tt101"), true);
  assert.deepEqual(h.mappingCalls, ["tt101"]);
});

test("unmapped animation and known live action are not classified by country or name alone", async () => {
  const h = fixture();
  h.metadata.set("tt102", { genres: ["Animation"], country: "United States" });
  h.metadata.set("tt103", { genres: ["Drama"], country: "China" });
  h.mapping.set("tt103", 502);
  await h.api.detectAnimeForCw([{ _id: "tt102", type: "series" }, { _id: "tt103", type: "series" }]);
  assert.equal(h.api.isDetectedAnime("tt102"), false);
  assert.equal(h.api.isDetectedAnime("tt103"), false);
  assert.deepEqual(h.mappingCalls, ["tt102"]);
});

test("Japanese animation needs no mapping request and repeated concurrent IDs share detection", async () => {
  const h = fixture();
  h.metadata.set("tt104", { genres: ["Animation"], country: "Japan" });
  const items = [{ _id: "tt104", type: "series" }, { _id: "tt104", type: "series" }];
  await Promise.all([h.api.detectAnimeForCw(items), h.api.detectAnimeForCw(items)]);
  assert.equal(h.api.isDetectedAnime("tt104"), true);
  assert.deepEqual(h.metaCalls, ["tt104"]);
  assert.deepEqual(h.mappingCalls, []);
});

test("old negative classifications cannot suppress the corrected mapping check", async () => {
  const h = fixture({ "harbor.anime.notanime.v1": JSON.stringify({ t: Date.now(), ids: ["tt105"] }) });
  h.metadata.set("tt105", { genres: ["Animation"], country: "China" });
  h.mapping.set("tt105", 505);
  await h.api.detectAnimeForCw([{ _id: "tt105", type: "series" }]);
  assert.equal(h.api.isDetectedAnime("tt105"), true);
});
