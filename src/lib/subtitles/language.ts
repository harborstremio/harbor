const ISO_3_TO_1: Record<string, string> = {
  eng: "en",
  fre: "fr",
  fra: "fr",
  ger: "de",
  deu: "de",
  spa: "es",
  ita: "it",
  jpn: "ja",
  kor: "ko",
  rus: "ru",
  por: "pt",
  chi: "zh",
  zho: "zh",
  ara: "ar",
  hin: "hi",
  tha: "th",
  vie: "vi",
  tur: "tr",
  pol: "pl",
  dut: "nl",
  nld: "nl",
  swe: "sv",
  nor: "no",
  dan: "da",
  fin: "fi",
  heb: "he",
  ind: "id",
  ces: "cs",
  cze: "cs",
  ell: "el",
  gre: "el",
  hun: "hu",
  rum: "ro",
  ron: "ro",
  ukr: "uk",
  tam: "ta",
  tel: "te",
  mal: "ml",
  kan: "kn",
  ben: "bn",
  mar: "mr",
  guj: "gu",
  pan: "pa",
  urd: "ur",
  ori: "or",
  ory: "or",
  asm: "as",
  nep: "ne",
  sin: "si",
  msa: "ms",
  may: "ms",
  fil: "tl",
  tgl: "tl",
  mya: "my",
  bur: "my",
  khm: "km",
  lao: "lo",
  fas: "fa",
  per: "fa",
  pus: "ps",
  kur: "ku",
  aze: "az",
  kat: "ka",
  geo: "ka",
  hye: "hy",
  arm: "hy",
  kaz: "kk",
  uzb: "uz",
  bul: "bg",
  srp: "sr",
  hrv: "hr",
  bos: "bs",
  slk: "sk",
  slo: "sk",
  slv: "sl",
  lit: "lt",
  lav: "lv",
  est: "et",
  isl: "is",
  ice: "is",
  gle: "ga",
  cat: "ca",
  eus: "eu",
  baq: "eu",
  glg: "gl",
  cym: "cy",
  wel: "cy",
  mlt: "mt",
  sqi: "sq",
  alb: "sq",
  mkd: "mk",
  mac: "mk",
  bel: "be",
  swa: "sw",
  amh: "am",
  afr: "af",
  hau: "ha",
  yor: "yo",
  ibo: "ig",
  zul: "zu",
};

const NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  "es-419": "Spanish (Latin America)",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  pt: "Portuguese",
  "pt-br": "Portuguese (Brazil)",
  ar: "Arabic",
  hi: "Hindi",
  th: "Thai",
  vi: "Vietnamese",
  tr: "Turkish",
  pl: "Polish",
  nl: "Dutch",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  fi: "Finnish",
  he: "Hebrew",
  id: "Indonesian",
  cs: "Czech",
  el: "Greek",
  hu: "Hungarian",
  ro: "Romanian",
  uk: "Ukrainian",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  kn: "Kannada",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
  ur: "Urdu",
  or: "Odia",
  as: "Assamese",
  ne: "Nepali",
  si: "Sinhala",
  ms: "Malay",
  tl: "Filipino",
  my: "Burmese",
  km: "Khmer",
  lo: "Lao",
  fa: "Persian",
  ps: "Pashto",
  ku: "Kurdish",
  az: "Azerbaijani",
  ka: "Georgian",
  hy: "Armenian",
  kk: "Kazakh",
  uz: "Uzbek",
  bg: "Bulgarian",
  sr: "Serbian",
  hr: "Croatian",
  bs: "Bosnian",
  sk: "Slovak",
  sl: "Slovenian",
  lt: "Lithuanian",
  lv: "Latvian",
  et: "Estonian",
  is: "Icelandic",
  ga: "Irish",
  ca: "Catalan",
  eu: "Basque",
  gl: "Galician",
  cy: "Welsh",
  mt: "Maltese",
  sq: "Albanian",
  mk: "Macedonian",
  be: "Belarusian",
  sw: "Swahili",
  am: "Amharic",
  af: "Afrikaans",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
  zu: "Zulu",
};

export const ALL_LANGUAGE_NAMES: string[] = Object.values(NAMES);

const LATAM_ALIASES = new Set([
  "es-419",
  "es-la",
  "lat",
  "latam",
  "latino",
  "latin american spanish",
  "spanish (latin america)",
  "spanish latin america",
  "español latino",
  "espanol latino",
  "español latinoamericano",
]);

const LATAM_REGIONS = new Set([
  "mx",
  "ar",
  "co",
  "cl",
  "pe",
  "ve",
  "ec",
  "gt",
  "cu",
  "bo",
  "do",
  "hn",
  "py",
  "sv",
  "ni",
  "cr",
  "pa",
  "uy",
  "pr",
  "419",
]);

const BRAZIL_ALIASES = new Set([
  "pt-br",
  "pt_br",
  "pob",
  "por-br",
  "brazilian",
  "brazilian portuguese",
  "portuguese (brazil)",
  "portuguese brazil",
  "português (brasil)",
  "portugues (brasil)",
  "português brasil",
  "portugues brasil",
]);

