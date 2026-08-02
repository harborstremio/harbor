const RTL_RANGE = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/;
const ARABIC_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const HARAKAT = /[ً-ْٰـ]/g;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

export function isRtl(s: string): boolean {
  return RTL_RANGE.test(s);
}

export function dirOf(s: string): "rtl" | "ltr" {
  return RTL_RANGE.test(s) ? "rtl" : "ltr";
}

export function hasArabic(s: string): boolean {
  return ARABIC_RANGE.test(s);
}

export function normalizeArabic(s: string): string {
  return s
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(HARAKAT, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function arabicAwareMatch(haystack: string, needleLower: string): boolean {
  if (haystack.toLowerCase().includes(needleLower)) return true;
  if (!hasArabic(haystack) && !hasArabic(needleLower)) return false;
  return normalizeArabic(haystack).includes(normalizeArabic(needleLower));
}
