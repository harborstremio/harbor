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
