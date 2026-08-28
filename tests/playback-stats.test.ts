// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the stats overlay asks the backend for one complete snapshot", () => {
  const overlay = read("src/components/player/stats-overlay.tsx");

  assert.match(overlay, /invoke<MpvPlaybackStats>\("mpv_playback_stats"\)/);
  assert.doesNotMatch(overlay, /getProp\(/);
  assert.match(overlay, /Streaming & renderer/);
  assert.match(overlay, /Source colour/);
  assert.match(overlay, /Cached data/);
});

test("the backend exposes safe detailed data from the active mpv session", () => {
  const backend = read("src-tauri/src/mpv.rs");
  const registry = read("src-tauri/src/lib.rs");

  assert.match(backend, /pub async fn mpv_playback_stats/);
  assert.match(backend, /pub struct MpvPlaybackStats/);
  assert.match(backend, /decoder-frame-drop-count/);
  assert.match(backend, /demuxer-cache-state/);
  assert.match(backend, /video-target-params\/gamma/);
  assert.match(registry, /mpv::mpv_playback_stats/);
});
