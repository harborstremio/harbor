// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const shared = read("src/views/library/shared.tsx");
const tab = read("src/views/library/watchlist-tab.tsx");
const library = read("src/views/library.tsx");

test("grouped library grids virtualize per group when given a scroll ref", () => {
  assert.match(shared, /scrollRef\?: RefObject<HTMLElement \| null>/, "GroupedGrid must accept scrollRef");
  assert.match(shared, /<VirtualGrid/, "GroupedGrid must render VirtualGrid per group");
  assert.match(tab, /scrollRef\?: React\.RefObject<HTMLElement \| null>/, "WatchlistTab must accept scrollRef");
  assert.match(tab, /scrollRef=\{scrollRef\}/, "WatchlistTab must forward scrollRef to GroupedGrid");
});

test("library view wires the scroll ref into watchlist tabs", () => {
  assert.match(library, /<WatchlistTab mode="library" scrollRef=\{scrollRef\} \/>/, "library tab must pass scrollRef");
  assert.match(library, /<WatchlistTab mode="watchlist" scrollRef=\{scrollRef\} \/>/, "watchlist tab must pass scrollRef");
});

const grid = read("src/components/virtual-grid.tsx");

test("a grid measures its own distance down the shared scroller", () => {
  // Several grids stack in one scroll element, so a grid that assumes it starts at
  // scrollTop 0 renders its rows far from the viewport and the page goes blank.
  assert.match(grid, /scrollMargin,/, "the virtualizer must be told the grid offset");
  assert.match(grid, /getBoundingClientRect\(\)\.top[\s\S]{0,120}scroller\.scrollTop/,
    "the offset must be measured against the scroll element");
});

test("rows subtract the offset they were positioned with", () => {
  // start includes scrollMargin while getTotalSize() excludes it; keeping one without
  // the other shifts every row down by the grid offset.
  assert.match(grid, /translateY\(\$\{row\.start - scrollMargin\}px\)/);
});
