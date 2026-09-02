export type UiLanguage =
  | "en"
  | "ar"
  | "de"
  | "es"
  | "fr"
  | "hi"
  | "id"
  | "it"
  | "ja"
  | "ko"
  | "pl"
  | "pt"
  | "ru"
  | "tr"
  | "vi"
  | "zh";

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
  {
    code: "zh",
    label: "Chinese (Simplified)",
    nativeLabel: "简体中文",
    greeting: "你好",
    rtl: false,
  },
  { code: "fr", label: "French", nativeLabel: "Français", greeting: "Bonjour", rtl: false },
  { code: "de", label: "German", nativeLabel: "Deutsch", greeting: "Hallo", rtl: false },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", greeting: "नमस्ते", rtl: false },
  {
    code: "id",
    label: "Indonesian",
    nativeLabel: "Bahasa Indonesia",
    greeting: "Halo",
    rtl: false,
  },
  { code: "it", label: "Italian", nativeLabel: "Italiano", greeting: "Ciao", rtl: false },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", greeting: "こんにちは", rtl: false },
  { code: "ko", label: "Korean", nativeLabel: "한국어", greeting: "안녕하세요", rtl: false },
  { code: "pl", label: "Polish", nativeLabel: "Polski", greeting: "Cześć", rtl: false },
  { code: "pt", label: "Portuguese (Brazil)", nativeLabel: "Português", greeting: "Olá", rtl: false },
  { code: "ru", label: "Russian", nativeLabel: "Русский", greeting: "Привет", rtl: false },
  { code: "es", label: "Spanish", nativeLabel: "Español", greeting: "Hola", rtl: false },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe", greeting: "Merhaba", rtl: false },
  { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt", greeting: "Xin chào", rtl: false },
];

const BY_CODE = Object.fromEntries(
  LANGUAGES.map((language) => [language.code, language]),
) as Record<UiLanguage, LanguageOption>;

export function normalizeLanguage(lang: unknown): UiLanguage {
  if (typeof lang !== "string") return DEFAULT_LANGUAGE;
  const code = lang.trim().toLowerCase().split(/[-_]/, 1)[0] as UiLanguage;
  return BY_CODE[code]?.code === code ? code : DEFAULT_LANGUAGE;
}

export function isRtl(lang: UiLanguage): boolean {
  return BY_CODE[lang]?.rtl ?? false;
}
