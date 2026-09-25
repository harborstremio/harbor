// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import { selectMenuFocusTarget as select } from "../src/components/context-menu/menu-surface.tsx";

test("a focused action keeps focus when menu actions reorder", () => {
  assert.equal(select(["a", "b", "c"], ["c", "b", "a"], "b"), "b");
});
test("a removed or disabled action focuses its next surviving neighbor", () => {
  assert.equal(select(["a", "b", "c", "d"], ["new", "a", "d"], "b"), "d");
});
test("removing the final action returns focus to the preceding surviving action", () => {
  assert.equal(select(["a", "b", "c"], ["a", "new"], "c"), "a");
});
test("replacing every action focuses the first new available action", () => {
  assert.equal(select(["a", "b"], ["new", "other"], "b"), "new");
});
test("an empty action list has no focusable action", () => {
  assert.equal(select(["a"], [], "a"), null);
});
