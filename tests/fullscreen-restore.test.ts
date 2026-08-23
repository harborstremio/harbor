// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const fullscreenStateSource = readFileSync(
  new URL("../src/lib/fullscreen-state.ts", import.meta.url),
  "utf8",
);
const nativeFullscreenSource = readFileSync(
  new URL("../src-tauri/src/fullscreen.rs", import.meta.url),
  "utf8",
);

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}

test("native fullscreen exits use the restoration command", () => {
  const exitBody = functionBody(fullscreenStateSource, "exitAnyFullscreen");
  assert.match(exitBody, /await exitWindowFullscreen\(\)/);
  assert.doesNotMatch(exitBody, /setFullscreen\(false\)/);
});

test("native fullscreen transitions serialize saved window state", () => {
  assert.match(nativeFullscreenSource, /tokio::sync::Mutex/);
  assert.match(nativeFullscreenSource, /state\.saved\.lock\(\)\.await/);
  assert.match(nativeFullscreenSource, /saved\.take\(\)/);
});
