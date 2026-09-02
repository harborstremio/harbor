import { LANGUAGES, type UiLanguage } from "@/lib/i18n/languages";

export type LocaleProfile = {
  uiLanguage: UiLanguage;
  tmdbLanguage: string;
  contentLanguage: string;
  subtitleLanguage: string;
  audioLanguage: string;
  rtl: boolean;
  greetingKey: "arabic" | null;
};

const ARAB_REGIONS = new Set([
  "SA",
  "AE",
  "EG",
  "QA",
  "KW",
  "BH",
  "OM",
  "JO",
  "LB",
  "IQ",
  "SY",
  "YE",
  "LY",
  "TN",
  "DZ",
  "MA",
  "SD",
  "PS",
  "MR",
  "SO",
  "DJ",
  "KM",
]);

const LATAM_REGIONS = new Set([
  "MX",
  "AR",
  "CO",
  "CL",
  "PE",
  "VE",
  "EC",
  "GT",
  "CU",
  "BO",
  "DO",
  "HN",
  "PY",
  "SV",
  "NI",
  "CR",
  "PA",
  "UY",
  "PR",
]);

const RUSSOPHONE_REGIONS = new Set(["RU", "BY", "KZ", "KG", "TJ"]);

const LUSOPHONE_REGIONS = new Set(["BR", "PT"]);
const REGIONAL_DEFAULTS: Record<
  string,
  { uiLanguage: UiLanguage; tmdbLanguage: string; language: string }
> = {
  AT: { uiLanguage: "de", tmdbLanguage: "de-AT", language: "German" },
  CN: { uiLanguage: "zh", tmdbLanguage: "zh-CN", language: "Chinese" },
  DE: { uiLanguage: "de", tmdbLanguage: "de-DE", language: "German" },
  FR: { uiLanguage: "fr", tmdbLanguage: "fr-FR", language: "French" },
  ID: { uiLanguage: "id", tmdbLanguage: "id-ID", language: "Indonesian" },
  IN: { uiLanguage: "hi", tmdbLanguage: "hi-IN", language: "Hindi" },
  IT: { uiLanguage: "it", tmdbLanguage: "it-IT", language: "Italian" },
  JP: { uiLanguage: "ja", tmdbLanguage: "ja-JP", language: "Japanese" },
  KR: { uiLanguage: "ko", tmdbLanguage: "ko-KR", language: "Korean" },
  PL: { uiLanguage: "pl", tmdbLanguage: "pl-PL", language: "Polish" },
  TR: { uiLanguage: "tr", tmdbLanguage: "tr-TR", language: "Turkish" },
  VN: { uiLanguage: "vi", tmdbLanguage: "vi-VN", language: "Vietnamese" },
};

const EN: LocaleProfile = {
  uiLanguage: "en",
  tmdbLanguage: "",
  contentLanguage: "",
  subtitleLanguage: "English",
  audioLanguage: "English",
  rtl: false,
  greetingKey: null,
};

export function localeForRegion(region: string): LocaleProfile {
  const r = (region || "").toUpperCase();
  if (ARAB_REGIONS.has(r)) {
    return {
      uiLanguage: "ar",
      tmdbLanguage: `ar-${r}`,
      contentLanguage: "ar",
      subtitleLanguage: "Arabic",
      audioLanguage: "Arabic",
      rtl: true,
      greetingKey: "arabic",
    };
  }
  if (LATAM_REGIONS.has(r)) {
    return {
      uiLanguage: "es",
      tmdbLanguage: `es-${r}`,
      contentLanguage: "es",
      subtitleLanguage: "Spanish (Latin America)",
      audioLanguage: "Spanish",
      rtl: false,
      greetingKey: null,
    };
  }
  if (RUSSOPHONE_REGIONS.has(r)) {
    return {
      uiLanguage: "ru",
      tmdbLanguage: "ru-RU",
      contentLanguage: "ru",
      subtitleLanguage: "Russian",
      audioLanguage: "Russian",
      rtl: false,
      greetingKey: null,
    };
  }
  if (LUSOPHONE_REGIONS.has(r)) {
    return {
      uiLanguage: "pt",
      tmdbLanguage: r === "BR" ? "pt-BR" : "pt-PT",
      contentLanguage: "pt",
      subtitleLanguage: r === "BR" ? "Portuguese (Brazil)" : "Portuguese",
      audioLanguage: "Portuguese",
      rtl: false,
      greetingKey: null,
    };
  }
  if (r === "ES") {
    return {
      uiLanguage: "es",
      tmdbLanguage: "es-ES",
      contentLanguage: "es",
      subtitleLanguage: "Spanish",
      audioLanguage: "Spanish",
      rtl: false,
      greetingKey: null,
    };
  }
  const regional = REGIONAL_DEFAULTS[r];
  if (regional) {
    return {
      ...regional,
      contentLanguage: regional.uiLanguage,
      subtitleLanguage: regional.language,
      audioLanguage: regional.language,
      rtl: false,
      greetingKey: null,
    };
  }
  return EN;
}

export function isLocalizedRegion(region: string): boolean {
  return localeForRegion(region).uiLanguage !== "en";
}

export function localeLabel(profile: LocaleProfile): string {
  const language = LANGUAGES.find(({ code }) => code === profile.uiLanguage);
  if (!language || language.code === "en") return "English";
  if (language.code === "zh") return "简体中文 (Simplified Chinese)";
  return `${language.nativeLabel} (${language.label})`;
}
