// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { advanceRowPage, mergeRowPage, type RowPageState } from "../src/lib/catalog-page/merge.ts";
import type { Meta } from "../src/lib/cinemeta.ts";

const meta = (id: string): Meta => ({ id, type: "movie", name: id }) as unknown as Meta;

test("mergeRowPage dedupes by id and caps length", () => {
  const current = [meta("a"), meta("b")];
  const more = [meta("b"), meta("c"), meta("d")];
  assert.deepEqual(
    mergeRowPage(current, more, 10).map((m) => m.id),
    ["a", "b", "c", "d"],
  );
  assert.equal(mergeRowPage(current, more, 3).length, 3);
  // Nothing new -> keep the same reference so React Query structural sharing holds.
  assert.equal(mergeRowPage(current, [meta("b")], 10), current);
});

test("advanceRowPage really advances pages (regression: rows stuck refetching page 2)", () => {
  let state: RowPageState | undefined;
  state = advanceRowPage(state, 20, 40, 14, 120);
  assert.deepEqual(state, { page: 2, hasMore: true });
  state = advanceRowPage(state, 20, 60, 14, 120);
  assert.equal(state.page, 3);
  state = advanceRowPage(state, 20, 80, 14, 120);
  assert.equal(state.page, 4);
});

test("advanceRowPage stops on short pages and at the per-row cap", () => {
  assert.equal(advanceRowPage(undefined, 5, 25, 14, 120).hasMore, false);
  assert.equal(advanceRowPage(undefined, 20, 120, 14, 120).hasMore, false);
});
