import assert from "node:assert/strict";
import test from "node:test";
import en from "../src/lib/i18n/locales/en/music-quality.ts";

test("quality and meter translations cover every key and preserve variables in all languages", async () => {
  for (const language of [
    "ar",
    "de",
    "es",
    "fr",
    "hi",
    "id",
    "it",
    "ja",
    "ko",
    "pl",
    "pt",
    "ru",
    "tr",
    "vi",
    "zh",
  ]) {
    const locale = (await import(`../src/lib/i18n/locales/${language}/music-quality.ts`)).default;
    assert.deepEqual(Object.keys(locale).sort(), Object.keys(en).sort(), language);
    for (const key of Object.keys(en)) {
      assert.ok(typeof locale[key] === "string" && locale[key].trim(), `${language}: ${key}`);
      assert.deepEqual(
        locale[key].match(/\{\w+\}/g) ?? [],
        en[key].match(/\{\w+\}/g) ?? [],
        `${language}: ${key}`,
      );
    }
  }
});
