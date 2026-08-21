/// Lowercase Latin diacritic fold — the Dart stand-in for the web's
/// `normalize("NFKD").replace(/[̀-ͯ]/g, "")`, which strips accents so
/// "Amélie" tokenises as "amelie".
const Map<String, String> _foldMap = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a',
  'ă': 'a', 'ą': 'a', //
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ĕ': 'e', 'ė': 'e',
  'ę': 'e', 'ě': 'e', //
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ĩ': 'i', 'ī': 'i', 'ĭ': 'i',
  'į': 'i', 'ı': 'i', //
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'ō': 'o',
  'ŏ': 'o', 'ő': 'o', //
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ũ': 'u', 'ū': 'u', 'ŭ': 'u',
  'ů': 'u', 'ű': 'u', 'ų': 'u', //
  'ç': 'c', 'ć': 'c', 'ĉ': 'c', 'ċ': 'c', 'č': 'c', //
  'ñ': 'n', 'ń': 'n', 'ņ': 'n', 'ň': 'n', //
  'ý': 'y', 'ÿ': 'y', 'ŷ': 'y', //
  'ś': 's', 'ŝ': 's', 'ş': 's', 'š': 's', //
  'ź': 'z', 'ż': 'z', 'ž': 'z', //
  'ĝ': 'g', 'ğ': 'g', 'ġ': 'g', 'ģ': 'g', //
  'ð': 'd', 'đ': 'd', 'þ': 't', 'ł': 'l',
};

final RegExp _combiningMarks = RegExp(r'[̀-ͯ]');

/// Folds Latin accents in [s] to their base letters and drops any residual
/// combining marks. Does not change case (callers lowercase as needed).
String deburr(String s) {
  final sb = StringBuffer();
  for (final ch in s.split('')) {
    sb.write(_foldMap[ch] ?? ch);
  }
  return sb.toString().replaceAll(_combiningMarks, '');
}

final RegExp _nonAlnum = RegExp(r'[^a-z0-9]+');

/// Loose match key: accent-folded, lowercased, non-alphanumerics collapsed to
/// single spaces, trimmed — the web's `norm`/`normTitle` for fuzzy title/name
/// matching.
String normLoose(String s) =>
    deburr(s.toLowerCase()).replaceAll(_nonAlnum, ' ').trim();
