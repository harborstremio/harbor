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
  const workerEngine = read("src/lib/face/face-worker-engine.ts");
  const overlay = read("src/components/player/xray/xray-overlay.tsx");

  assert.match(scan, /const SCAN_MS = 4000/);
  assert.match(scan, /!ready \|\| !liveScan \|\| isPaused/);
  assert.match(scan, /document\.visibilityState !== "visible"/);
  assert.match(capture, /const DETECT_WIDTH = 640/);
  assert.match(gallery, /const MAX_CAST = 24/);
  assert.match(gallery, /const PRIMARY_CONCURRENCY = 1/);
  assert.match(gallery, /const BACKGROUND_CONCURRENCY = 1/);
  assert.match(engine, /new Worker/);
  assert.match(workerEngine, /ort\.env\.wasm\.numThreads = 1/);
  assert.match(overlay, /const liveScan = view === "rail" && settings\.xrayLiveScan/);
  assert.doesNotMatch(overlay, /onPointerEnter=.*ensureFaceEngine/);
});

test("the X-Ray cast rail still works when live face scanning is disabled", () => {
  const rail = read("src/components/player/xray/xray-rail.tsx");

  assert.match(rail, /liveScan: boolean/);
  assert.match(rail, /const canMatch = liveScan && !error && !emptyGallery/);
  assert.match(rail, /const status = !liveScan/);
});

test("X-Ray remains interactive on the separate embedded-HDR control surface", () => {
  const overlay = read("src/components/player/xray/xray-overlay.tsx");
  const hdrOverlay = read("src/views/hdr-overlay-app.tsx");
  const hdrBridge = read("src/views/player/hdr-stage-bridge.tsx");
  const player = read("src/views/player.tsx");

  assert.match(overlay, /pointer-events-auto/);
  assert.match(overlay, /event\.stopPropagation\(\)/);
  assert.match(hdrOverlay, /<XrayOverlay/);
  assert.match(hdrOverlay, /!payload\.pipMode/);
  assert.match(hdrOverlay, /window\.setInterval\(ready, 4000\)/);
  assert.doesNotMatch(hdrBridge, /setInterval\(\(\) => void hdrOverlayEmitProps/);
  assert.match(hdrBridge, /subscribePlaybackClock/);
  assert.match(hdrBridge, /hdrOverlayEmitClock/);
  assert.match(hdrBridge, /!active \|\| !payload\.visible/);
  assert.match(hdrOverlay, /onHdrStageClock/);
  assert.match(hdrOverlay, /setPlaybackClock\(positionSec, bufferedSec\)/);
  assert.match(player, /function useHdrChromeSnapshot/);
  assert.match(player, /subText: ""/);
  assert.match(player, /secondarySubText: ""/);
});

test("routine playback housekeeping never captures full mpv frames", () => {
  const snapshots = read("src/views/player/hooks/use-exit-snapshot.ts");
  const memory = read("src/views/player/hooks/use-webview-memory.ts");
  const maintenance = read("src/lib/maintenance.ts");
  const nativeMemory = read("src/lib/native-memory.ts");

  assert.match(snapshots, /grabFrame\(false, true\)/);
  assert.match(snapshots, /const PASSIVE_REFRESH_MS = 60000/);
  assert.doesNotMatch(snapshots, /const CACHE_MS = 12000/);
  assert.match(memory, /POST_PLAYBACK_MAINTENANCE_DELAY_MS/);
  assert.doesNotMatch(memory, /setInterval\(\(\) => pulseWebviewMemoryLow/);
  assert.match(maintenance, /if \(playbackActive\) return/);
  assert.match(maintenance, /if \(!playbackActive\) pulseWebviewMemoryLow\(\)/);
  assert.match(nativeMemory, /intervalMs = active \? 15000 : 8000/);
});

test("normal mpv playback avoids per-subtitle oversized buffers and disk cache retries", () => {
  const mpv = read("src-tauri/src/mpv.rs");

  assert.match(mpv, /set\("msg-level", "all=warn"\)/);
  assert.match(mpv, /set\("cache-on-disk", if full_download \{ "yes" \} else \{ "no" \}\)/);
  assert.match(mpv, /set\("cache-dir", path\)/);
  assert.doesNotMatch(mpv, /mpv\.set_property\("cache-dir"/);
  assert.match(mpv, /set_property\("stream-buffer-size", "4MiB"\)/);
  assert.doesNotMatch(mpv, /set_property\("stream-buffer-size", "32MiB"\)/);
  assert.match(mpv, /set_property\("cache-pause-initial", "no"\)/);
  assert.match(mpv, /if high_bitrate \{[\s\S]*"2"[\s\S]*\} else \{[\s\S]*"1"/);
});

test("the expensive D3D11 compatibility presenter is opt-in for new and existing profiles", () => {
  const defaults = read("src/lib/settings/defaults.ts");
  const load = read("src/lib/settings/load.ts");
  const panel = read("src/views/settings/player-panel/engine-section.tsx");

  assert.match(defaults, /playerD3d11Flip: false/);
  assert.match(load, /_d3d11FlipSafeDefaultV1/);
  assert.match(load, /parsed\.playerD3d11Flip = false/);
  assert.match(panel, /4K playback can drop to a slideshow/);
  assert.match(panel, /Leave OFF unless you see that line/);
});

test("background diagnostics and controller discovery do not busy-poll during playback", () => {
  const nativeMemory = read("src/lib/native-memory.ts");
  const procMem = read("src-tauri/src/proc_mem.rs");
  const gamepad = read("src-tauri/src/gamepad.rs");
  const autoDownloads = read("src/lib/auto-download/runner.ts");
  const reminders = read("src/lib/reminders-runner.tsx");
  const app = read("src/App.tsx");

  assert.match(nativeMemory, /sampling \|\| playbackActive/);
  assert.match(nativeMemory, /if \(!active\) void sample\(\)/);
  assert.match(procMem, /spawn_blocking\(read\)/);
  assert.match(gamepad, /next_event_blocking/);
  assert.doesNotMatch(gamepad, /sleep\(Duration::from_millis\(8\)\)/);
  assert.match(autoDownloads, /if \(playbackActive\)/);
  assert.match(reminders, /if \(suspended\) return/);
  assert.match(app, /useAutoDownloadRunner\(settings\.backgroundNetworkActivity, !!player\)/);
  assert.match(app, /<RemindersRunner suspended=\{!!player\}/);
  assert.match(app, /if \(player\) return/);
  assert.match(app, /return player \? null : <ActivitySyncActive \/>/);
  assert.match(app, /return player \? null : <RatingsSyncActive \/>/);
  assert.match(app, /return player \? null : <FeaturedListsSyncActive \/>/);
});
