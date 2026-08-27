// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { findActiveCue } from "../src/lib/subtitles/parser.ts";
import { applyLinear } from "../src/lib/subtitles/text-sync.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("live sync moves the selected cue to the moment it was heard", () => {
  const corrected = applyLinear(
    [{ start: 10, end: 12, text: "The line being heard" }],
    [{ t: 10, at: 15 }],
    0,
    [],
  );

  assert.deepEqual(corrected, [{ start: 15, end: 17, text: "The line being heard" }]);
  assert.equal(findActiveCue(corrected, 15.5)?.text, "The line being heard");
});

test("two live-sync points correct gradual subtitle drift", () => {
  const corrected = applyLinear(
    [
      { start: 10, end: 12, text: "Early line" },
      { start: 110, end: 112, text: "Late line" },
    ],
    [
      { t: 10, at: 12 },
      { t: 110, at: 116 },
    ],
    0,
    [],
  );

  assert.equal(corrected[0].start, 12);
  assert.equal(corrected[1].start, 116);
});

test("the subtitle menu exposes live sync through inline and overlay layouts", () => {
  const menu = read("src/components/player/subtitle-menu.tsx");
  const body = read("src/components/player/subtitle-menu/menu-body.tsx");
  const modal = read("src/views/modal-overlay-app.tsx");

  assert.match(body, /onEnterSync=\{props\.onEnterSync\}/);
  assert.match(menu, /modal:\/\/subtitle\/live-sync/);
  assert.match(modal, /modal:\/\/subtitle\/live-sync/);
});

test("live sync uses plain-language anchors and a three-step section fix", () => {
  const list = read("src/views/player/text-sync-list.tsx");
  const overlay = read("src/views/player/text-sync-overlay.tsx");
  const hook = read("src/views/player/hooks/use-text-sync.ts");

  assert.match(list, /t\("Aligned"\)/);
  assert.match(list, /t\("Drift fixed"\)/);
  assert.match(list, /t\("Align to now"\)/);
  assert.match(hook, /rangeStart: i, rangeEnd: null/);
  assert.match(list, /else if \(rangeEnd == null\) onRangeEnd\(i\)/);
  assert.match(list, /else setSelected/);
  assert.match(overlay, /api\.rangeStart == null/);
  assert.match(overlay, /api\.rangeEnd == null/);
});

test("saving live sync keeps the corrected track selected with its source metadata", () => {
  const hook = read("src/views/player/hooks/use-text-sync.ts");
  const overlay = read("src/views/player/text-sync-overlay.tsx");

  assert.match(hook, /sourceTrack = s\.subtitleTracks\.find\(\(track\) => track\.selected\)/);
  assert.match(hook, /b\.addSubtitle\(path, source\?\.lang, title, true/);
  assert.match(hook, /matchConfidence: "exact"/);
  assert.match(hook, /provider: "Harbor Live Sync"/);
  assert.match(hook, /b\.setSubDelay\(previewDelay\)/);
  assert.match(hook, /onSavedTrackRef\.current\?\.\(\{/);
  assert.match(hook, /appDataDir\(\)/);
  assert.doesNotMatch(hook, /downloadText/);
  assert.match(overlay, /const result = await api\.save\(\)/);
  assert.match(overlay, /role="alert"/);
});

test("subtitle rows expose evidence only through the keyboard-accessible details button", () => {
  const row = read("src/components/player/subtitle-menu/variant-row.tsx");
  const search = read("src/components/player/subtitle-menu/search-results.tsx");
  const menu = read("src/components/context-menu.tsx");

  assert.doesNotMatch(row, /onContextMenu=/);
  assert.match(row, /openAt\(\{ x: rect\.right, y: rect\.bottom \}, contextTarget\)/);
  assert.doesNotMatch(search, /onContextMenu=/);
  assert.match(search, /aria-label=\{t\("Open subtitle details"\)\}/);
  assert.match(menu, /aria-label=\{t\("Back"\)\}/);
  assert.match(menu, /onClick=\{onBack\}/);
  assert.match(menu, /This is a metadata-based release estimate, not a measured timing score\./);
});
