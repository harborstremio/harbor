import test from "node:test";
import assert from "node:assert/strict";
import { ensureUiLocale } from "../src/lib/i18n/load-locale.ts";
import { LANGUAGES, normalizeLanguage, type UiLanguage } from "../src/lib/i18n/languages.ts";
import { uiCatalogLoaded } from "../src/lib/i18n/translate.ts";

const EXPECTED: UiLanguage[] = [
  "en",
  "ar",
  "zh",
  "fr",
  "de",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "pl",
  "pt",
  "ru",
  "es",
  "tr",
  "vi",
];

test("the display language registry exposes English and fifteen translations", () => {
  assert.deepEqual(
    LANGUAGES.map(({ code }) => code),
    EXPECTED,
  );
  assert.equal(new Set(EXPECTED).size, EXPECTED.length);
  assert.deepEqual(
    LANGUAGES.filter(({ rtl }) => rtl).map(({ code }) => code),
    ["ar"],
  );
});

test("stored language values normalize against the complete registry", () => {
  for (const code of EXPECTED) assert.equal(normalizeLanguage(code), code);
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("pt-BR"), "pt");
  assert.equal(normalizeLanguage("zh_CN"), "zh");
  assert.equal(normalizeLanguage("unknown"), "en");
  assert.equal(normalizeLanguage(null), "en");
});

test("every translated catalog can be loaded on demand", async () => {
  for (const code of EXPECTED) {
    await ensureUiLocale(code);
    assert.equal(uiCatalogLoaded(code), true, `${code} catalog did not register`);
  }
});
