import { useSyncExternalStore } from "react";
import en from "./locales/en";
import { getUiLanguage, useUiLanguage } from "./store";
import { isRtl, LANGUAGES, type UiLanguage } from "./languages";

type Vars = Record<string, string | number>;

// Only English is wired in here. Translated catalogs are large data chunks,
// so both desktop and television load only the selected locale before mount.
// Runtime language changes use the same loader and notify this module again
// when the local chunk is registered.
const catalogs: Partial<Record<UiLanguage, Record<string, string>>> = { en };

let version = 0;
const listeners = new Set<() => void>();

export function registerUiCatalog(lang: UiLanguage, table: Record<string, string>): void {
  if (lang === "en" || catalogs[lang]) return;
  catalogs[lang] = table;
  reverseCache.delete(lang);
  version += 1;
  for (const fn of listeners) fn();
}

export function uiCatalogVersion(): number {
  return version;
}

export function subscribeUiCatalog(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function uiCatalogLoaded(lang: UiLanguage): boolean {
  return Boolean(catalogs[lang]);
}

export type PluralForm = "one" | "few" | "many";

const VARIANT_SEP = "#";
const VARIANT_SUFFIX = /#(?:one|few|many)$/;

const oneForOne = (n: number): PluralForm =>
  Number.isInteger(n) && Math.abs(n) === 1 ? "one" : "many";
const oneForZeroOrOne = (n: number): PluralForm =>
  Number.isInteger(n) && Math.abs(n) <= 1 ? "one" : "many";
const pluralInvariant = (): PluralForm => "many";

const PLURAL_RULES: Partial<Record<UiLanguage, (n: number) => PluralForm>> = {
  ar: (n) => {
    if (!Number.isInteger(n)) return "many";
    const abs = Math.abs(n);
    if (abs === 1) return "one";
    const mod100 = abs % 100;
    return mod100 >= 2 && mod100 <= 10 ? "few" : "many";
  },
  de: oneForOne,
  es: oneForOne,
  fr: oneForZeroOrOne,
  hi: oneForZeroOrOne,
  id: pluralInvariant,
  it: oneForOne,
  ja: pluralInvariant,
  ko: pluralInvariant,
  pl: (n) => {
    if (!Number.isInteger(n)) return "many";
    const abs = Math.abs(n);
    if (abs === 1) return "one";
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  },
  pt: oneForZeroOrOne,
  ru: (n) => {
    if (!Number.isInteger(n)) return "many";
    const abs = Math.abs(n);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return "one";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  },
  tr: pluralInvariant,
  vi: pluralInvariant,
  zh: pluralInvariant,
};

export function pluralForm(lang: UiLanguage, n: number): PluralForm | null {
  return PLURAL_RULES[lang]?.(n) ?? null;
}

function countFor(key: string, vars?: Vars): number | null {
  if (!vars) return null;
  for (const match of key.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
    const value = vars[match[1]];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

// Built for the active language on first use instead of walking every catalog.
const reverseCache = new Map<UiLanguage, Map<string, string>>();

function reverseFor(lang: UiLanguage): Map<string, string> {
  const hit = reverseCache.get(lang);
  if (hit) return hit;
  const reverse = new Map<string, string>();
  for (const [key, value] of Object.entries(catalogs[lang] ?? {})) {
    const base = key.replace(VARIANT_SUFFIX, "");
    if (!reverse.has(value)) reverse.set(value, base);
  }
  reverseCache.set(lang, reverse);
  return reverse;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  let out = template;
  for (const [name, value] of Object.entries(vars)) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}

function resolve(lang: UiLanguage, key: string, vars?: Vars): string {
  const catalog = catalogs[lang];
  if (catalog) {
    const rule = PLURAL_RULES[lang];
    if (rule) {
      const n = countFor(key, vars);
      if (n !== null) {
        const variant = catalog[`${key}${VARIANT_SEP}${rule(n)}`];
        if (variant !== undefined) return variant;
      }
    }
    const active = catalog[key];
    if (active !== undefined) return active;
  }
  const fallback = en[key];
  if (fallback !== undefined) return fallback;
  return key;
}

export function t(key: string, vars?: Vars): string {
  return interpolate(resolve(getUiLanguage(), key, vars), vars);
}

export function sourceTranslationKey(value: string): string {
  return reverseFor(getUiLanguage()).get(value) ?? value;
}

export function useT(): (key: string, vars?: Vars) => string {
  const lang = useUiLanguage();
  useSyncExternalStore(subscribeUiCatalog, uiCatalogVersion, uiCatalogVersion);
  return (key: string, vars?: Vars) => interpolate(resolve(lang, key, vars), vars);
}

export { useUiLanguage, isRtl, LANGUAGES };
