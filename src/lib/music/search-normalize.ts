const INVISIBLE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const COMBINING =
  // Match individual marks, not a composed glyph, for accent-insensitive search.
  // eslint-disable-next-line no-misleading-character-class
  /[\u0300-\u036f\u0483-\u0489\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20f0\ufe20-\ufe2f]/g;
const ARABIC_MARKS = /[ً-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const APOSTROPHE = /['`´ʻʼ‘’]/g;
const AMPERSAND = /[&﹠＆]/g;
const NON_WORD = /[^\p{L}\p{N}]+/gu;
const CYRILLIC = /[Ѐ-ӿ]/;
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

const ARABIC_FOLD: Array<[RegExp, string]> = [
  [/[آأإٱٲٳٵ]/g, "ا"],
  [/ة/g, "ه"],
  [/[ىئیے]/g, "ي"],
  [/ؤ/g, "و"],
  [/[کڪ]/g, "ك"],
  [/ء/g, ""],
];

const LATIN_FOLD: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  þ: "th",
  ł: "l",
  ħ: "h",
  ı: "i",
  ŋ: "ng",
  ſ: "s",
};

const CYRILLIC_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ґ: "g",
  д: "d",
  е: "e",
  ё: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "i",
  і: "i",
  ї: "yi",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ў: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const NOISE_WORDS = new Set([
  "official",
  "music",
  "video",
  "videos",
  "audio",
  "lyric",
  "lyrics",
  "visualizer",
  "visualiser",
  "hd",
  "hq",
  "4k",
  "8k",
  "uhd",
  "full",
  "original",
  "mix",
  "extended",
  "radio",
  "edit",
  "single",
  "album",
  "version",
  "remaster",
  "remastered",
  "master",
  "mastered",
  "mono",
  "stereo",
  "explicit",
  "clean",
  "deluxe",
  "edition",
  "bonus",
  "track",
  "tracks",
  "anniversary",
  "expanded",
  "digital",
  "reissue",
  "vevo",
  "mv",
  "compilation",
  "compilations",
]);

const FEATURE_SUFFIX = /[\s([]*\b(?:feat|ft|featuring)\b\.?\s+[^)\]]*[)\]]?\s*$/i;
const BRACKET_SUFFIX = /\s*[([{]([^()[\]{}]*)[)\]}]\s*$/;
const DASH_SUFFIX = /\s+[-‐-―−]\s+([^-‐-―−]+)\s*$/;

export function stripInvisible(text: string): string {
  return text.replace(INVISIBLE, "");
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function hasCyrillic(text: string): boolean {
  return CYRILLIC.test(text);
}

export function hasArabic(text: string): boolean {
  return ARABIC.test(text);
}

/** Tatweel, harakat, alef and ta marbuta variants all collapse so Gulf spellings match. */
export function foldArabic(text: string): string {
  let value = text.replace(TATWEEL, "").replace(ARABIC_MARKS, "");
  for (const [pattern, replacement] of ARABIC_FOLD) value = value.replace(pattern, replacement);
  return value.replace(ARABIC_DIGITS, (character) => String(character.charCodeAt(0) & 0xf));
}

/**
 * Decomposes and drops the generic combining-mark blocks only, so Latin accents,
 * Cyrillic breve and diaeresis fold away while Arabic, Hebrew and Indic bases survive.
 * Folding Cyrillic yo to ye and short-i to i is deliberate: Russian speakers type both.
 */
export function stripDiacritics(text: string): string {
  const folded = text.normalize("NFD").replace(COMBINING, "");
  return folded.replace(/[ßæðøþđħıłŋœſ]/g, (character) => LATIN_FOLD[character] ?? character);
}

export function transliterateCyrillic(text: string): string {
  return text.replace(/[Ѐ-ӿ]/g, (character) => {
    const mapped = CYRILLIC_LATIN[character.toLowerCase()];
    return mapped === undefined ? character : mapped;
  });
}

/** Plain lowercase, never locale aware: a Turkish locale would fold I to a dotless i. */
export function normalizeName(text: string): string {
  if (!text) return "";
  const folded = stripDiacritics(foldArabic(stripInvisible(text.normalize("NFKC"))).toLowerCase());
  const plain = folded.replace(APOSTROPHE, "").replace(AMPERSAND, " and ").replace(NON_WORD, " ");
  return collapseWhitespace(plain).normalize("NFC");
}

export function stripFeatureCredit(text: string): string {
  const stripped = text.replace(FEATURE_SUFFIX, "").trim();
  return stripped ? stripped : text;
}

function isNoiseGroup(group: string): boolean {
  const words = normalizeName(group).split(" ").filter(Boolean);
  return (
    words.length > 0 &&
    words.every((word) => NOISE_WORDS.has(word) || /^(?:19|20)\d{2}$/.test(word))
  );
}

function stripOneSuffix(text: string): string {
  const withoutFeature = stripFeatureCredit(text);
  if (withoutFeature !== text) return withoutFeature;
  const bracket = BRACKET_SUFFIX.exec(text);
  if (bracket && isNoiseGroup(bracket[1])) {
    const head = text.slice(0, bracket.index).trim();
    if (head) return head;
  }
  const dash = DASH_SUFFIX.exec(text);
  if (dash && isNoiseGroup(dash[1])) {
    const head = text.slice(0, dash.index).trim();
    if (head) return head;
  }
  return text;
}

/** Drops release chrome only. Live, remix, instrumental and karaoke name a different recording. */
export function stripNoiseSuffix(text: string): string {
  let value = text.trim();
  for (let pass = 0; pass < 4; pass += 1) {
    const next = stripOneSuffix(value);
    if (next === value) return value;
    value = next;
  }
  return value;
}

export function normalizeTitle(text: string): string {
  if (!text) return "";
  return normalizeName(stripNoiseSuffix(text));
}

export function tokenize(text: string): string[] {
  const normalized = normalizeName(text);
  return normalized ? normalized.split(" ") : [];
}
