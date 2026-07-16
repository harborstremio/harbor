// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
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
