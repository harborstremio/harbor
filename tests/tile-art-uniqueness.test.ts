// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
import { claimUniqueArt, releaseUniqueArt } from "../src/lib/unique-art.ts";

type Item = { id: string };
const pool = (...ids: string[]): Item[] => ids.map((id) => ({ id }));
const idOf = (m: Item) => m.id;

test("two tiles drawing from overlapping pools never show the same title", () => {
  releaseUniqueArt("a");
  releaseUniqueArt("b");
  const a = claimUniqueArt("a", pool("t1", "t2", "t3", "t4", "t5"), idOf, 3);
  const b = claimUniqueArt("b", pool("t2", "t3", "t4", "t5", "t6"), idOf, 3);
  assert.deepEqual(a.map(idOf), ["t1", "t2", "t3"]);
  assert.deepEqual(b.map(idOf), ["t4", "t5", "t6"]);
  const overlap = a.map(idOf).filter((id) => b.map(idOf).includes(id));
  assert.deepEqual(overlap, [], "adjacent tiles shared artwork");
});

test("re-claiming the same tile releases its old art instead of starving itself", () => {
  releaseUniqueArt("a");
  const first = claimUniqueArt("a", pool("t1", "t2", "t3"), idOf, 3);
  const again = claimUniqueArt("a", pool("t1", "t2", "t3"), idOf, 3);
  assert.deepEqual(again.map(idOf), first.map(idOf));
});

test("unmounting a tile frees its art for the others", () => {
  releaseUniqueArt("a");
  releaseUniqueArt("b");
  claimUniqueArt("a", pool("t1", "t2", "t3"), idOf, 3);
  releaseUniqueArt("a");
  const b = claimUniqueArt("b", pool("t1", "t2", "t3"), idOf, 3);
  assert.deepEqual(b.map(idOf), ["t1", "t2", "t3"]);
});

test("a tile with nothing left returns fewer rather than duplicating", () => {
  releaseUniqueArt("a");
  releaseUniqueArt("b");
  claimUniqueArt("a", pool("t1", "t2"), idOf, 2);
  const b = claimUniqueArt("b", pool("t1", "t2"), idOf, 2);
  assert.deepEqual(b, []);
});

test("both discover tile rows claim through the shared registry", () => {
  for (const f of ["src/components/genre-tiles.tsx", "src/components/language-tiles.tsx"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    assert.match(src, /claimUniqueArt\(key, pool, \(m\) => m\.id, 3\)/, `${f} must claim unique art`);
    assert.match(src, /releaseUniqueArt\(key\)/, `${f} must release on unmount`);
    assert.doesNotMatch(src, /\.filter\(\(m\) => m\.background\)\.slice\(0, 3\)/, `${f} still takes the top 3 blindly`);
  }
});
