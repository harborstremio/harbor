// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const player = readFileSync(new URL("../src/views/player.tsx", import.meta.url), "utf8");

test("holding the primary left mouse button temporarily uses at least 2x speed", () => {
  assert.match(player, /e\.pointerType !== "mouse"/);
  assert.match(player, /!e\.isPrimary/);
  assert.match(player, /e\.button !== 0/);
  assert.match(player, /setRate\(Math\.max\(2, hold\.baseRate\)\)/);
  assert.match(player, /}, 350\);/);
});

test("mouse hold restores the previous rate and cannot pause playback on release", () => {
  assert.match(player, /bridgeRef\.current\?\.setRate\(hold\.baseRate\)/);
  assert.match(player, /releaseMouseHoldSpeed\(true\)/);
  assert.match(player, /if \(suppressMouseClickRef\.current\)/);
  assert.match(player, /holdSpeedActive: holdSpeedActive \|\| mouseHoldSpeedActive/);
});

test("mouse hold is released when the pointer is cancelled or capture is lost", () => {
  assert.match(player, /onPointerCancel=/);
  assert.match(player, /onLostPointerCapture=/);
  assert.match(player, /if \(hold\.engaged\) \{\s*bridgeRef\.current\?\.setRate\(hold\.baseRate\)/);
});
