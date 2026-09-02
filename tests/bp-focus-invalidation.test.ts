// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

/**
 * The row containment rule may never be keyed on :has([data-bp-focus]).
 *
 * Chromium answers a :has() by re-checking every candidate subtree whenever the
 * tested attribute changes anywhere in the document. With twenty rows and 240
 * tiles on the home screen that made one focus move a style recalc of the whole
 * rail, and a held direction key on a Fire TV stick spent more time in style
 * than in moving: 17fps, 70 long tasks, 72 percent of the window blocked.
 *
 * The ring writes data-bp-row-focus to its own row ancestors instead, so the
 * selector is a plain attribute match. Both marks are set in one place on
 * purpose; a writer that sets one without the other leaves a row either
 * permanently contained or permanently not.
 */

const TOKENS = "src/views/big-picture/bp-tokens.ts";
const CORE = "src/views/big-picture/bp-focus-core.ts";

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("no row rule is keyed on :has([data-bp-focus])", () => {
  const css = stripComments(readFileSync(TOKENS, "utf8"));
  const offenders = css
    .split("\n")
    .map((line, i) => [i + 1, line] as const)
    .filter(([, line]) => /:has\([^)]*data-bp-focus/.test(line))
    .map(([n, line]) => `${TOKENS}:${n} ${line.trim()}`);
  assert.deepEqual(offenders, [], `key these on [data-bp-row-focus] instead:\n${offenders.join("\n")}`);
});

test("the containment rule matches the attribute the ring writes", () => {
  const css = stripComments(readFileSync(TOKENS, "utf8"));
  assert.match(
    css,
    /\[data-bp-row\]:not\(\[data-bp-row-focus\]\)\s*\{[^}]*content-visibility:\s*auto/,
    "the off-screen row rule must select on [data-bp-row-focus]",
  );
});

test("only applyBpFocus writes the two focus marks, and it writes both", () => {
  const core = readFileSync(CORE, "utf8");
  assert.ok(
    core.includes('row.setAttribute(ROW_ATTR, "true")'),
    "applyBpFocus must mark the ring's row ancestors",
  );
  assert.ok(
    core.includes('el.setAttribute("data-bp-focus", "true")'),
    "applyBpFocus must still mark the ring itself",
  );
  // Rollback has to undo both, or a refused candidate leaves a row uncontained.
  assert.ok(
    core.includes("rowsOwned[i]") && core.includes("removeAttribute(ROW_ATTR)"),
    "a refused focus must roll the row marks back",
  );
});
