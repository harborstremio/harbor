// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

// Regression coverage for issue #951: a community "layout: custom" theme
// whose injected HTML/CSS/JS fails to render working navigation left users
// with zero way to reach Settings or any other view - no built-in chrome
// renders for that layout (see App.tsx), and custom-code-mount.tsx only
// console.warns when the theme's JS throws.
//
// This repo has no DOM test harness (no jsdom/testing-library - see
// tests/view-lifecycle.test.ts for the established precedent), so these
// assertions pin the source-level invariants that make the fallback work,
// the same way view-lifecycle.test.ts pins App.tsx's render conditions.

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const safetyNetSource = readFileSync(
  new URL("../src/chrome/custom-layout-safety-net.tsx", import.meta.url),
  "utf8",
);

test("the custom-layout safety net is mounted whenever a custom-chrome theme is active", () => {
  assert.match(
    appSource,
    /!settingsTop && !playerActive && !pickerTop && layout === "custom" &&\s*\(\s*<CustomLayoutSafetyNet/,
  );
});

test("the safety net only renders when no theme-provided navigation exists", () => {
  // Every built-in and community nav control marks itself with
  // data-harbor-nav (Sidebar, TopDock, the theme-studio chrome builder,
  // and the bundled Feishin/ElegantFin themes). Presence of this attribute
  // anywhere in the document is the signal that the active theme already
  // built working navigation, so the fallback must stay hidden.
  assert.match(safetyNetSource, /document\.querySelector\("\[data-harbor-nav\]"\)/);
  assert.match(safetyNetSource, /if \(!navMissing\) return null;/);
});

test("the safety net defends its own visibility against aggressive theme CSS", () => {
  // A theme can inject `!important` rules (a broad `display: none`, a
  // z-index conflict, or worse) that would otherwise be able to hide any
  // plain Tailwind-styled fallback element too. The safety net must force
  // its own display/visibility/opacity/position/z-index with `!important`
  // and keep its stylesheet last in <head> so it always wins the cascade.
  assert.match(safetyNetSource, /display: block !important/);
  assert.match(safetyNetSource, /visibility: visible !important/);
  assert.match(safetyNetSource, /opacity: 1 !important/);
  assert.match(safetyNetSource, /z-index: 2147483647 !important/);
  assert.match(safetyNetSource, /document\.head\.appendChild\(el\)/);
});

test("the safety net does not bypass the parental PIN lock on Settings", () => {
  // The fallback must not become a way to dodge parental controls: a
  // pinGated item (Settings) still has to go through the same
  // ParentalPinModal + useParental().locked check every other layout uses.
  assert.match(safetyNetSource, /useParental/);
  assert.match(safetyNetSource, /pinGated && locked/);
  assert.match(safetyNetSource, /ParentalPinModal/);
});
