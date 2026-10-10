// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { replaceUrlsInOrder } from "../src/lib/addons-store/reorder.ts";

test("addon replacement keeps its position and removes retired URLs", () => {
  assert.deepEqual(replaceUrlsInOrder(["b", "old-a", "c"], ["old-a"], "new-a"), [
    "b",
    "new-a",
    "c",
  ]);
});

test("addon replacement deduplicates the replacement and appends it when rank data is stale", () => {
  assert.deepEqual(replaceUrlsInOrder(["old-a", "b", "new-a", "old-a"], ["old-a"], "new-a"), [
    "new-a",
    "b",
  ]);
  assert.deepEqual(replaceUrlsInOrder(["b", "c"], ["old-a"], "new-a"), ["b", "c", "new-a"]);
});
