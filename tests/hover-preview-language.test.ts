import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path: string, mocks: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", output)(
    (name: string) => { assert.ok(name in mocks, `unexpected import ${name}`); return mocks[name]; },
    module, module.exports,
  );
  return module.exports;
}

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test("overview requests deduplicate, cache per language and key, and retry failed fetches", async () => {
  const requests: { key: string; language: string; resolve: (value: unknown) => void }[] = [];
  const { tmdbMetadataOverview } = load("src/lib/providers/tmdb/tmdb-lite.ts", {
    "./tmdb-client": {
      effectiveTmdbLanguage: () => "ar",
      get: (key: string, _: string, params: { language: string }) =>
        new Promise((resolve) => requests.push({ key, language: params.language, resolve })),
    },
    "../../cache": { lruSet: (cache: Map<string, unknown>, key: string, value: unknown) => cache.set(key, value) },
    "./tmdb-image-rungs": {},
  });
  const first = tmdbMetadataOverview("key", "tmdb:movie:1");
  const same = tmdbMetadataOverview("key", "tmdb:movie:1");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].language, "ar");
  requests[0].resolve({ overview: "  وصف عربي  " });
  assert.deepEqual(await Promise.all([first, same]), ["وصف عربي", "وصف عربي"]);
  assert.equal(await tmdbMetadataOverview("key", "tmdb:movie:1"), "وصف عربي");
  const english = tmdbMetadataOverview("key", "tmdb:movie:1", "en");
  requests[1].resolve({ overview: "English overview" });
  assert.equal(await english, "English overview");
  const failed = tmdbMetadataOverview("other-key", "tmdb:movie:1", "en");
  requests[2].resolve(null);
  assert.equal(await failed, undefined);
  const retry = tmdbMetadataOverview("other-key", "tmdb:movie:1", "en");
  requests[3].resolve({ overview: "Recovered" });
  assert.equal(await retry, "Recovered");
  assert.equal(await tmdbMetadataOverview("key", "custom:1", "en"), undefined);
  assert.equal(requests.length, 4);
});

function hookHarness() {
  const slots: any[] = [];
  const effects: (() => void)[] = [];
  let slot = 0;
  const settings = { tmdbKey: "fixture", tmdbLanguage: "ar", translateDescriptions: true };
  const requests: { id: string; language: string; resolve: (value?: string) => void }[] = [];
  const mappings: string[] = [];
  const same = (a?: unknown[], b?: unknown[]) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const { useLocalizedOverview } = load("src/lib/use-localized-overview.ts", {
    react: {
      useState: (initial: unknown) => {
        const i = slot++;
        if (!(i in slots)) slots[i] = initial;
        return [slots[i], (v: unknown) => { slots[i] = v; }];
      },
      useMemo: (fn: () => unknown, deps: unknown[]) => {
        const i = slot++;
        if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
        return slots[i].value;
      },
      useEffect: (fn: () => unknown, deps: unknown[]) => {
        const i = slot++;
        if (same(slots[i]?.deps, deps)) return;
        effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      },
    },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/providers/tmdb/tmdb-lite": {
      tmdbMetadataOverview: (_: string, id: string, language: string) =>
        new Promise<string | undefined>((resolve) => requests.push({ id, language, resolve })),
    },
    "@/lib/providers/tmdb/tmdb-imdb-resolve": {
      tmdbIdFromImdb: async (_: string, id: string) => { mappings.push(id); return "tmdb:movie:42"; },
    },
  });
  return { settings, requests, mappings, render(id = "tmdb:movie:1", fallback = "Catalog text", resolveImdb = false) {
    slot = 0;
    const value = useLocalizedOverview({ id, type: "movie", description: fallback }, resolveImdb);
    effects.splice(0).forEach((run) => run());
    return value;
  } };
}

test("localized overview replaces catalog text and follows live language changes", async () => {
  const h = hookHarness();
  assert.equal(h.render(), "Catalog text");
  h.requests[0].resolve("وصف عربي");
  await settle();
  assert.equal(h.render(), "وصف عربي");
  h.settings.tmdbLanguage = "fr";
  assert.equal(h.render(), "Catalog text", "previous language must not leak into a new request");
  assert.equal(h.requests[1].language, "fr");
  h.requests[1].resolve("Résumé français");
  await settle();
  assert.equal(h.render(), "Résumé français");
});

test("stale title/language replies cannot replace the current hover synopsis", async () => {
  const h = hookHarness();
  h.render("tmdb:movie:1");
  h.settings.tmdbLanguage = "de";
  h.render("tmdb:movie:2", "Second title");
  h.requests[1].resolve("Aktueller Film");
  await settle();
  h.requests[0].resolve("Old title");
  await settle();
  assert.equal(h.render("tmdb:movie:2", "Second title"), "Aktueller Film");
});

test("disabled translation and missing metadata preserve fallback without repeated requests", async () => {
  const h = hookHarness();
  h.settings.translateDescriptions = false;
  assert.equal(h.render(), "Catalog text");
  assert.equal(h.requests.length, 0);
  h.settings.translateDescriptions = true;
  h.render();
  h.requests[0].resolve(undefined);
  await settle();
  assert.equal(h.render("tmdb:movie:1", "Updated catalog text"), "Updated catalog text");
  assert.equal(h.requests.length, 1);
});

test("only opted-in previews resolve exact IMDb IDs; custom/anime IDs keep provider text", async () => {
  const h = hookHarness();
  h.render("tt12345");
  await settle();
  assert.equal(h.mappings.length, 0);
  h.render("tt12345", "Cinemeta synopsis", true);
  await settle();
  assert.deepEqual(h.mappings, ["tt12345"]);
  assert.equal(h.requests[0].id, "tmdb:movie:42");
  h.requests[0].resolve("Localized IMDb title synopsis");
  await settle();
  assert.equal(h.render("tt12345", "Cinemeta synopsis", true), "Localized IMDb title synopsis");
  assert.equal(h.render("kitsu:42", "Anime synopsis", true), "Anime synopsis");
  assert.equal(h.render("custom:42", "Addon synopsis", true), "Addon synopsis");
  assert.equal(h.requests.length, 1);
});
