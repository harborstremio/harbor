// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { getAnimeCanonicalId, getAnimeCwId, recordAnimeCwId, recordAnimePlayId } = await import(
  "../src/lib/anime-cw-ids.ts"
);

test("catalog ids record their resolved anime entry", () => {
  recordAnimeCwId("tt2359704", "kitsu:49847");
  recordAnimeCwId("tmdb:tv:45790", "kitsu:49847");
  assert.equal(getAnimeCwId("tt2359704"), "kitsu:49847");
  assert.equal(getAnimeCwId("tmdb:tv:45790"), "kitsu:49847");
  assert.equal(getAnimeCanonicalId("tt2359704"), "kitsu:49847");
});

test("a played cour does not hijack the detail hint", () => {
  recordAnimeCwId("tt2359704", "kitsu:7158");
  recordAnimePlayId("tt2359704", "kitsu:46013");
  // Play surfaces (CW card, play resolution) see the cour that was played.
  assert.equal(getAnimeCwId("tt2359704"), "kitsu:46013");
  // Detection seeding stays on the detail page's canonical entry.
  assert.equal(getAnimeCanonicalId("tt2359704"), "kitsu:7158");
});

test("non-catalog ids and non-anime values are ignored", () => {
  recordAnimeCwId("movie:1", "kitsu:1");
  recordAnimeCwId("tt1", "tt2");
  assert.equal(getAnimeCwId("movie:1"), null);
  assert.equal(getAnimeCwId("tt1"), null);
});
