// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  ANI_ZIP_TRANSIENT_CACHE_TTL_MS,
  aniZipCacheExpiresAt,
} from "../src/lib/providers/anizip-cache-policy.ts";

const NOW = 1_700_000_000_000;

test("keeps only mappings with a usable title for every episode indefinitely", () => {
  assert.equal(
    aniZipCacheExpiresAt(
      {
        episodes: {
          "1": { episodeNumber: 1, title: { en: "A Beginning" } },
          "2": { episodeNumber: 2, titles: { ja: "続き" } },
        },
      },
      NOW,
    ),
    null,
  );
});

test("expires 404 and incomplete mappings after the bounded retry window", () => {
  assert.equal(aniZipCacheExpiresAt(null, NOW), NOW + ANI_ZIP_TRANSIENT_CACHE_TTL_MS);
  assert.equal(
    aniZipCacheExpiresAt({ episodes: {} }, NOW),
    NOW + ANI_ZIP_TRANSIENT_CACHE_TTL_MS,
  );
  assert.equal(
    aniZipCacheExpiresAt(
      {
        episodes: {
          "1": { episodeNumber: 1, title: { en: "A Beginning" } },
          "2": { episodeNumber: 2, title: { en: "Episode 2" } },
        },
      },
      NOW,
    ),
    NOW + ANI_ZIP_TRANSIENT_CACHE_TTL_MS,
  );
});
