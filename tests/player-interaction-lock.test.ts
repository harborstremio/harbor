// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(at(path), "utf8");

const hotkeys = read("src/lib/hotkeys.ts");
const lockHook = read("src/views/player/hooks/use-player-interaction-lock.ts");
const player = read("src/views/player.tsx");
const hdrOverlay = read("src/views/hdr-overlay-app.tsx");
const mediaSession = read("src/lib/media-session.ts");
const html5Bridge = read("src/lib/player/html5/bridge.ts");
const keyboardShortcuts = read("src/views/player/hooks/use-keyboard-shortcuts.ts");
const defaults = read("src/lib/settings/defaults.ts");
const playerLayout = read("src/views/settings/player-layout-panel/index.tsx");

test("player lock is configurable and has a deliberate default shortcut", () => {
  assert.match(hotkeys, /id: "playerScreenLock"/);
  assert.match(hotkeys, /defaultBinding: "ctrl\+l"/);
  assert.match(lockHook, /effectiveBinding\("playerScreenLock"/);
  assert.match(defaults, /playerScreenLockEnabled: false/);
  assert.match(playerLayout, /value=\{settings\.playerScreenLockEnabled\}/);
});

test("locked playback captures pointer and keyboard input while preserving unlock access", () => {
  assert.match(lockHook, /data-player-unlock-control/);
  assert.match(lockHook, /capture: true/);
  assert.match(lockHook, /stopImmediatePropagation\(\)/);
  assert.match(lockHook, /window\.addEventListener\("pointerdown"/);
  assert.match(lockHook, /window\.addEventListener\("keydown"/);
  assert.match(lockHook, /LOCK_CONTROL_IDLE_MS/);
  assert.match(lockHook, /onLockedActivity/);
  assert.match(lockHook, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.doesNotMatch(lockHook, /keyboardActivatesUnlock/);
  assert.match(keyboardShortcuts, /if \(isPlayerInteractionLocked\(\)\)/);
});

test("screen lock covers TV navigation, media keys, HTML5 media session, and HDR chrome", () => {
  assert.match(player, /settings\.playerTvNavigation && !screenLocked/);
  assert.match(mediaSession, /isPlayerInteractionLocked\(\)/);
  assert.match(html5Bridge, /if \(isPlayerInteractionLocked\(\)\) return/);
  assert.match(hdrOverlay, /usePlayerInteractionBlocker/);
  assert.match(hdrOverlay, /PlayerInteractionLockControls/);
  assert.match(hdrOverlay, /screenLockControlsVisible/);
});
