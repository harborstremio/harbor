import { useSyncExternalStore } from "react";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import pt from "./locales/pt.json";

export const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
] as const;

export type UiLanguage = (typeof LANGUAGES)[number]["code"];
export type LanguageOption = (typeof LANGUAGES)[number];
export type TextDirection = "ltr" | "rtl";

type Vars = Record<string, string | number>;
type Catalog = Record<string, string>;

export const DEFAULT_LANGUAGE: UiLanguage = "en";

const supportedLanguages = new Set<string>(LANGUAGES.map(({ code }) => code));
const catalogs: Record<UiLanguage, Catalog> = { en, ar, pt };
const sourceKeysByTranslation = Object.fromEntries(
  (Object.keys(catalogs) as UiLanguage[]).map((language) => {
    const reverse = new Map<string, string>();
    for (const [key, value] of Object.entries(catalogs[language])) {
      if (!reverse.has(value)) reverse.set(value, key);
    }
    return [language, reverse];
  }),
) as Record<UiLanguage, Map<string, string>>;
const rtlLanguages = new Set([
  "ar",
  "arc",
  "ckb",
  "dv",
  "fa",
  "he",
  "nqo",
  "ps",
  "sd",
  "syr",
  "ug",
  "ur",
  "yi",
]);
const rtlScripts = new Set(["adlm", "arab", "hebr", "nkoo", "rohg", "syrc", "thaa"]);

function languageParts(tag: string): string[] {
  const parts = tag.trim().toLowerCase().replaceAll("_", "-").split("-").filter(Boolean);
  const extensionIndex = parts.findIndex((part, index) => index > 0 && part.length === 1);
  return extensionIndex === -1 ? parts : parts.slice(0, extensionIndex);
}

function systemLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

export function normalizeLanguage(language: unknown): UiLanguage {
  if (typeof language !== "string") return DEFAULT_LANGUAGE;
  const base = languageParts(language)[0];
  return supportedLanguages.has(base) ? (base as UiLanguage) : DEFAULT_LANGUAGE;
}

export function detectUiLanguage(preferred: readonly string[] = systemLanguages()): UiLanguage {
  for (const language of preferred) {
    const base = languageParts(language)[0];
    if (supportedLanguages.has(base)) return base as UiLanguage;
  }
  return DEFAULT_LANGUAGE;
}

export function resolveUiLanguage(
  stored: unknown,
  preferred: readonly string[] = systemLanguages(),
): UiLanguage {
  if (typeof stored === "string" && supportedLanguages.has(stored)) return stored as UiLanguage;
  return detectUiLanguage(preferred);
}

export function directionForLanguage(language: string): TextDirection {
  const parts = languageParts(language);
  const script = parts.slice(1).find((part) => /^[a-z]{4}$/.test(part));
  if (script) return rtlScripts.has(script) ? "rtl" : "ltr";
  return rtlLanguages.has(parts[0] ?? "") ? "rtl" : "ltr";
}

export function isRtl(language: string): boolean {
  return directionForLanguage(language) === "rtl";
}

let current = detectUiLanguage();
const listeners = new Set<() => void>();

function applyDocument(language: UiLanguage): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.documentElement.dir = directionForLanguage(language);
}

export function getUiLanguage(): UiLanguage {
  return current;
}

export function setUiLanguage(language: UiLanguage): void {
  const next = normalizeLanguage(language);
  applyDocument(next);
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUiLanguage(): UiLanguage {
  return useSyncExternalStore(subscribe, getUiLanguage, getUiLanguage);
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  let result = template;
  for (const [name, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${name}}`, String(value));
  }
  return result;
}

function resolve(language: UiLanguage, key: string): string {
  return catalogs[language][key] ?? catalogs.en[key] ?? key;
}

export function t(key: string, vars?: Vars): string {
  return interpolate(resolve(getUiLanguage(), key), vars);
}

export function sourceTranslationKey(value: string): string {
  return sourceKeysByTranslation[getUiLanguage()].get(value) ?? value;
}

export function useT(): (key: string, vars?: Vars) => string {
  const language = useUiLanguage();
  return (key, vars) => interpolate(resolve(language, key), vars);
}
