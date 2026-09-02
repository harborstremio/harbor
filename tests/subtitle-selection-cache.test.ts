// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { selectedSubtitleCacheName } from "../src/lib/subtitles/selected-subtitle-cache.ts";

test("selected subtitle cache paths are stable per content, release, and subtitle", () => {
  const choice = {
    source: "https://cdn.example.test/subtitles/arabic.zip?token=secret",
    provider: "SubSource",
    subId: "subsource:42",
  };
  const first = selectedSubtitleCacheName("tt123|1|2", "torrent:abc:0", choice, "srt");
  const again = selectedSubtitleCacheName("tt123|1|2", "torrent:abc:0", choice, "srt");
  const otherEpisode = selectedSubtitleCacheName("tt123|1|3", "torrent:abc:0", choice, "srt");

  assert.equal(first, again);
  assert.notEqual(first, otherEpisode);
  assert.match(first, /^selected-[a-f0-9]{8}\.srt$/);
  assert.doesNotMatch(first, /token|secret|subsource/i);
});

test("manual subtitle persistence caches only the latest selected external track", () => {
  const controls = readFileSync(
    new URL("../src/views/player/hooks/use-playback-controls.ts", import.meta.url),
    "utf8",
  );

  assert.match(controls, /const revision = \+\+subtitleCacheContextRef\.current\.revision/);
  assert.match(controls, /subtitleCacheContextRef\.current\.revision !== revision/);
  assert.match(controls, /cacheSelectedSubtitle\(\{/);
  assert.match(controls, /getSelectedTrackUrl\(\)/);
  assert.match(controls, /getSelectedTrackCues\(\)/);
  assert.match(controls, /imported && subtitleSourceIsLocal\(source\)/);
});
