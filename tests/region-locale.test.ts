import test from "node:test";
import assert from "node:assert/strict";
import { localeForRegion, localeLabel } from "../src/lib/region/locale-map.ts";

test("unambiguous regions select their translated Harbor interface", () => {
  const expected = {
    AT: "de",
    CN: "zh",
    DE: "de",
    FR: "fr",
    ID: "id",
    IN: "hi",
    IT: "it",
    JP: "ja",
    KR: "ko",
    PL: "pl",
    TR: "tr",
    VN: "vi",
  } as const;
  for (const [region, language] of Object.entries(expected)) {
    assert.equal(localeForRegion(region).uiLanguage, language, region);
  }
});

test("existing Arabic, Spanish, Portuguese and Russian region behavior remains intact", () => {
  assert.equal(localeForRegion("AE").uiLanguage, "ar");
  assert.equal(localeForRegion("MX").uiLanguage, "es");
  assert.equal(localeForRegion("ES").uiLanguage, "es");
  assert.equal(localeForRegion("BR").uiLanguage, "pt");
  assert.equal(localeForRegion("RU").uiLanguage, "ru");
});

test("multilingual regions stay on English instead of guessing", () => {
  assert.equal(localeForRegion("CA").uiLanguage, "en");
  assert.equal(localeForRegion("CH").uiLanguage, "en");
});

test("region prompts use each language's native and English names", () => {
  assert.equal(localeLabel(localeForRegion("JP")), "日本語 (Japanese)");
  assert.equal(localeLabel(localeForRegion("CN")), "简体中文 (Simplified Chinese)");
  assert.equal(localeLabel(localeForRegion("US")), "English");
});
