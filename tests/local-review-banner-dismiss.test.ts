// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const tab = read("src/views/library/local-tab.tsx");
const types = read("src/lib/settings/types.ts");
const defaults = read("src/lib/settings/defaults.ts");
const load = read("src/lib/settings/load.ts");

/** Mirrors the gate in local-tab so the rule itself is exercised, not just its source. */
const shown = (reviewCount: number, dismissedAt: number) => reviewCount > dismissedAt;

test("dismissing hides the titles that were known at the time", () => {
  assert.equal(shown(8, 0), true, "a fresh scan shows the banner");
  assert.equal(shown(8, 8), false, "dismissing 8 hides those 8");
});

test("a later scan that finds more brings the banner back", () => {
  assert.equal(shown(9, 8), true, "a ninth unidentified title is new information");
  assert.equal(shown(20, 8), true);
});

test("identifying some titles does not resurrect a dismissed banner", () => {
  // Going 8 -> 3 by identifying five is progress, not a reason to nag again.
  assert.equal(shown(3, 8), false);
  assert.equal(shown(0, 8), false, "nothing left to review");
});

test("the dismissal is a persisted setting, not component state", () => {
  assert.match(types, /localReviewDismissedCount: number;/);
  assert.match(defaults, /localReviewDismissedCount: 0,/);
  assert.match(load, /typeof parsed\.localReviewDismissedCount === "number"/);
});

test("the banner records the count it was dismissed at", () => {
  assert.match(tab, /update\(\{ localReviewDismissedCount: reviewCount \}\)/);
  assert.match(tab, /reviewCount > settings\.localReviewDismissedCount/);
});

test("Review and Dismiss are siblings, not buttons nested in a button", () => {
  // The banner was one big <button>; a dismiss inside it would be invalid markup.
  assert.match(tab, /: reviewShown \? \(\s*<div/, "the banner shell must be a div");
  assert.match(tab, /aria-label=\{t\("Dismiss"\)\}/);
});
