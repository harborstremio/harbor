// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { matchesSettingsSearch } from "../src/views/settings/search-match.ts";

test("settings search matches translated labels without losing source-language matches", () => {
  const translations = new Map([
    ["Languages", "اللغات"],
    ["Account", "Conta"],
  ]);
  const translate = (value: string) => translations.get(value) ?? value;

  assert.equal(matchesSettingsSearch("اللغات", ["Languages"], translate), true);
  assert.equal(matchesSettingsSearch("conta", ["Account"], translate), true);
  assert.equal(matchesSettingsSearch("languages", ["Languages"], translate), true);
  assert.equal(matchesSettingsSearch("player", ["Languages"], translate), false);
});

test("settings search indexes open settings under Global", () => {
  const nav = readFileSync(new URL("../src/views/settings/nav.tsx", import.meta.url), "utf8");
  const entries = [
    ...nav.matchAll(
      /\{\s*label: "Open settings",\s*section: "hotkeys",\s*anchorTitle: "Global",\s*keywords: \[([^\]]+)\],?\s*\}/g,
    ),
  ];
  assert.equal(entries.length, 1, "exactly one Open settings search entry");
  assert.equal(entries[0][1], '"settings shortcut", "settings hotkey", "ctrl s", "preferences"');

  const focusAt = nav.indexOf('label: "Focus search"');
  const settingsAt = nav.indexOf('label: "Open settings"');
  const scaleAt = nav.indexOf('label: "Increase interface scale"');
  assert.equal(focusAt < settingsAt && settingsAt < scaleAt, true);
});
