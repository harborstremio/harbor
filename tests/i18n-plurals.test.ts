import test from "node:test";
import assert from "node:assert/strict";
import { pluralForm } from "../src/lib/i18n/translate.ts";

test("russian plural categories follow the last-digit rule", () => {
  const one = [1, 21, 31, 101, 1001];
  const few = [2, 3, 4, 22, 23, 24, 102, 1003];
  const many = [0, 5, 6, 9, 10, 20, 25, 30, 100, 1000];
  for (const n of one) assert.equal(pluralForm("ru", n), "one", `${n} should be "one"`);
  for (const n of few) assert.equal(pluralForm("ru", n), "few", `${n} should be "few"`);
  for (const n of many) assert.equal(pluralForm("ru", n), "many", `${n} should be "many"`);
});

test("the teens are all many, including 11 and 21-adjacent traps", () => {
  for (let n = 11; n <= 14; n++) assert.equal(pluralForm("ru", n), "many", `${n} should be "many"`);
  for (let n = 111; n <= 114; n++) assert.equal(pluralForm("ru", n), "many", `${n} should be "many"`);
  assert.equal(pluralForm("ru", 11), "many");
  assert.equal(pluralForm("ru", 21), "one");
});

test("negatives mirror positives and non-integers fall back to many", () => {
  assert.equal(pluralForm("ru", -1), "one");
  assert.equal(pluralForm("ru", -3), "few");
  assert.equal(pluralForm("ru", -11), "many");
  assert.equal(pluralForm("ru", 1.5), "many");
  assert.equal(pluralForm("ru", Number.NaN), "many");
});

test("two-form languages declare no rule, so they keep the old single-lookup path", () => {
  for (const lang of ["en", "pt", "ar"] as const) {
    assert.equal(pluralForm(lang, 1), null);
    assert.equal(pluralForm(lang, 5), null);
  }
});

const VARIANT_SUFFIX = /#(?:one|few|many)$/;

test("a plain key containing # is not mistaken for a plural variant", async () => {
  const ru = (await import("../src/lib/i18n/locales/ru.ts")).default;
  const withHash = Object.keys(ru).filter((k) => k.includes("#") && !VARIANT_SUFFIX.test(k));
  for (const k of withHash) {
    assert.equal(k.replace(VARIANT_SUFFIX, ""), k, `${k} must survive variant stripping intact`);
  }
});

test("t() returns a different Russian string for 1, 3 and 5", async () => {
  const { setUiLanguage, getUiLanguage } = await import("../src/lib/i18n/store.ts");
  const { t } = await import("../src/lib/i18n/translate.ts");
  const before = getUiLanguage();
  try {
    setUiLanguage("ru");
    const key = "All {n} channels loaded";
    const one = t(key, { n: 1 });
    const few = t(key, { n: 3 });
    const many = t(key, { n: 5 });

    assert.ok(one.includes("1") && few.includes("3") && many.includes("5"), "count interpolated");
    assert.notEqual(one, few, "1 and 3 must not share a form");
    assert.notEqual(few, many, "3 and 5 must not share a form");

    assert.equal(t(key, { n: 21 }).replace("21", "1"), one);
    assert.equal(t(key, { n: 22 }).replace("22", "3"), few);
    assert.equal(t(key, { n: 11 }).replace("11", "5"), many);

    setUiLanguage("en");
    assert.equal(t(key, { n: 3 }), "All 3 channels loaded");
  } finally {
    setUiLanguage(before);
  }
});

test("the ru catalog ships variants and they actually differ", async () => {
  const ru = (await import("../src/lib/i18n/locales/ru.ts")).default;
  const variants = Object.keys(ru).filter((k) => VARIANT_SUFFIX.test(k));
  assert.ok(variants.length > 50, `expected plural variants, found ${variants.length}`);

  for (const variant of variants) {
    const base = variant.replace(VARIANT_SUFFIX, "");
    assert.ok(ru[base] !== undefined, `${variant} has no base key`);
    const ph = (s: string) => (s.match(/\{[A-Za-z0-9_]+\}/g) ?? []).sort().join(",");
    assert.equal(ph(ru[variant]), ph(ru[base]), `${variant} lost a placeholder`);
  }

  const sample = variants
    .map((v) => v.replace(VARIANT_SUFFIX, ""))
    .find((base) => ru[`${base}#one`] && ru[`${base}#few`] && ru[`${base}#one`] !== ru[base]);
  assert.ok(sample, "no key has a distinct one/few/many set");
  assert.notEqual(ru[`${sample}#one`], ru[sample], "one and many should differ");
});
