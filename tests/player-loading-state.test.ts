// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const nativeMpvSource = readFileSync(new URL("../src-tauri/src/mpv.rs", import.meta.url), "utf8");
const mpvBridgeSource = readFileSync(new URL("../src/lib/player/mpv.ts", import.meta.url), "utf8");
const autoTransitionSource = readFileSync(
  new URL("../src/views/play-picker/auto-play-transition.tsx", import.meta.url),
  "utf8",
);
const cinematicLoaderSource = readFileSync(
  new URL("../src/views/player/cinematic-player-loader.tsx", import.meta.url),
  "utf8",
);
const playerOverlayLayersSource = readFileSync(
  new URL("../src/views/player/player-overlay-layers.tsx", import.meta.url),
  "utf8",
);
const bufferingIndicatorSource = readFileSync(
  new URL("../src/views/player/buffering-indicator.tsx", import.meta.url),
  "utf8",
);
const controlRendererSource = readFileSync(
  new URL("../src/components/player/transport/control-renderer.tsx", import.meta.url),
  "utf8",
);
const stremioButtonSource = readFileSync(
  new URL("../src/components/player/transport/stremio-btn.tsx", import.meta.url),
  "utf8",
);
const fullscreenSource = readFileSync(
  new URL("../src/views/player/hooks/use-fullscreen.ts", import.meta.url),
  "utf8",
);

test("native mpv buffering is published through the player snapshot", () => {
  assert.match(nativeMpvSource, /\("paused-for-cache",\s*\d+,\s*PropertyKind::Flag\)/);
  assert.match(mpvBridgeSource, /name === "paused-for-cache"/);
  assert.match(mpvBridgeSource, /snap\.buffering\s*=\s*data/);
});

test("automatic selection and player loading share one visual language", () => {
  assert.match(autoTransitionSource, /LoaderLogoOrText/);
  assert.match(autoTransitionSource, /t\("Selecting best source"\)/);
  assert.match(cinematicLoaderSource, /t\("Loading video"\)/);
});

test("playback stalls use a distinct quiet buffering indicator", () => {
  assert.match(playerOverlayLayersSource, /BufferingIndicator/);
  assert.match(playerOverlayLayersSource, /buffering=\{p\.snap\.buffering\}/);
  assert.match(playerOverlayLayersSource, /suppressed=\{p\.loaderActive/);
  assert.doesNotMatch(bufferingIndicatorSource, /HarborLoader/);
  assert.match(bufferingIndicatorSource, /createPortal/);
  assert.match(bufferingIndicatorSource, /\[data-player-play-pause\]/);
  assert.match(bufferingIndicatorSource, /motion-safe:animate-spin/);
  assert.match(controlRendererSource, /data-player-play-pause/);
  assert.match(stremioButtonSource, /data-player-play-pause/);
});

test("fullscreen only reapplies WebView transparency for embedded mpv", () => {
  assert.match(
    fullscreenSource,
    /dataset\.mpvEmbed === "1"[\s\S]*?invoke\("webview_reapply_transparency"\)/,
  );
});
