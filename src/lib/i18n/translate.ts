import en from "./locales/en";
import ar from "./locales/ar";
import pt from "./locales/pt";
import ru from "./locales/ru";
import { getUiLanguage, useUiLanguage } from "./store";
import { isRtl, LANGUAGES, type UiLanguage } from "./languages";

type Vars = Record<string, string | number>;

const catalogs: Record<UiLanguage, Record<string, string>> = { en, ar, pt, ru };

export type PluralForm = "one" | "few" | "many";

const VARIANT_SEP = "#";
const VARIANT_SUFFIX = /#(?:one|few|many)$/;

const PLURAL_RULES: Partial<Record<UiLanguage, (n: number) => PluralForm>> = {
  ru: (n) => {
    if (!Number.isInteger(n)) return "many";
    const abs = Math.abs(n);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return "one";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  },
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

const sourceKeysByTranslation = Object.fromEntries(
  (Object.keys(catalogs) as UiLanguage[]).map((language) => {
    const reverse = new Map<string, string>();
    for (const [key, value] of Object.entries(catalogs[language])) {
      const base = key.replace(VARIANT_SUFFIX, "");
      if (!reverse.has(value)) reverse.set(value, base);
    }
    return [language, reverse];
  }),
) as Record<UiLanguage, Map<string, string>>;

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
  const fallback = catalogs.en[key];
  if (fallback !== undefined) return fallback;
  return key;
}

export function t(key: string, vars?: Vars): string {
  return interpolate(resolve(getUiLanguage(), key, vars), vars);
}

export function sourceTranslationKey(value: string): string {
  return sourceKeysByTranslation[getUiLanguage()].get(value) ?? value;
}

export function useT(): (key: string, vars?: Vars) => string {
  const lang = useUiLanguage();
  return (key: string, vars?: Vars) => interpolate(resolve(lang, key, vars), vars);
}

export { useUiLanguage, isRtl, LANGUAGES };
