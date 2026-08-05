// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

type Slot = { id: number; abs?: number };

function build(bucket: Slot[], byAbs: Map<number, { id: number }>, consumeOnce: boolean) {
  const claimed = new Set<number>();
  const seen = new Set<number>();
  const out: number[] = [];
  for (const e of bucket) {
    let match = e.abs != null ? byAbs.get(e.abs) : undefined;
    if (consumeOnce && match && claimed.has(match.id)) match = undefined;
    const id = match ? match.id : -e.id;
    if (seen.has(id)) continue;
    seen.add(id);
    if (match) claimed.add(match.id);
    out.push(id);
  }
  return out;
}

const HXH_S2 = 78;

function hxhSeason2(): { bucket: Slot[]; byAbs: Map<number, { id: number }> } {
  const bucket: Slot[] = [];
  const byAbs = new Map<number, { id: number }>();
  for (let i = 0; i < HXH_S2; i++) {
    const abs = 59 + Math.floor(i / 2) * 2;
    bucket.push({ id: 9000 + i, abs });
    if (!byAbs.has(abs)) byAbs.set(abs, { id: 4000 + abs });
  }
  return { bucket, byAbs };
}

test("collapsing two TVDB slots onto one Kitsu episode silently loses episodes", () => {
  const { bucket, byAbs } = hxhSeason2();
  const naive = build(bucket, byAbs, false);
  assert.equal(bucket.length, HXH_S2);
  assert.ok(naive.length < HXH_S2, "this is the bug: the season shrinks");
  assert.equal(naive.length, HXH_S2 / 2);
});

test("claiming a match once keeps every slot in the season", () => {
  const { bucket, byAbs } = hxhSeason2();
  const fixed = build(bucket, byAbs, true);
  assert.equal(fixed.length, HXH_S2, "season 2 must keep all 78 episodes");
  assert.equal(new Set(fixed).size, HXH_S2, "and they must all be distinct rows");
});

test("the panel builder claims each matched episode exactly once", () => {
  const src = readFileSync(
    new URL("../src/views/detail/anime-episodes/use-anime-tvdb-panel.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /const claimed = new Set<number>\(\);/);
  assert.match(src, /if \(match && claimed\.has\(match\.id\)\) match = undefined;/);
  assert.match(src, /if \(match\) claimed\.add\(match\.id\);/);
  const claimIdx = src.indexOf("if (match) claimed.add(match.id);");
  const pushIdx = src.indexOf("eps.push(ep);");
  assert.ok(claimIdx > 0 && claimIdx < pushIdx, "a slot must be claimed before it is kept");
});
