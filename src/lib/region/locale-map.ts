export type LocaleProfile = {
  language: "en" | "ar" | "es";
  tmdbLanguage: string;
  subtitleLanguage: string;
  audioLanguage: string;
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

const EN: LocaleProfile = {
  language: "en",
  tmdbLanguage: "",
  subtitleLanguage: "English",
  audioLanguage: "English",
};

export function localeForRegion(region: string): LocaleProfile {
  const normalized = region.toUpperCase();
  if (ARAB_REGIONS.has(normalized)) {
    return {
      language: "ar",
      tmdbLanguage: `ar-${normalized}`,
      subtitleLanguage: "Arabic",
      audioLanguage: "Arabic",
    };
  }
  if (LATAM_REGIONS.has(normalized)) {
    return {
      language: "es",
      tmdbLanguage: `es-${normalized}`,
      subtitleLanguage: "Spanish (Latin America)",
      audioLanguage: "Spanish",
    };
  }
  if (normalized === "ES") {
    return {
      language: "es",
      tmdbLanguage: "es-ES",
      subtitleLanguage: "Spanish",
      audioLanguage: "Spanish",
    };
  }
  return EN;
}

export function localeLabel(profile: LocaleProfile): string {
  if (profile.language === "ar") return "العربية (Arabic)";
  if (profile.language === "es") return "Español (Spanish)";
  return "English";
}
