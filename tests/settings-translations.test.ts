import assert from "node:assert/strict";
import { test } from "node:test";
import settingsStrings from "../src/lib/i18n/locales/en/settings-refinements";
import { LANGUAGES } from "../src/lib/i18n/languages";
import { ensureUiLocale } from "../src/lib/i18n/load-locale";
import { setUiLanguage } from "../src/lib/i18n/store";
import { t, uiCatalogLoaded } from "../src/lib/i18n/translate";

const variables = (text: string) => [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();

test("settings translations load without missing text or interpolation variables", async () => {
  try {
    for (const { code } of LANGUAGES.filter((language) => language.code !== "en")) {
      await ensureUiLocale(code);
      assert.equal(uiCatalogLoaded(code), true, code);
      setUiLanguage(code);
      for (const key of Object.keys(settingsStrings)) {
        const result = t(key);
        assert.ok(result.trim(), code + ": " + key);
        assert.deepEqual(variables(result), variables(key), code + ": " + key);
        if (key.split(/\s+/).length >= 5) assert.notEqual(result, key, code + ": " + key);
      }
      for (const key of ["App language", "Discovery languages", "Help & about", "Upload a picture of your own, or pick one from the Harbor catalog."]) {
        assert.notEqual(t(key), key, code + ": " + key);
      }
      const result = t("{key} is used for {action}. Press another key or cancel.", { key: "Ctrl+K", action: "Example action" });
      assert.ok(result.includes("Ctrl+K"), code);
      assert.ok(result.includes("Example action"), code);
      assert.equal(result.includes("{key}"), false, code);
      assert.equal(result.includes("{action}"), false, code);
    }
  } finally {
    setUiLanguage("en");
  }
});
