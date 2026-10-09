// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { effectiveOrder, type CardKey } from "../src/lib/profile-card-layout.ts";

const ALL: CardKey[] = ["about", "comments", "favgames", "favbooks", "favmusic", "badges"];

function idx(order: CardKey[], k: CardKey) {
  return order.indexOf(k);
}

test("comments never render above games, books or music", () => {
  const order = effectiveOrder({ order: ["comments", "favgames", "favbooks", "favmusic"] }, ALL);
  for (const k of ["favgames", "favbooks", "favmusic"] as CardKey[]) {
    assert.ok(idx(order, k) < idx(order, "comments"), `${k} must come before comments, got ${order.join(",")}`);
  }
});

test("a layout that already has comments last is left alone", () => {
  const wanted: CardKey[] = ["about", "favgames", "favbooks", "favmusic", "badges", "comments"];
  assert.deepEqual(effectiveOrder({ order: wanted }, ALL), wanted);
});

test("comments still render when no favourite cards are present", () => {
  const present: CardKey[] = ["about", "comments", "badges"];
  const order = effectiveOrder({ order: ["comments", "about", "badges"] }, present);
  assert.ok(order.includes("comments"));
  assert.equal(order.length, present.length);
});

test("every present card survives the reorder exactly once", () => {
  const order = effectiveOrder({ order: ["comments", "favmusic"] }, ALL);
  assert.equal(order.length, ALL.length);
  assert.equal(new Set(order).size, ALL.length);
});
