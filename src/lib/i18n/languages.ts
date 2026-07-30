export type UiLanguage = "en" | "ar" | "pt" | "ru";

export type LanguageOption = {
  code: UiLanguage;
  label: string;
  nativeLabel: string;
  greeting: string;
  rtl: boolean;
};

export const DEFAULT_LANGUAGE: UiLanguage = "en";

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", greeting: "Hello", rtl: false },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", greeting: "مرحبا", rtl: true },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", greeting: "Olá", rtl: false },
  { code: "ru", label: "Russian", nativeLabel: "Русский", greeting: "Привет", rtl: false },
];

const BY_CODE = new Map<string, LanguageOption>(LANGUAGES.map((l) => [l.code, l]));

export function normalizeLanguage(lang: unknown): UiLanguage {
  return typeof lang === "string" && BY_CODE.has(lang) ? (lang as UiLanguage) : DEFAULT_LANGUAGE;
}

export function isRtl(lang: UiLanguage): boolean {
  return BY_CODE.get(lang)?.rtl ?? false;
}
