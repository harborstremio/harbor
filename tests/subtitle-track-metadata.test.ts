// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const mpv = readFileSync(new URL("../src/lib/player/mpv.ts", import.meta.url), "utf8");
const selection = readFileSync(
  new URL("../src/lib/subtitles/track-selection.ts", import.meta.url),
  "utf8",
);
const html5 = readFileSync(new URL("../src/lib/player/html5/bridge.ts", import.meta.url), "utf8");

test("Windows path separators cannot drop loaded subtitle metadata", () => {
  assert.ok(
    mpv.includes(String.raw`externalFilename.replace(/\\/g, "/")`),
    "the track-list lookup must normalize mpv's Windows path separators",
  );
});

test("automatic subtitle selection excludes known incompatible releases", () => {
  assert.match(selection, /track\.matchConfidence !== "incompatible"/);
  assert.match(selection, /if \(eligible\.length === 0\) return null/);
  assert.match(selection, /subtitleConfidenceRank/);
});

test("subtitle load failures do not print private subtitle URLs", () => {
  assert.match(html5, /failed to load track/);
  assert.doesNotMatch(html5, /failed to load \$\{track\.url\}/);
});
