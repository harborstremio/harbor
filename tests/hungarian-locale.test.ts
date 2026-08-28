import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LANGUAGES, normalizeLanguage } from "../src/lib/i18n/languages.ts";
import { localeForRegion } from "../src/lib/region/locale-map.ts";

test("Hungarian is a selectable interface language", () => {
  assert.equal(normalizeLanguage("hu"), "hu");
  assert.ok(LANGUAGES.some((language) => language.code === "hu" && language.nativeLabel === "Magyar"));
});

test("Hungarian locale localizes the content advisory UI", () => {
  const catalog = readFileSync(new URL("../src/lib/i18n/locales/hu.ts", import.meta.url), "utf8");
  assert.match(catalog, /"Content advisory": "Tartalmi figyelmeztetés"/);
  assert.match(catalog, /Violence: "Erőszak"/);
  assert.match(catalog, /Severe: "Súlyos"/);
  assert.match(catalog, /"While you watch": "Nézés közben"/);
});

test("Hungarian subtitle UI uses reviewed, natural terminology", () => {
  const catalog = readFileSync(new URL("../src/lib/i18n/locales/hu.ts", import.meta.url), "utf8");
  for (const translation of [
    '"Subtitle addons": "Feliratkiegészítők"',
    '"Subtitle sources": "Feliratforrások"',
    '"Subtitle track": "Feliratsáv"',
    '"Loading subtitle addons…": "Feliratkiegészítők betöltése…"',
    '"No subtitles": "Felirat nélkül"',
    '"Prefer embedded subtitles": "Beágyazott feliratok előnyben részesítése"',
  ]) {
    assert.ok(catalog.includes(translation), `missing reviewed subtitle entry: ${translation}`);
  }
  assert.doesNotMatch(catalog, /"Subtitle(?: addons| sync| track)?": "Fordította:/);
});

test("Hungarian HDR controls use reviewed Dolby Vision terminology", () => {
  const coverage = readFileSync(
    new URL("../src/lib/i18n/locales/hu/coverage.ts", import.meta.url),
    "utf8",
  );
  assert.match(coverage, /"Automatic HDR \/ Dolby Vision": "Automatikus HDR \/ Dolby Vision"/);
  assert.match(coverage, /"Tonemap to SDR": "HDR átalakítása SDR-re"/);
  assert.match(coverage, /"True HDR, separate window": "Valódi HDR, külön ablakban"/);
  assert.doesNotMatch(coverage, /Tonap tonapap/);
});

test("Hungarian locale covers the reported settings and catalog screens", () => {
  const catalog = readFileSync(new URL("../src/lib/i18n/locales/hu.ts", import.meta.url), "utf8");
  for (const translation of [
    '"Search settings": "Keresés a beállításokban"',
    '"Account": "Fiók"',
    '"Harbor identity": "Harbor-identitás"',
    '"Collections": "Gyűjtemények"',
    '"Browse your catalogs": "Katalógusok böngészése"',
    '"Browse by Genre": "Böngészés műfaj szerint"',
    '"Trending This Week": "A hét felkapott tartalmai"',
    '"Top 10 Series Today": "A mai 10 legnépszerűbb sorozat"',
  ]) {
    assert.ok(catalog.includes(translation), `missing Hungarian UI entry: ${translation}`);
  }

  const colorPicker = readFileSync(new URL("../src/views/settings/color-picker.tsx", import.meta.url), "utf8");
  assert.match(colorPicker, /t\("Your color"\)/);
  assert.match(colorPicker, /t\("Click a swatch or drag"\)/);

  const handleCard = readFileSync(new URL("../src/views/account/handle-claim-card.tsx", import.meta.url), "utf8");
  assert.match(handleCard, /t\("Change"\).*t\("Claim"\)/);
});

test("Hungarian coverage is clean and includes hard-coded JSX copy", () => {
  const catalog = readFileSync(new URL("../src/lib/i18n/locales/hu.ts", import.meta.url), "utf8");
  const coverage = readFileSync(new URL("../src/lib/i18n/locales/hu/coverage.ts", import.meta.url), "utf8");
  const domCoverage = readFileSync(new URL("../src/lib/i18n/locales/hu/dom.ts", import.meta.url), "utf8");
  const domBridge = readFileSync(new URL("../src/lib/i18n/use-dom-translation.ts", import.meta.url), "utf8");
  const editor = readFileSync(
    new URL("../src/views/settings/player-layout-panel/editor-overlay.tsx", import.meta.url),
    "utf8",
  );

  assert.ok((coverage.match(/^  "/gm) ?? []).length >= 7_700, "full Hungarian catalog is unexpectedly small");
  assert.ok((domCoverage.match(/^  "/gm) ?? []).length >= 3_500, "hard-coded JSX coverage is unexpectedly small");
  assert.doesNotMatch(
    coverage,
    /\?{3,}|\bFel(?:\s+Fel){2,}\b|NemT|Felszoba|T{5,}|A Szo V|Százazalt|City name \(optional|unit description in lists/i,
  );
  assert.match(domBridge, /new MutationObserver/);
  assert.match(domBridge, /language !== "hu"/);
  assert.match(domBridge, /isSettingsCopy/);
  assert.match(domBridge, /\[data-settings-root\]/);
  assert.match(editor, /t\("Layout editor"\)/);
  assert.match(editor, /t\("Click any control to edit it\."\)/);
  assert.match(catalog, /"Volume control": "Hangerőszabályzó"/);
  assert.match(catalog, /"Elapsed and remaining": "Eltelt és hátralévő idő"/);
  assert.match(catalog, /Trakt: "Trakt"/);
  assert.match(catalog, /Letterboxd: "Letterboxd"/);
  assert.match(catalog, /"Harbor Relay": "Harbor Relay"/);
  assert.match(catalog, /"Bar style": "Sáv stílusa"/);
  assert.match(catalog, /Flat_Style: "Egyszínű"/);

  const accountForm = readFileSync(new URL("../src/views/account/account-auth-form.tsx", import.meta.url), "utf8");
  assert.match(accountForm, /\{t\(m\.label\)\}/);
  assert.match(accountForm, /\{t\(active\.action\)\}/);

  const settingsView = readFileSync(new URL("../src/views/settings.tsx", import.meta.url), "utf8");
  assert.match(settingsView, /data-settings-root/);
});

test("Hungary selects Hungarian metadata and media preferences", () => {
  assert.deepEqual(localeForRegion("HU"), {
    uiLanguage: "hu",
    tmdbLanguage: "hu-HU",
    contentLanguage: "hu",
    subtitleLanguage: "Hungarian",
    audioLanguage: "Hungarian",
    rtl: false,
    greetingKey: null,
  });
});
