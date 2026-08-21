// Right-to-left script detection and Arabic-aware text matching. Ported 1:1
// from `iptv/rtl.ts`.

// Hebrew + Arabic (+ supplements) + Arabic/Hebrew presentation forms.
final RegExp _rtlRange = RegExp(
  '[֐-׿؀-ۿݐ-ݿࢠ-ࣿ'
  'יִ-﷿ﹰ-﻿]',
);
// Arabic blocks only (excludes Hebrew).
final RegExp _arabicRange = RegExp('[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]');
// Harakat (diacritics U+064B–U+0652) + superscript alef + tatweel.
final RegExp _harakat = RegExp('[ً-ْٰـ]');
// Alef variants (hamza/madda/wasla) folded to a bare alef.
final RegExp _alefVariants = RegExp('[أإآٱ]');

/// Whether [s] contains any right-to-left script. Ports `isRtl`.
bool isRtl(String s) => _rtlRange.hasMatch(s);

/// The base direction of [s] (`'rtl'` if it contains RTL script). Ports
/// `dirOf`.
String dirOf(String s) => _rtlRange.hasMatch(s) ? 'rtl' : 'ltr';

/// Whether [s] contains Arabic script (Hebrew does not count). Ports
/// `hasArabic`.
bool hasArabic(String s) => _arabicRange.hasMatch(s);

/// Folds Arabic diacritics and letter variants for loose matching. Ports
/// `normalizeArabic`.
String normalizeArabic(String s) => s
    .replaceAll(_harakat, '')
    .replaceAll(_alefVariants, 'ا') // → ا
    .replaceAll('ة', 'ه') // ة → ه
    .replaceAll('ى', 'ي') // ى → ي
    .replaceAll('ؤ', 'و') // ؤ → و
    .replaceAll('ئ', 'ي') // ئ → ي
    .toLowerCase()
    .trim();

/// Substring match that is Arabic-diacritic/variant tolerant. Ports
/// `arabicAwareMatch`.
bool arabicAwareMatch(String haystack, String needleLower) {
  if (haystack.toLowerCase().contains(needleLower)) return true;
  if (!hasArabic(haystack) && !hasArabic(needleLower)) return false;
  return normalizeArabic(haystack).contains(normalizeArabic(needleLower));
}
