// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const source = read("src/lib/skip-intro/index.ts");
const identity = read("src/lib/streams/anime-identity.ts");

test("the eligibility gate already accepts tt and tmdb series", () => {
  // AIOMetadata and Cinemeta both hand out tt ids for series, which left AniSkip unused.
  assert.match(identity, /metaId\.startsWith\("tt"\) \|\| metaId\.startsWith\("tmdb:tv:"\)/);
  assert.match(identity, /if \(episode\.kitsuStreamId != null\) return false;/,
    "an id that already names its entry needs no mapping");
});

test("AniSkip is no longer keyed off the raw kitsu id alone", () => {
  assert.match(source, /aniSkipKitsuId = kitsuId \?\? mapped\?\.kitsuId/);
  assert.match(source, /kitsuToMal\(aniSkipKitsuId\)/, "the lookup must use the resolved entry");
  assert.match(
    source,
    /fetchAniSkipSegments\(malId, aniSkipEpisode, durationSec\)/,
    "AniSkip counts episodes within the entry, not the IMDb season",
  );
});

test("prefetch warms the same mapping the player will use", () => {
  const prefetch = source.slice(source.indexOf("export function prefetchSegments"));
  assert.match(prefetch, /animeIdentityEligible\(meta\.id, episode\)/);
  assert.match(prefetch, /identity\.number/, "prefetch must request the entry-relative episode");
});
