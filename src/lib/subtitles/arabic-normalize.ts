const ARABIC_COMBINING_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const DIRECTIONAL_AND_ZERO_WIDTH = /[\u061C\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/gu;
const EASTERN_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/gu;

function digitFromCodePoint(character: string, zero: number): string {
  return String((character.codePointAt(0) ?? zero) - zero);
}

/**
 * Produces a comparison key only. The returned text must never replace subtitle
 * display text or be serialized back into a subtitle file.
 */
export function normalizeArabicForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .replace(DIRECTIONAL_AND_ZERO_WIDTH, "")
    .replace(ARABIC_COMBINING_MARKS, "")
    .replace(/\u0640/gu, "")
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/gu, "ا")
    .replace(/[\u0649\u06CC]/gu, "ي")
    .replace(/\u06A9/gu, "ك")
    .replace(ARABIC_INDIC_DIGITS, (character) => digitFromCodePoint(character, 0x0660))
    .replace(EASTERN_ARABIC_INDIC_DIGITS, (character) => digitFromCodePoint(character, 0x06f0))
    .replace(/\u060C/gu, ",")
    .replace(/\u061B/gu, ";")
    .replace(/\u061F/gu, "?")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

export function arabicMatchIncludes(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeArabicForMatch(needle);
  if (!normalizedNeedle) return true;
  return normalizeArabicForMatch(haystack).includes(normalizedNeedle);
}