const NAME_TO_CODE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [code, name] of Object.entries(NAMES)) m[name.toLowerCase()] = code;
  m["jp"] = "ja";
  m["mandarin"] = "zh";
  m["cantonese"] = "zh";
  // A few common native names turn up in community addon responses instead
  // of an ISO code or the English language name.
  m["magyar"] = "hu";
  m["angol"] = "en";
  return m;
})();

const UNDETERMINED_LANGS = new Set([
  "",
  "und",
  "unknown",
  "unspecified",
  "unclassified",
  "none",
  "null",
  "n/a",
  "na",
  "other",
  "auto",
  "translation",
  "translated",
]);

export function normalizeLang(input?: string | null): string {
  if (!input) return "";
  const raw = input.trim().toLowerCase();
  if (raw === "multiple" || raw === "mixed" || raw === "multilingual") return "multi";
  if (LATAM_ALIASES.has(raw)) return "es-419";
  if (BRAZIL_ALIASES.has(raw)) return "pt-br";
  if (raw.length === 2) return raw;
  if (raw.length === 3 && ISO_3_TO_1[raw]) return ISO_3_TO_1[raw];
  if (NAME_TO_CODE[raw]) return NAME_TO_CODE[raw];
  if (raw.includes("-") || raw.includes("_")) {
    const [head, region] = raw.split(/[-_]/);
    const headCode = head.length === 2 ? head : (ISO_3_TO_1[head] ?? NAME_TO_CODE[head]);
    if (headCode === "es" && region && LATAM_REGIONS.has(region)) return "es-419";
    if (headCode === "pt" && region === "br") return "pt-br";
    if (headCode) return headCode;
  }
  return raw;
}

export function languageName(code: string): string {
  const n = normalizeLang(code);
  if (!n || UNDETERMINED_LANGS.has(n)) return "Unknown";
  if (n === "multi") return "Multi";
  return NAMES[n] || code.toUpperCase();
}

const IMPLAUSIBLE_LANG_PATTERN =
  /[=<>{}[\]|\\]|\berror\b|\binvalid\b|\btimed?\s*out\b|\bfailed\b|\brequest\b/i;

export function isPlausibleLang(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const s = raw.trim();
  if (!s || s.length > 24) return false;
  return !IMPLAUSIBLE_LANG_PATTERN.test(s);
}

/**
 * Normalize provider metadata without ever losing an otherwise valid
 * subtitle. Community addons are allowed to omit `lang` or return labels such
 * as "translation". Those tracks belong in the picker as undetermined (`und`)
 * instead of being discarded or guessed as English.
 */
export function normalizeSubtitleLang(raw: string | undefined | null): string {
  if (!isPlausibleLang(raw)) return "und";
  const normalized = normalizeLang(raw);
  if (UNDETERMINED_LANGS.has(normalized)) return "und";
  if (
    normalized === "multi" ||
    normalized in NAMES ||
    /^[a-z]{2,3}(?:-[a-z0-9]{2,3})?$/.test(normalized)
  ) {
    return normalized;
  }

  // Some translation addons put prose in the language field, for example
  // "Fordítás: magyar". Recognise a language name inside that label while
  // treating unrelated tool/action labels as undetermined.
  const words = ` ${raw!
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
  const aliases = Object.entries(NAME_TO_CODE).sort(([a], [b]) => b.length - a.length);
  for (const [alias, code] of aliases) {
    const needle = ` ${alias.replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
    if (needle.trim() && words.includes(needle)) return code;
  }
  return "und";
}

export function langScore(lang: string, preferred: string[]): number {
  if (!preferred.length) return 0;
  const n = normalizeLang(lang);
  const baseOf = (c: string) => c.split("-")[0];
  let exactIdx = -1;
  let baseIdx = -1;
  for (let i = 0; i < preferred.length; i++) {
    const pn = normalizeLang(preferred[i]);
    if (exactIdx === -1 && pn === n) exactIdx = i;
    if (baseIdx === -1 && baseOf(pn) === baseOf(n)) baseIdx = i;
  }
  if (exactIdx !== -1) return (preferred.length - exactIdx) * 2;
  if (baseIdx !== -1) return (preferred.length - baseIdx) * 2 - 1;
  return -1;
}

export function filterTracksByPreferredLanguage<T extends { id: string; lang?: string }>(
  tracks: T[],
  preferred: string[],
): T[] {
  if (preferred.length === 0) return tracks;
  return tracks.filter((track) => langScore(track.lang ?? "", preferred) >= 0);
}

export function pickBestTrack<T extends { lang?: string; default?: boolean; forced?: boolean }>(
  tracks: T[],
  preferred: string[],
): T | null {
  if (tracks.length === 0) return null;
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const t of tracks) {
    if (t.forced) continue;
    const ls = langScore(t.lang ?? "", preferred);
    if (ls < 0) continue;
    const score = ls * 10 + (t.default ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
