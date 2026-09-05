// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function body(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing ${signature}`);
  const end = source.indexOf("\n}\n", start);
  assert.ok(end > start, `unterminated ${signature}`);
  return source.slice(start, end);
}

const stateSource = read("../src/lib/fullscreen-state.ts");
const hookSource = read("../src/views/player/hooks/use-fullscreen.ts");
const settingsSource = read("../src/views/settings/player-panel/play-mode-section.tsx");

test("fullscreen state offers three distinct window modes", () => {
  assert.match(
    stateSource,
    /export type FullscreenMode = "fullscreen" \| "borderless" \| "maximized";/,
  );
  assert.match(stateSource, /value === "maximized" \|\| value === "borderless"/);
});

test("borderless covers the current monitor with an undecorated window", () => {
  const enter = body(stateSource, "async function enterBorderless()");
  assert.match(enter, /await currentMonitor\(\)/);
  assert.match(enter, /setDecorations\(false\)/);
  assert.match(enter, /new PhysicalSize\(monitor\.size\.width, monitor\.size\.height\)/);
  assert.match(enter, /new PhysicalPosition\(monitor\.position\.x, monitor\.position\.y\)/);
  assert.doesNotMatch(enter, /window_fullscreen_enter/);
  assert.doesNotMatch(enter, /setFullscreen\(true\)/);
});

test("leaving borderless restores decorations and the saved geometry", () => {
  assert.match(stateSource, /async function exitBorderless\(\)/);
  assert.match(stateSource, /setDecorations\(loadStoredSettings\(\)\.useNativeTitleBar === true\)/);
  assert.match(stateSource, /setSize\(new PhysicalSize\(saved\.w, saved\.h\)\)/);
  assert.match(stateSource, /loadStoredSettings\(\)\.fullscreenRestorePosition === false/);
});

test("maximize mode uses a granted window permission, not the ungranted maximize command", () => {
  assert.match(stateSource, /async function setMaximized\(on: boolean\)/);
  assert.match(stateSource, /isMaximized\(\)[\s\S]{0,40}!== on\) await win\.toggleMaximize\(\)/);
  assert.doesNotMatch(stateSource, /win\.maximize\(\)/);
  assert.doesNotMatch(stateSource, /win\.unmaximize\(\)/);
});

test("the player reasserts the chosen mode instead of forcing true fullscreen", () => {
  assert.match(hookSource, /reassertFullscreenMode/);
  assert.doesNotMatch(hookSource, /invoke\("window_fullscreen_enter"\)/);
  assert.match(stateSource, /export async function reassertFullscreenMode\(\)/);
  assert.match(stateSource, /if \(borderlessActive\) \{\s*await reassertBorderless\(\);/);
});

test("a borderless session survives a stray DOM fullscreenchange", () => {
  assert.match(hookSource, /if \(isBorderlessFullscreen\(\)\) return;/);
});

test("exiting any fullscreen also leaves borderless", () => {
  assert.match(stateSource, /if \(windowFullscreen \|\| borderlessActive\) await exitWindowFullscreen\(\);/);
});

test("the fullscreen mode setting exposes borderless to the user", () => {
  assert.match(settingsSource, /\{ value: "fullscreen", label: t\("True fullscreen"\) \}/);
  assert.match(settingsSource, /\{ value: "borderless", label: t\("Borderless window"\) \}/);
  assert.match(settingsSource, /\{ value: "maximized", label: t\("Maximize"\) \}/);
  assert.match(settingsSource, /normalizeFullscreenMode\(settings\.fullscreenMode\)/);
});
