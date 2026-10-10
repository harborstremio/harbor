// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { isThemeOwnedBackground, nextBackgroundImage } from "../src/lib/theme-background.ts";

const NOIR = { background: { image: "linear-gradient(180deg, #000 0%, #000 100%)", dim: 0.6 } };
const AURORA = { background: { image: "radial-gradient(ellipse 90% 70% at 20% 0%, #123 0%)" } };
const PLAIN = { background: undefined };
const USER = "data:image/png;base64,USERWALLPAPER";

test("switching to a theme with no wallpaper clears the previous theme's", () => {
  assert.equal(nextBackgroundImage(NOIR.background.image, NOIR, PLAIN), null);
});

test("switching between two themes adopts the incoming wallpaper", () => {
  assert.equal(nextBackgroundImage(NOIR.background.image, NOIR, AURORA), AURORA.background.image);
});

test("a wallpaper the user chose survives switching themes", () => {
  assert.equal(nextBackgroundImage(USER, PLAIN, PLAIN), USER);
  assert.equal(nextBackgroundImage(USER, PLAIN, NOIR), USER, "the user's choice still wins");
  assert.equal(nextBackgroundImage(USER, AURORA, PLAIN), USER, "a mismatched preset is not ours");
});

test("an empty slot takes the incoming theme's wallpaper and nothing else", () => {
  assert.equal(nextBackgroundImage(null, PLAIN, PLAIN), null);
  assert.equal(nextBackgroundImage(null, PLAIN, NOIR), NOIR.background.image);
});

test("deleting the active theme does not orphan its wallpaper", () => {
  assert.equal(nextBackgroundImage(NOIR.background.image, NOIR, null), null);
});

test("ownership is decided by value, and nothing owns an empty slot", () => {
  assert.equal(isThemeOwnedBackground(null, NOIR), false);
  assert.equal(isThemeOwnedBackground("", NOIR), false);
  assert.equal(isThemeOwnedBackground(NOIR.background.image, NOIR), true);
  assert.equal(isThemeOwnedBackground(NOIR.background.image, AURORA), false);
  assert.equal(isThemeOwnedBackground(USER, undefined), false);
});

test("every path that changes the preset also resolves the wallpaper", () => {
  const at = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const section = at("src/views/settings/theme-panel/custom-themes-section.tsx");
  const studio = at("src/views/settings/theme-panel/theme-studio.tsx");
  assert.match(section, /backgroundImage: nextBackgroundImage\(settings\.theme\.backgroundImage/);
  assert.match(section, /const image = wasActive/);
  assert.match(studio, /const image = nextBackgroundImage\(settings\.theme\.backgroundImage/);
  assert.match(section, /const image = wasActive[\s\S]{0,200}?removeCustomTheme\(id\);/);
});
