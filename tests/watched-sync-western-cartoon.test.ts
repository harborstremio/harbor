// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const animeDetect = read("../src/lib/anime-detect.ts");
const episodeWatched = read("../src/lib/stremio-episode-watched.ts");
const detail = read("../src/views/detail.tsx");

test("anime detection keys on the PRIMARY country, not any country in the list", () => {
  assert.match(animeDetect, /function primaryCountry\(/);
  assert.match(animeDetect, /\.split\(","\)\[0\]/);
  const fn = animeDetect.match(/function isJapaneseAnime\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(fn, /const c = primaryCountry\(m\)/);
  assert.ok(!/const c = \(m\.country \?\? ""\)\.toLowerCase\(\)/.test(fn), "must not scan the whole country list");
});

test("the Kitsu fallback only runs when the show's origin is unknown", () => {
  assert.match(animeDetect, /const originUnknown = !m \|\| !primaryCountry\(m\)/);
  assert.match(animeDetect, /if \(!anime && originUnknown &&/);
});

test("the poisoned detected-anime set is purged via a storage version bump", () => {
  assert.match(animeDetect, /harbor\.anime\.detected\.v2/);
  assert.match(animeDetect, /removeItem\("harbor\.anime\.detected\.v1"\)/);
});

test("watched-to-Stremio sync gates on the id SCHEME, never fuzzy anime detection", () => {
  assert.ok(!/isDetectedAnime/.test(episodeWatched), "stremio-episode-watched must not gate on isDetectedAnime");
  assert.match(episodeWatched, /if \(ANIME_ID\.test\(id\) \|\| meta\.type === "anime"\) return;/);
});

test("detail-page watched reconciliation is unblocked for tt cartoons", () => {
  assert.match(detail, /if \(!authKey \|\| !isSeries \|\| idAnime \|\| meta\.type === "anime"\) return;/);
  assert.ok(
    !/!isSeries \|\| isAnime \|\| isDetectedAnime\(meta\.id\)/.test(detail),
    "reconciliation must no longer gate on isAnime/isDetectedAnime",
  );
});
