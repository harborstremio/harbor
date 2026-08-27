// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every main Settings page receives the three safe page preferences", () => {
  const shared = read("src/views/settings/shared.tsx");
  const settingsView = read("src/views/settings.tsx");
  const nav = read("src/views/settings/nav.tsx");
  const preferences = read("src/views/settings/page-preferences.tsx");

  const sectionIds = [...shared.matchAll(/^\s+\| "([^"]+)"/gm)].map((match) => match[1]);
  assert.equal(sectionIds.length, 31, "the test must cover every current main Settings page");
  for (const section of sectionIds) {
    assert.ok(settingsView.includes(`  ${section}: {`), `missing page metadata for ${section}`);
    assert.ok(nav.includes(`id: "${section}"`), `missing navigation entry for ${section}`);
  }

  assert.match(settingsView, /<PagePreferences[\s\S]*?value=\{activePagePreference\}/);
  assert.equal((preferences.match(/<ToggleRow/g) ?? []).length, 3);
  assert.match(preferences, /favorite: stored\?\.favorite === true/);
  assert.match(preferences, /compact: stored\?\.compact === true/);
  assert.match(preferences, /showIntro: stored\?\.showIntro !== false/);
});

test("page preferences are persisted, sanitized, and have visible effects", () => {
  const defaults = read("src/lib/settings/defaults.ts");
  const loader = read("src/lib/settings/load.ts");
  const settingsView = read("src/views/settings.tsx");
  const shared = read("src/views/settings/shared.tsx");
  const nav = read("src/views/settings/nav.tsx");

  assert.match(defaults, /settingsPagePreferences: \{\}/);
  assert.match(loader, /sanitizeSettingsPagePreferences\(parsed\.settingsPagePreferences\)/);
  assert.match(settingsView, /activePagePreference\.showIntro/);
  assert.match(settingsView, /activePagePreference\.compact/);
  assert.match(shared, /compact[\s\S]*?gap-3[\s\S]*?p-5/);
  assert.match(nav, /favoriteFirst\(group\.items\)/);
  assert.match(nav, /aria-label=\{t\("Favorite page"\)\}/);
});

test("the new page preferences have reviewed Hungarian copy", () => {
  const catalog = read("src/lib/i18n/locales/hu.ts");
  for (const translation of [
    '"This Settings page": "Az oldal beállításai"',
    '"Keep at the top of its menu group": "Előresorolás a menücsoportban"',
    '"Compact page spacing": "Kompakt oldalközök"',
    '"Show page introduction": "Oldalbevezető megjelenítése"',
  ]) {
    assert.ok(catalog.includes(translation), `missing Hungarian UI entry: ${translation}`);
  }
});
