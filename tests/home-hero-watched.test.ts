// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const home = read("src/views/home.tsx");
const homeRows = read("src/views/home/home-rows.ts");
const watchedTitle = read("src/lib/watched-title.ts");
const customRows = read("src/views/home/customizable-rows.tsx");

test("the featured hero skips watched titles behind the setting", () => {
  assert.match(watchedTitle, /export function isTitleWatched/);
  assert.match(home, /const heroWatched = useMemo/);
  assert.match(home, /settings\.hideWatchedInHero/);
  assert.match(home, /simklWatchedForId\(simklWatchedMap/);
});

test("the hero counts titles marked watched before they entered the hero", () => {
  // markMetaWatched writes these two stores, so the hero must read them too.
  assert.match(watchedTitle, /watchedFlags\?\.has\(id\)/);
  assert.match(watchedTitle, /movieWatched\?\.has\(id\)/);
  assert.match(home, /useWatchedFlagIds\(\)/);
  assert.match(home, /useMovieWatchedIds\(\)/);
});

test("watched hero slots backfill from their source row", () => {
  assert.match(homeRows, /heroRows/, "builders must report which row each hero slot came from");
  assert.match(
    home,
    /rows\.find\(\(r\) => r\.key === key\)/,
    "the hero must pull the next unwatched candidate from the same row",
  );
  assert.match(home, /heroRows\.length > 0/);
});

test("Simkl movies count as watched through their completed status", () => {
  assert.match(home, /m\.type === "movie" && statusForId\(simklStatusMap, m\.id\) === "completed"/);
});

test("watched matching bridges imdb and tmdb ids", () => {
  assert.match(watchedTitle, /function watchedIdCandidates/);
  assert.match(watchedTitle, /tmdbImdbCached\(id\)/);
  assert.match(watchedTitle, /tmdbFromImdbCached\(id\)/);
});

test("catalog rows and the hero share one watched predicate", () => {
  assert.match(customRows, /from "@\/lib\/watched-title"/);
  assert.doesNotMatch(
    customRows,
    /function metaTitleKey/,
    "the row predicate must use the shared helper, not a private copy",
  );
});
