import test from "node:test";
import assert from "node:assert/strict";
import {
  associationFootballEnglishLabel,
  resolveUiRegion,
} from "../src/lib/i18n/regional-labels.ts";
import { getUiLanguage, getUiRegion, setUiLanguage, subscribe } from "../src/lib/i18n/store.ts";
import { t, sourceTranslationKey } from "../src/lib/i18n/translate.ts";
import { ensureUiLocale } from "../src/lib/i18n/load-locale.ts";
import { getLeagueLabel, leagueByTag } from "../src/lib/sports/espn-leagues.ts";

test("Soccer is limited to US English; other English regions use Football", () => {
  assert.equal(associationFootballEnglishLabel("en", "US"), "Soccer");
  assert.equal(associationFootballEnglishLabel("en-US"), "Soccer");
  assert.equal(associationFootballEnglishLabel("en_us"), "Soccer");
  for (const region of ["GB", "CA", "AU", "NZ", "IE", "IN", "FR", undefined]) {
    assert.equal(associationFootballEnglishLabel("en", region), "Football", String(region));
  }
  assert.equal(associationFootballEnglishLabel("fr", "US"), "Football");
  assert.equal(associationFootballEnglishLabel("en-US", "GB"), "Football");
});

test("effective app region overrides browser locale without assuming a country for plain en", () => {
  assert.equal(resolveUiRegion(" gb ", "en-US"), "GB");
  assert.equal(resolveUiRegion(undefined, "en-GB"), "GB");
  assert.equal(resolveUiRegion(undefined, "en_US"), "US");
  assert.equal(resolveUiRegion(undefined, "zh-Hant-TW"), "TW");
  assert.equal(resolveUiRegion(undefined, "en"), undefined);
  assert.equal(resolveUiRegion(undefined, "bad_locale_!"), undefined);
});

test("region-only settings changes update translation subscribers and preserve other languages", async () => {
  const originalLanguage = getUiLanguage(),
    originalRegion = getUiRegion();
  let changes = 0;
  const unsubscribe = subscribe(() => changes++);
  try {
    setUiLanguage("en", "US");
    assert.equal(t("Soccer"), "Soccer");
    assert.equal(getLeagueLabel(leagueByTag("NCAAMSOCCER")!), "NCAA Men's Soccer");
    assert.equal(t("American football"), "American football");
    assert.equal(sourceTranslationKey("Soccer"), "Soccer");
    changes = 0;
    setUiLanguage("en", "GB");
    assert.equal(changes, 1);
    assert.equal(t("Soccer"), "Football");
    assert.equal(getLeagueLabel(leagueByTag("NCAAWSOCCER")!), "NCAA Women's Football");
    assert.equal(sourceTranslationKey("Football"), "Soccer");
    setUiLanguage("en", "GB");
    assert.equal(changes, 1);
    await ensureUiLocale("fr");
    setUiLanguage("fr", "US");
    assert.equal(t("Soccer"), "Football");
    await ensureUiLocale("es");
    setUiLanguage("es", "US");
    assert.equal(t("Soccer"), "Fútbol");
    assert.equal(getLeagueLabel(leagueByTag("NCAAMSOCCER")!), "Fútbol masculino de la NCAA");
    setUiLanguage("en");
    assert.equal(t("Soccer"), "Soccer");
  } finally {
    unsubscribe();
    setUiLanguage(originalLanguage, originalRegion);
  }
});
