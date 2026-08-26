// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("closing to the tray pauses active mpv playback before the window is hidden", () => {
  const app = read("src-tauri/src/lib.rs");
  const tray = read("src-tauri/src/tray.rs");
  const mpv = read("src-tauri/src/mpv.rs");
  const hook = read("src/views/player/hooks/use-pause-on-inactive.ts");
  const start = app.indexOf("if tray::close_to_tray()");
  const closeToTray = app.slice(start, app.indexOf("} else if", start));

  assert.match(tray, /pub fn pause_when_minimized\(\) -> bool/);
  assert.match(mpv, /pub fn pause_for_background\(state: &MpvState\) -> Option<bool>/);
  assert.match(closeToTray, /mpv::pause_for_background/);
  assert.match(closeToTray, /"wasPlaying"/);
  assert.ok(closeToTray.indexOf("mpv::pause_for_background") < closeToTray.indexOf("window.hide()"));
  assert.match(hook, /wasPlaying\?: boolean/);
  assert.match(hook, /wasPlaying \?\? snapRef\.current\.status === "playing"/);
});

test("X-Ray leaves processor and renderer headroom during playback", () => {
  const scan = read("src/lib/face/use-face-id.ts");
  const capture = read("src/lib/face/face-capture.ts");
  const gallery = read("src/lib/face/cast-embeddings.ts");
  const engine = read("src/lib/face/face-engine.ts");
  const overlay = read("src/components/player/xray/xray-overlay.tsx");

  assert.match(scan, /const SCAN_MS = 4000/);
  assert.match(scan, /!ready \|\| !liveScan \|\| isPaused/);
  assert.match(scan, /document\.visibilityState !== "visible"/);
  assert.match(capture, /const DETECT_WIDTH = 640/);
  assert.match(gallery, /const MAX_CAST = 24/);
  assert.match(gallery, /const CONCURRENCY = 1/);
  assert.match(engine, /Math\.min\(2, \(navigator\.hardwareConcurrency \|\| 2\) - 1\)/);
  assert.match(overlay, /const liveScan = view === "rail" && settings\.xrayLiveScan/);
  assert.doesNotMatch(overlay, /onPointerEnter=.*ensureFaceEngine/);
});

test("the X-Ray cast rail still works when live face scanning is disabled", () => {
  const rail = read("src/components/player/xray/xray-rail.tsx");

  assert.match(rail, /liveScan: boolean/);
  assert.match(rail, /const canMatch = liveScan && !error && !emptyGallery/);
  assert.match(rail, /const status = !liveScan/);
});
