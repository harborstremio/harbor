import type { Settings } from "@/lib/settings";

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  japanese: "ja",
  korean: "ko",
  chinese: "zh",
  mandarin: "zh",
  cantonese: "zh",
  hindi: "hi",
  tamil: "ta",
  telugu: "te",
  arabic: "ar",
  russian: "ru",
  swedish: "sv",
  danish: "da",
  norwegian: "no",
  dutch: "nl",
  polish: "pl",
  turkish: "tr",
  thai: "th",
  indonesian: "id",
  vietnamese: "vi",
  hebrew: "he",
  greek: "el",
  finnish: "fi",
  czech: "cs",
  hungarian: "hu",
  romanian: "ro",
  ukrainian: "uk",
  filipino: "tl",
  tagalog: "tl",
  malay: "ms",
};

const REGION_TO_CODE: Record<string, string> = {
  US: "en",
  GB: "en",
  CA: "en",
  AU: "en",
  NZ: "en",
  IE: "en",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  FR: "fr",
  BE: "fr",
  DE: "de",
  AT: "de",
  IT: "it",
  BR: "pt",
  PT: "pt",
  JP: "ja",
  KR: "ko",
  CN: "zh",
  TW: "zh",
  HK: "zh",
  IN: "hi",
  RU: "ru",
  SE: "sv",
  DK: "da",
  NO: "no",
  NL: "nl",
  PL: "pl",
  TR: "tr",
};

function toCode(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  if (/^[a-z]{2}$/.test(v)) return v;
  return LANGUAGE_NAME_TO_CODE[v];
}

export function preferredLangCodes(settings: Settings): string[] {
  const out = new Set<string>();
  for (const name of settings.preferredLanguages ?? []) {
    const code = toCode(name);
    if (code) out.add(code);
  }
  const tmdbLang = settings.tmdbLanguage?.split("-")[0];
  if (tmdbLang) {
    const code = toCode(tmdbLang);
    if (code) out.add(code);
  }
  if (out.size === 0) {
    const fromRegion = REGION_TO_CODE[settings.region?.toUpperCase() ?? ""];
    if (fromRegion) out.add(fromRegion);
  }
  return [...out];
}

export function localizeFloor(
  floor: Record<string, string>,
  settings: Settings,
  mediaType: "movie" | "tv",
): Record<string, string> {
  if (mediaType !== "movie" || !settings.region) return floor;
  return { ...floor, region: settings.region };
}

export function localeWeights(settings: Settings): { codes: Set<string>; penalty: number } {
  if (!settings.feedLocaleBias) return { codes: new Set(), penalty: 0 };
  const codes = preferredLangCodes(settings);
  if (codes.length === 0) return { codes: new Set(), penalty: 0 };
  return { codes: new Set(codes), penalty: 3 };
}
