// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  readSubtitleSearchCacheEntry,
  SUBTITLE_SEARCH_CACHE_TTL_MS,
  subtitleSearchCacheKey,
  subtitleSearchResultsMayBeCached,
  type SubtitleSearchCacheScope,
} from "../src/lib/subtitles/search-cache.ts";
import type { SubResult } from "../src/lib/subtitles/types.ts";

const baseScope: SubtitleSearchCacheScope = {
  languages: ["ar", "en"],
  providers: {
    wyzie: false,
    addons: true,
    opensubtitles: true,
    subdl: false,
    subsource: false,
  },
  addonUrls: ["https://addon.test/manifest.json"],
  credentialBound: false,
};

const target = {
  imdbId: "tt1234567",
  type: "series" as const,
  title: "Show",
  season: 1,
  episode: 2,
  filename: "Show.S01E02.WEB-DL.mkv",
};

const result: SubResult = {
  id: "one",
  url: "https://subs.test/one.srt",
  lang: "ar",
  source: "opensubtitles",
};

test("manual subtitle cache identity covers language, providers, and addon configuration", () => {
  const key = subtitleSearchCacheKey({ ...target, scope: baseScope });
  assert.notEqual(
    key,
    subtitleSearchCacheKey({
      ...target,
      scope: { ...baseScope, languages: ["en", "ar"] },
    }),
  );
  assert.notEqual(
    key,
    subtitleSearchCacheKey({
      ...target,
      scope: {
        ...baseScope,
        providers: { ...baseScope.providers, opensubtitles: false },
      },
    }),
  );
  assert.notEqual(
    key,
    subtitleSearchCacheKey({
      ...target,
      scope: { ...baseScope, addonUrls: ["https://other.test/manifest.json"] },
    }),
  );
});

test("credential-bound or opaque-auth results never enter the UI cache", () => {
  assert.equal(
    subtitleSearchResultsMayBeCached({ ...baseScope, credentialBound: true }, [result]),
    false,
  );
  assert.equal(
    subtitleSearchResultsMayBeCached(baseScope, [
      { ...result, downloadAuth: "opaque-native-handle" },
    ]),
    false,
  );
});

test("manual subtitle cache entries expire and reject legacy auth-bearing data", () => {
  const now = 1_000_000;
  assert.deepEqual(readSubtitleSearchCacheEntry({ results: [result], createdAt: now }, now + 1), [
    result,
  ]);
  assert.equal(
    readSubtitleSearchCacheEntry(
      { results: [result], createdAt: now },
      now + SUBTITLE_SEARCH_CACHE_TTL_MS,
    ),
    null,
  );
  assert.equal(
    readSubtitleSearchCacheEntry({
      results: [{ ...result, downloadAuth: "expired-handle" }],
      createdAt: now,
    }),
    null,
  );
});
