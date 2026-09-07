// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const root = "src/views/settings/theme-panel/custom-themes-section";
const trigger = read(`${root}/theme-author-button.tsx`);

test("theme author names are native profile buttons with keyboard focus", () => {
  assert.match(trigger, /<button/);
  assert.match(trigger, /type="button"/);
  assert.match(trigger, /requestOpenProfile\(handle\)/);
  assert.match(trigger, /aria-label=\{`Open \$\{name\} profile`\}/);
  assert.match(trigger, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(trigger, /tabIndex=\{/);
});

test("all new community author surfaces share the profile button", () => {
  for (const path of [
    `${root}/community-browser.tsx`,
    `${root}/community-detail.tsx`,
    `${root}/community-store/market/market-hero.tsx`,
    `${root}/community-store/theme-detail.tsx`,
  ]) {
    assert.match(read(path), /ThemeAuthorButton/, `${path} must use the shared author button`);
  }
});

test("clickable theme cards use a sibling overlay instead of nesting author buttons", () => {
  for (const path of [`${root}/community-browser.tsx`]) {
    const source = read(path);
    assert.match(source, /aria-label=\{tr\("Open \{name\}", \{ name: (?:t|theme)\.name \}\)\}/);
    assert.match(source, /className="absolute inset-0 z-0/);
  }
});
