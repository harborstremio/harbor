// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

/**
 * Guards the ten-foot canvas, where a television lays out at 1140x641.
 *
 * The width is settled by eye on a real panel and index-tv.html is the only
 * place it is written. 1080 was the first value; it moved to 1140 because the
 * row below the focused one was clipped by the hint bar.
 *
 * Every one of these encodes a bug that actually shipped, not a style opinion.
 * At 607px tall the vh term of most clamps lands under its px floor, so the
 * floor is what renders, and a page that guesses at the top bar's height with
 * its own clamp draws its title behind the nav.
 */

const BP = "src/views/big-picture";

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...tsxFiles(path));
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const tokens = readFileSync(`${BP}/bp-tokens.ts`, "utf8");

test("the top bar's height is defined once, and the page offset derives from it", () => {
  assert.match(tokens, /--bp-bar-h:\s*calc\(clamp\(72px, 9vh, 112px\) \+ var\(--bp-safe-y, 0px\)\)/);
  assert.match(tokens, /--bp-page-top:\s*calc\(var\(--bp-bar-h\)/);
});

test("the top bar sizes itself from the shared token, never a parallel clamp", () => {
  const bar = readFileSync(`${BP}/bp-top-bar.tsx`, "utf8");
  assert.match(bar, /h-\[var\(--bp-bar-h\)\]/);
  assert.doesNotMatch(bar, /h-\[calc\(clamp\(72px/);
});

/**
 * The spotlight tucks deliberately under the translucent bar, so its offset is
 * smaller than the bar on purpose. Everything else that clears the bar must use
 * the token: at 607px the old clamp(66px,8.4vh,106px) resolved to 66px under an
 * 84px bar, and clamp(84px,10.5vh,140px) left zero clearance.
 */
const BLEEDS_UNDER_BAR = new Set(["bp-home.tsx", "bp-movies.tsx", "bp-shows.tsx"]);

test("no page clears the top bar with its own clamp", () => {
  const offender = /pt-\[clamp\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)vh/g;
  const bad: string[] = [];
  for (const path of tsxFiles(BP)) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (BLEEDS_UNDER_BAR.has(name)) continue;
    const src = readFileSync(path, "utf8");
    for (const m of src.matchAll(offender)) {
      // 50px and up is unambiguously an attempt to clear the bar rather than
      // ordinary interior padding.
      if (Number(m[1]) >= 50) bad.push(`${name}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad, [], `use pt-[var(--bp-page-top)] instead:\n${bad.join("\n")}`);
});

test("no comment in the token sheet carries a backtick", () => {
  // The sheet is one template literal, so a backtick inside a comment closes it
  // early. tsc catches it, but points at the next brace rather than the quote,
  // which is a confusing five minutes. Name it here instead.
  const bad = [...tokens.matchAll(/\/\*[\s\S]*?\*\//g)]
    .map((m) => m[0])
    .filter((c) => c.includes("`"));
  assert.deepEqual(bad, [], "a backtick in one of these terminates the stylesheet");
});
