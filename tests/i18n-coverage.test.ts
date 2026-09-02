// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { LANGUAGES as UI_LANGUAGES } from "../src/lib/i18n/languages.ts";
import en from "../src/lib/i18n/locales/en.ts";
import arCoverage from "../src/lib/i18n/locales/ar/coverage.ts";
import deCoverage from "../src/lib/i18n/locales/de/coverage.ts";
import esCoverage from "../src/lib/i18n/locales/es/coverage.ts";
import frCoverage from "../src/lib/i18n/locales/fr/coverage.ts";
import hiCoverage from "../src/lib/i18n/locales/hi/coverage.ts";
import idCoverage from "../src/lib/i18n/locales/id/coverage.ts";
import itCoverage from "../src/lib/i18n/locales/it/coverage.ts";
import jaCoverage from "../src/lib/i18n/locales/ja/coverage.ts";
import koCoverage from "../src/lib/i18n/locales/ko/coverage.ts";
import plCoverage from "../src/lib/i18n/locales/pl/coverage.ts";
import ptCoverage from "../src/lib/i18n/locales/pt/coverage.ts";
import ruCoverage from "../src/lib/i18n/locales/ru/coverage.ts";
import trCoverage from "../src/lib/i18n/locales/tr/coverage.ts";
import viCoverage from "../src/lib/i18n/locales/vi/coverage.ts";
import zhCoverage from "../src/lib/i18n/locales/zh/coverage.ts";

const ROOT = new URL("../", import.meta.url);
const LANGS = [
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
] as const;
const CALL = /\b(?:t|tr)\(\s*(["'])((?:\\.|(?!\1)[^\\])*?)\1/g;
const KEY = /^\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([A-Za-z_$][A-Za-z0-9_$]*))\s*:/gm;
const COVERAGE = {
  ar: arCoverage,
  de: deCoverage,
  es: esCoverage,
  fr: frCoverage,
  hi: hiCoverage,
  id: idCoverage,
  it: itCoverage,
  ja: jaCoverage,
  ko: koCoverage,
  pl: plCoverage,
  pt: ptCoverage,
  ru: ruCoverage,
  tr: trCoverage,
  vi: viCoverage,
  zh: zhCoverage,
};

function walk(dir: URL, out: URL[] = []): URL[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = new URL(e.isDirectory() ? `${e.name}/` : e.name, dir);
    if (e.isDirectory()) {
      if (p.pathname.includes("/i18n/")) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function uiStrings(): Set<string> {
  const out = new Set<string>();
  for (const f of walk(new URL("src/", ROOT))) {
    const src = readFileSync(f, "utf8");
    let m: RegExpExecArray | null;
    CALL.lastIndex = 0;
    while ((m = CALL.exec(src))) {
      const k = m[2].replace(/\\"/g, '"').replace(/\\'/g, "'");
      if (k && k.length <= 300) out.add(k);
    }
  }
  const ageGate = readFileSync(new URL("src/components/age-gate-modal.tsx", ROOT), "utf8");
  const bankStart = ageGate.indexOf("const QUESTION_BANK");
  const bankEnd = ageGate.indexOf("const AR_QUESTION_BANK", bankStart);
  assert.ok(bankStart >= 0 && bankEnd > bankStart, "age gate question bank is missing");
  const questionBlock = ageGate.slice(bankStart, bankEnd);
  for (const match of questionBlock.matchAll(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g)) {
    const key = match[2].replace(/\\(["'\\])/g, "$1");
    if (key) out.add(key);
  }
  return out;
}

function localeKeys(lang: string): Set<string> {
  const out = new Set<string>();
  const files = [new URL(`src/lib/i18n/locales/${lang}.ts`, ROOT)];
  const dir = new URL(`src/lib/i18n/locales/${lang}/`, ROOT);
  for (const e of readdirSync(dir)) if (e.endsWith(".ts")) files.push(new URL(e, dir));
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    let m: RegExpExecArray | null;
    KEY.lastIndex = 0;
    while ((m = KEY.exec(src))) {
      const key = m[1] ?? m[2] ?? m[3];
      out.add(key.replace(/\\"/g, '"').replace(/\\'/g, "'"));
    }
  }
  return out;
}

const strings = uiStrings();

test("every translated language covers every UI string", () => {
  assert.ok(strings.size > 4000, `only found ${strings.size} UI strings, the scanner is broken`);
  for (const lang of LANGS) {
    const have = localeKeys(lang);
    const missing = [...strings].filter((k) => !have.has(k));
    assert.equal(
      missing.length,
      0,
      `${lang} is missing ${missing.length}: ${missing
        .slice(0, 6)
        .map((s) => JSON.stringify(s))
        .join(", ")}`,
    );
  }
});

test("genre names reach the catalogs even though nothing passes them as a literal", () => {
  const tags = readFileSync(new URL("src/lib/feed/tags.ts", ROOT), "utf8");
  const block = (name: string) => {
    const a = tags.indexOf(`export const ${name}`);
    return tags.slice(a, tags.indexOf("};", a));
  };
  const ENTRY = /^\s*(?:"([^"]+)"|([A-Za-z][A-Za-z0-9_]*))\s*:\s*\d+\s*,/gm;
  const names = new Set<string>();
  for (const b of [block("MOVIE_GENRES"), block("TV_GENRES")]) {
    for (const m of b.matchAll(ENTRY)) names.add(m[1] ?? m[2]);
  }
  assert.ok(names.size > 15, `only found ${names.size} genres, the scanner is broken`);
  for (const lang of LANGS) {
    const have = localeKeys(lang);
    const missing = [...names].filter((g) => !have.has(g));
    assert.deepEqual(missing, [], `${lang} is missing ${missing.length} genre names`);
  }
});

test("dynamic display language labels reach every catalog", () => {
  const labels = [...UI_LANGUAGES.map(({ label }) => label), "Right to left"];
  for (const lang of LANGS) {
    const have = localeKeys(lang);
    const missing = labels.filter((label) => !have.has(label));
    assert.deepEqual(missing, [], `${lang} is missing display language labels`);
  }
});

test("a translation never drops or invents a placeholder", () => {
  const ph = (s: string) => (s.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) ?? []).sort().join(",");
  for (const lang of LANGS) {
    let checked = 0;
    for (const [k, v] of Object.entries(COVERAGE[lang])) {
      assert.equal(ph(v), ph(en[k] ?? k), `${lang}: placeholders differ for ${JSON.stringify(k)}`);
      assert.ok(v.trim().length > 0, `${lang}: empty translation for ${JSON.stringify(k)}`);
      checked++;
    }
    assert.ok(checked > 400, `${lang}/coverage.ts only parsed ${checked} entries`);
  }
});

test("every locale barrel includes coverage and partitioned catalog layers", () => {
  for (const lang of LANGS) {
    const src = readFileSync(new URL(`src/lib/i18n/locales/${lang}.ts`, ROOT), "utf8");
    const spreads = src.match(/\.\.\.[A-Za-z_$][A-Za-z0-9_$]*,/g) ?? [];
    assert.ok(spreads.includes("...coverage,"), `${lang}.ts does not spread coverage`);
    assert.ok(spreads.length > 5, `${lang}.ts does not partition its catalog`);
  }
});
