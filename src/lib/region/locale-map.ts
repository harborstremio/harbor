export type LocaleProfile = {
  uiLanguage: "en" | "ar" | "es" | "pt" | "ru";
  tmdbLanguage: string;
  contentLanguage: string;
  subtitleLanguage: string;
  audioLanguage: string;
  rtl: boolean;
  greetingKey: "arabic" | null;
};

const ARAB_REGIONS = new Set([
  "SA", "AE", "EG", "QA", "KW", "BH", "OM", "JO", "LB", "IQ", "SY", "YE", "LY",
  "TN", "DZ", "MA", "SD", "PS", "MR", "SO", "DJ", "KM",
]);

const LATAM_REGIONS = new Set([
  "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO", "DO", "HN", "PY",
  "SV", "NI", "CR", "PA", "UY", "PR",
]);

const RUSSOPHONE_REGIONS = new Set(["RU", "BY", "KZ", "KG", "TJ"]);

const LUSOPHONE_REGIONS = new Set(["BR", "PT"]);

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
  return EN;
}

export function isLocalizedRegion(region: string): boolean {
  return localeForRegion(region).uiLanguage !== "en";
}

export function localeLabel(profile: LocaleProfile): string {
  if (profile.uiLanguage === "ar") return "العربية (Arabic)";
  if (profile.uiLanguage === "es") return "Español (Spanish)";
  if (profile.uiLanguage === "pt") return "Português (Portuguese)";
  if (profile.uiLanguage === "ru") return "Русский (Russian)";
  return "English";
}
