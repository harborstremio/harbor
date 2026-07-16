// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const navigationSource = readFileSync(
  new URL("../src/lib/keyboard-navigation.ts", import.meta.url),
  "utf8",
);

test("TV focus waits for navigation intent before applying page defaults", () => {
  assert.match(navigationSource, /let hasTvNavigationIntent = false/);
  assert.match(navigationSource, /if \(!hasTvNavigationIntent\) return/);
  assert.match(navigationSource, /export function moveFocus[\s\S]*?hasTvNavigationIntent = true;/);
});

test("TV focus styling uses one theme-aware ring without hard-coded white layers", () => {
  const injectedStyles = navigationSource.match(/style\.textContent = `([\s\S]*?)`;/)?.[1];

  assert.ok(injectedStyles, "keyboard navigation focus styles must exist");
  assert.match(injectedStyles, /var\(--color-accent\)/);
  assert.doesNotMatch(injectedStyles, /#ffffff|#fff\b/i);
  assert.doesNotMatch(injectedStyles, /0 0 0 8px|0 0 0 9px/);
});
