// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the subtitle picker loads and displays every available language", () => {
  const menu = read("src/components/player/subtitle-menu/menu-body.tsx");
  const autoload = read("src/views/player/hooks/use-track-autoload.ts");
  const fetcher = read("src/lib/subtitles/fetch-into-player.ts");
  const search = read("src/components/player/subtitle-menu/search-section.tsx");

  assert.doesNotMatch(menu, /filterTracksByPreferredLanguage/);
  assert.match(menu, /const languageTracks = tracks;/);
  assert.match(autoload, /searchLangs: \[\],/);
  assert.match(fetcher, /langs: p\.searchLangs \?\? p\.langs/);
  assert.doesNotMatch(fetcher, /const matches = results\.filter/);
  assert.match(fetcher, /const fresh = results\.filter/);
  assert.match(fetcher, /loadFirstWorkingSubtitle\(preferredFresh/);
  assert.match(search, /langs: \[\],/);
});
