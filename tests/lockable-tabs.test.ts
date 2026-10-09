// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { anyTabLocked, DEFAULT_HIDDEN } from "../src/lib/lockable-tabs.ts";

test("a saved Sports restriction does not lock a profile after Sports is removed", () => {
  const savedTabs = { ...DEFAULT_HIDDEN, sports: true };
  assert.equal(anyTabLocked(savedTabs), false);
});

test("current tab restrictions still lock a profile with legacy Sports preferences", () => {
  const savedTabs = { ...DEFAULT_HIDDEN, sports: true, movies: true };
  assert.equal(anyTabLocked(savedTabs), true);
});
