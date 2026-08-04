export type MangaSummary = {
  id: string;
  title: string;
  altTitle?: string;
  cover?: string;
  year?: number;
  status?: string;
  description?: string;
  contentRating?: string;
  lastChapter?: string;
  author?: string;
};

export type MangaChapter = {
  id: string;
  chapter: string | null;
  title?: string;
  volume?: string | null;
  pages: number;
  language: string;
  group?: string;
  publishAt?: string;
  downloaded?: boolean;
};

export type MangaTag = { id: string; name: string; group: string };

export const MANGA_PAGE = 48;

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  "es-la": "Spanish (LATAM)",
  es: "Spanish",
  "pt-br": "Portuguese (BR)",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  ru: "Russian",
  id: "Indonesian",
  it: "Italian",
  pl: "Polish",
  vi: "Vietnamese",
  tr: "Turkish",
  ar: "Arabic",
  zh: "Chinese (Simp)",
  "zh-hk": "Chinese (Trad)",
  ko: "Korean",
  th: "Thai",
  uk: "Ukrainian",
  hu: "Hungarian",
  nl: "Dutch",
  fil: "Filipino",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

const LANGUAGE_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  ja: "🇯🇵",
  "es-la": "🇲🇽",
  es: "🇪🇸",
  "pt-br": "🇧🇷",
  pt: "🇵🇹",
  fr: "🇫🇷",
  de: "🇩🇪",
  ru: "🇷🇺",
  id: "🇮🇩",
  it: "🇮🇹",
  pl: "🇵🇱",
  vi: "🇻🇳",
  tr: "🇹🇷",
  ar: "🇸🇦",
  zh: "🇨🇳",
  "zh-hk": "🇭🇰",
  ko: "🇰🇷",
  th: "🇹🇭",
  uk: "🇺🇦",
  hu: "🇭🇺",
  nl: "🇳🇱",
  fil: "🇵🇭",
  ka: "🇬🇪",
  kk: "🇰🇿",
  ro: "🇷🇴",
  cs: "🇨🇿",
  sk: "🇸🇰",
  bg: "🇧🇬",
  sr: "🇷🇸",
  hr: "🇭🇷",
  el: "🇬🇷",
  he: "🇮🇱",
  fa: "🇮🇷",
  hi: "🇮🇳",
  bn: "🇧🇩",
  ta: "🇮🇳",
  ms: "🇲🇾",
  my: "🇲🇲",
  ca: "🇪🇸",
  fi: "🇫🇮",
  sv: "🇸🇪",
  no: "🇳🇴",
  nb: "🇳🇴",
  da: "🇩🇰",
  lt: "🇱🇹",
  et: "🇪🇪",
  sl: "🇸🇮",
  mn: "🇲🇳",
  ne: "🇳🇵",
};

export function languageFlag(code: string): string {
  return LANGUAGE_FLAGS[code] ?? "🏳️";
}

export function chapterLanguages(chapters: MangaChapter[]): Array<{ code: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of chapters) counts.set(c.language, (counts.get(c.language) ?? 0) + 1);
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => (a.code === "en" ? -1 : b.code === "en" ? 1 : b.count - a.count));
}
