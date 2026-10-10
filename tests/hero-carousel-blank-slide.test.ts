// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (p: string) => new URL(`../${p}`, import.meta.url);
const carousel = readFileSync(at("src/components/hero-carousel.tsx"), "utf8");
const hero = readFileSync(at("src/components/hero.tsx"), "utf8");

function resolveBg(
  bgUrl: string | undefined,
  background: string | undefined,
  poster: string | undefined,
  bgResolved: boolean,
): string | undefined {
  return bgUrl ? `up(${bgUrl})` : (background ?? (bgResolved ? poster : undefined));
}

test("a hero slide never renders with nothing behind it", () => {
  assert.equal(resolveBg(undefined, "bd.jpg", "p.jpg", false), "bd.jpg");
  assert.equal(resolveBg(undefined, undefined, "p.jpg", true), "p.jpg");
  assert.equal(resolveBg("tmdb.jpg", "bd.jpg", "p.jpg", true), "up(tmdb.jpg)");
  assert.equal(
    resolveBg(undefined, undefined, undefined, true),
    undefined,
    "only a meta with no artwork at all may fall through",
  );
});

test("the resolved TMDB image still wins over the fallback", () => {
  assert.equal(resolveBg("tmdb.jpg", "bd.jpg", "p.jpg", false), "up(tmdb.jpg)");
});

test("hero uses the meta backdrop before waiting on async resolution", () => {
  assert.match(hero, /meta\.background \?\? \(bgResolved \? meta\.poster : undefined\)/);
  assert.doesNotMatch(
    hero,
    /const bg = bgUrl \? upsizeTmdb\(bgUrl, fullQuality\) : bgResolved \? meta\.poster : undefined;/,
    "the old form left the slide pure black until resolution finished",
  );
});

test("the carousel can never point at a slide that does not exist", () => {
  assert.match(
    carousel,
    /const safeActive = slides\.length > 0 \? Math\.min\(Math\.max\(active, 0\), slides\.length - 1\) : 0;/,
  );
  for (const use of [
    /\$\{-safeActive \* 100\}% \+ \$\{offset - safeActive \* SLIDE_GAP_PX\}px/,
    /const isActive = i === safeActive;/,
    /const distance = Math\.abs\(i - safeActive\);/,
    /i === safeActive \? "w-12 bg-ink"/,
  ]) {
    assert.match(carousel, use);
  }
});

test("clamping keeps exactly one slide mounted at any index", () => {
  const clamp = (active: number, len: number) =>
    len > 0 ? Math.min(Math.max(active, 0), len - 1) : 0;
  for (const [active, len] of [
    [0, 5],
    [4, 5],
    [9, 5],
    [-3, 5],
  ] as const) {
    const safe = clamp(active, len);
    const mounted = Array.from({ length: len }, (_, i) => Math.abs(i - safe) <= 1);
    assert.equal(mounted.filter((_, i) => i === safe).length, 1);
    assert.ok(mounted[safe], `active index ${active} of ${len} must mount`);
  }
});
