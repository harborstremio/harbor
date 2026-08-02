// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const src = readFileSync(new URL("../src/lib/subtitles/providers/addons.ts", import.meta.url), "utf8");

test("an addon that declares subtitles is never dropped for manifest metadata", () => {
  assert.match(src, /function declaresSubtitles/, "needs a resource-level check");
  assert.match(
    src,
    /if \(!declaresSubtitles\(addon\)\) return null;/,
    "only addons without the subtitles resource may be skipped",
  );
  const pick = src.slice(src.indexOf("function pickAddonId"), src.indexOf("function extraSegment"));
  const lastReturn = pick.lastIndexOf("return best;");
  assert.ok(lastReturn > 0, "pickAddonId must fall through to a best-effort id");
});

test("the strict manifest match is still tried first", () => {
  const pick = src.slice(src.indexOf("function pickAddonId"), src.indexOf("function extraSegment"));
  const strict = pick.indexOf("addonAccepts(addon");
  const permissive = pick.indexOf("declaresSubtitles(addon)");
  assert.ok(strict >= 0 && permissive >= 0);
  assert.ok(strict < permissive, "advertised ids must win before falling back");
});

test("addons providing no subtitles resource are still excluded", () => {
  assert.match(src, /if \(!declaresSubtitles\(addon\)\) return null;/);
});

const modal = readFileSync(
  new URL("../src/components/player/subtitle-menu/search-section.tsx", import.meta.url),
  "utf8",
);

test("the player subtitle modal passes the playing content ids to addons", () => {
  assert.match(modal, /candidateIds: playing\?\.candidateIds/, "anime and non-imdb ids must reach addons");
  assert.match(modal, /stremioId: playing\?\.stremioId/, "stremioId is the addon fallback id");
});

test("the modal only reuses playing ids when the target is what is playing", () => {
  assert.match(modal, /isPlayingTarget\(tgt, playingTarget\) \? playbackContext : null/);
  assert.doesNotMatch(
    modal,
    /!isOverride \? playbackContext/,
    "isOverride is stale inside run(), the target must be compared directly",
  );
});

const source = readFileSync(new URL("../src/lib/subtitles/addon-source.ts", import.meta.url), "utf8");

test("one slow addon manifest cannot drop every other local addon", () => {
  assert.doesNotMatch(
    source,
    /withSubtitleTimeout\(\s*Promise\.all\(/,
    "a shared timeout around Promise.all loses all locals when one hangs",
  );
  assert.match(source, /localOnly\.map\(\(l\): Promise<Addon \| null> =>/);
});

test("a cached manifest resolves without any network wait", () => {
  assert.match(source, /if \(l\.manifest\) return Promise\.resolve\(/);
});
