// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const poster = read("src/components/poster.tsx");
const row = read("src/components/row.tsx");

test("poster sizing accounts for the height it has to cover, not just width", () => {
  assert.match(poster, /const RATIO_AR: Record<Ratio, number>/);
  assert.match(poster, /Math\.max\(box\.width, box\.height \* RATIO_AR\[ratio\]\)/);
  assert.doesNotMatch(
    poster,
    /const t = Math\.ceil\(w \* \(window\.devicePixelRatio/,
    "width-only sizing under-fetches for off-aspect boxes",
  );
});

test("poster sizing sees css transforms so scaled art is not blurry", () => {
  assert.match(poster, /el\.getBoundingClientRect\(\)/, "clientWidth ignores transforms like scale()");
  assert.match(poster, /\}, \[inView, qMult, ratio\]\);/, "ratio must be a dependency");
});

test("the declared aspect ratios match the aspect padding", () => {
  const ar = poster.slice(poster.indexOf("const RATIO_AR"), poster.indexOf("export function Poster"));
  assert.match(ar, /portrait: 2 \/ 3/);
  assert.match(ar, /landscape: 16 \/ 9/);
  assert.match(ar, /wide: 16 \/ 7/);
});

test("row tracks do not bleed the next card into horizontal padding", () => {
  assert.match(row, /const trackPad = dockEnabled \? "pb-8 pt-14 -mb-8 -mt-14" : "py-5 -my-5";/);
  assert.doesNotMatch(row, /px-5 pb-8 pt-14 -mx-5/, "horizontal padding shows a sliver of the next card");
  assert.doesNotMatch(row, /"p-5 -m-5"/, "horizontal padding shows a sliver of the next card");
});

test("row tracks keep vertical room for the hover lift", () => {
  assert.match(row, /py-5 -my-5/, "vertical padding must survive so hover lift is not clipped");
  assert.match(row, /pt-14/, "dock mode needs headroom above the cards");
  assert.match(row, /-mt-14/, "the headroom is pulled back so layout does not shift");
});

test("scroll padding no longer offsets snapping now that the track has no inline padding", () => {
  assert.doesNotMatch(row, /scroll-ps-5 scroll-pe-5/, "20px scroll padding would misalign snap targets");
});
