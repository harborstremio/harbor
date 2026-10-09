// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

/**
 * Every Big Picture animation ships a reduced-motion path.
 *
 * Three idioms count, and a checker that knows only the first reports the other
 * two as broken:
 *   motion-reduce:animate-none   turn it off when motion is unwelcome
 *   motion-safe:animate-pulse    the inverse, only animate when it is welcome
 *   reduce ? "" : "animate-pulse"  the query resolved in JS and branched on
 *
 * Spinners are included, and their path slows rather than stops:
 *   motion-reduce:[animation-duration:2.4s]
 * A spinner is load-bearing feedback, so freezing one mid-fetch reads as a
 * hang. Slowing it keeps the signal and drops the fast rotation.
 */

const BP = "src/views/big-picture";

const ANIMATION = /(?<!motion-safe:)(?:\[animation:[^\]]+\]|\banimate-(?!none\b)[a-z-]+)/;
const GUARDED =
  /motion-reduce:\[animation:none\]|motion-reduce:animate-none|motion-reduce:\[animation-|motion-safe:|\breduce\s*\?|prefers-reduced-motion/;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...sources(p));
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Scoped to the enclosing quoted string, never to a window of nearby lines. A
 * line window passes a bare animation that merely sits next to a guarded one,
 * which is a check that cannot fail and so proves nothing.
 */
const STRINGS = /"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`|'([^'\\]*(?:\\.[^'\\]*)*)'/g;

/**
 * Comments are stripped before scanning. An apostrophe in prose (the engine's
 * vocabulary) opens a phantom single-quoted span that runs to the next
 * apostrophe, and one such span measured 5702 characters across 155 lines. It
 * swallowed the word animate-pulse out of a comment whose whole purpose was to
 * record that animate-pulse had been REMOVED, and reported it as a live
 * unguarded animation. Whitespace is preserved so line numbers stay true.
 */
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:"'`\\])\/\/[^\n]*/gm;

function stripComments(src: string): string {
  return src
    .replace(BLOCK_COMMENT, (m: string) => m.replace(/[^\n]/g, " "))
    .replace(LINE_COMMENT, (_m: string, lead: string) => lead);
}

test("every Big Picture animation has a reduced-motion path", () => {
  const bare: string[] = [];
  for (const path of sources(BP)) {
    const src = stripComments(readFileSync(path, "utf8"));
    const name = path.slice(path.lastIndexOf("/") + 1);
    for (const m of src.matchAll(STRINGS)) {
      const body = m[1] ?? m[2] ?? m[3] ?? "";
      const hit = ANIMATION.exec(body);
      if (!hit) continue;
      // A template literal can interpolate the guard from a sibling constant,
      // so fall back to the whole statement for those.
      const scope = m[2] === undefined ? body : src.slice(Math.max(0, m.index - 400), m.index + m[0].length);
      if (GUARDED.test(scope)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      bare.push(`${name}:${line} ${hit[0]}`);
    }
  }
  assert.deepEqual(bare, [], `add motion-reduce:animate-none:\n${bare.join("\n")}`);
});
