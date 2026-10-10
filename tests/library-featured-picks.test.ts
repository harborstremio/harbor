// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { pickFeatured, resetFeaturedPicks } from "../src/views/library/featured-picks.ts";
import type { Meta } from "../src/lib/cinemeta.ts";

function metas(n: number, withArt = true): Meta[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `tt${1000 + i}`,
    type: "movie" as const,
    name: `Title ${i}`,
    background: withArt ? `https://example.test/${i}.jpg` : undefined,
  }));
}

test("returns at most the requested count", () => {
  resetFeaturedPicks();
  assert.equal(pickFeatured(metas(20), "local").length, 4);
});

test("returns everything when the library is smaller than the count", () => {
  resetFeaturedPicks();
  assert.equal(pickFeatured(metas(2), "local").length, 2);
});

test("is stable across repeated calls in a session", () => {
  resetFeaturedPicks();
  const first = pickFeatured(metas(30), "local").map((m) => m.id);
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(
      pickFeatured(metas(30), "local").map((m) => m.id),
      first,
    );
  }
});

test("keys picks per tab, so tabs don't share a selection", () => {
  resetFeaturedPicks();
  const pool = metas(30);
  const local = pickFeatured(pool, "local").map((m) => m.id);
  const watchlist = pickFeatured(pool, "watchlist").map((m) => m.id);
  assert.deepEqual(
    pickFeatured(pool, "local").map((m) => m.id),
    local,
  );
  assert.deepEqual(
    pickFeatured(pool, "watchlist").map((m) => m.id),
    watchlist,
  );
});

test("drops picks that disappear and tops back up", () => {
  resetFeaturedPicks();
  const pool = metas(10);
  const first = pickFeatured(pool, "local");
  const dropped = first[0].id;
  const shrunk = pool.filter((m) => m.id !== dropped);
  const second = pickFeatured(shrunk, "local");
  assert.equal(second.length, 4);
  assert.ok(!second.some((m) => m.id === dropped));
  // The survivors from the first pick are retained, not reshuffled.
  for (const m of first.slice(1)) assert.ok(second.some((s) => s.id === m.id));
});

test("prefers titles that already have a backdrop", () => {
  resetFeaturedPicks();
  const withArt = metas(4);
  const withoutArt = metas(10, false).map((m, i) => ({ ...m, id: `tt9${i}` }));
  const picked = pickFeatured([...withoutArt, ...withArt], "local");
  assert.deepEqual(picked.map((m) => m.id).sort(), withArt.map((m) => m.id).sort());
});

test("an empty library yields no slides and forgets the previous pick", () => {
  resetFeaturedPicks();
  pickFeatured(metas(10), "local");
  assert.deepEqual(pickFeatured([], "local"), []);
  const after = pickFeatured(metas(10), "local");
  assert.equal(after.length, 4);
});
