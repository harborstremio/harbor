/// Language detection from a release name, ported from
/// `src/lib/streams/parser/parser-language.ts`: word tokens, regional-indicator
/// flag emoji, and delimited ISO-639-1 pairs, collapsed to a `Multi` marker when
/// more than one concrete language is present.
library;

const Map<String, String> _langTokens = {
  'ENG': 'English',
  'ENGLISH': 'English',
  'ITA': 'Italian',
  'ITALIAN': 'Italian',
  'RUS': 'Russian',
  'RUSSIAN': 'Russian',
  'HIN': 'Hindi',
  'HINDI': 'Hindi',
  'ESP': 'Spanish',
  'SPA': 'Spanish',
  'SPANISH': 'Spanish',
  'LAT': 'Spanish (Latin America)',
  'LATINO': 'Spanish (Latin America)',
  'LATAM': 'Spanish (Latin America)',
  'CASTELLANO': 'Spanish',
  'KOR': 'Korean',
  'KOREAN': 'Korean',
  'JPN': 'Japanese',
  'JAPANESE': 'Japanese',
  'JAP': 'Japanese',
  'CHN': 'Chinese',
  'CHI': 'Chinese',
  'CHINESE': 'Chinese',
  'ZHO': 'Chinese',
  'MAN': 'Chinese',
  'MANDARIN': 'Chinese',
  'CANTONESE': 'Chinese',
  'POR': 'Portuguese',
  'PORTUGUESE': 'Portuguese',
  'PTBR': 'Portuguese',
  'DUBLADO': 'Portuguese',
  'GER': 'German',
  'GERMAN': 'German',
  'DEU': 'German',
  'FRA': 'French',
  'FRENCH': 'French',
  'FRE': 'French',
  'VFF': 'French',
  'VFQ': 'French',
  'VOSTFR': 'French',
  'TUR': 'Turkish',
  'TURKISH': 'Turkish',
  'ARA': 'Arabic',
  'ARABIC': 'Arabic',
  'TAM': 'Tamil',
  'TAMIL': 'Tamil',
  'TEL': 'Telugu',
  'TELUGU': 'Telugu',
  'CES': 'Czech',
  'CZECH': 'Czech',
  'CZE': 'Czech',
  'DAN': 'Danish',
  'DANISH': 'Danish',
  'FIN': 'Finnish',
  'FINNISH': 'Finnish',
  'HEB': 'Hebrew',
  'HEBREW': 'Hebrew',
  'HUN': 'Hungarian',
  'HUNGARIAN': 'Hungarian',
  'NLD': 'Dutch',
  'DUTCH': 'Dutch',
  'DUT': 'Dutch',
  'NOR': 'Norwegian',
  'NORWEGIAN': 'Norwegian',
  'POL': 'Polish',
  'POLISH': 'Polish',
  'RON': 'Romanian',
  'ROMANIAN': 'Romanian',
  'ROM': 'Romanian',
  'SWE': 'Swedish',
  'SWEDISH': 'Swedish',
  'THA': 'Thai',
  'THAI': 'Thai',
  'UKR': 'Ukrainian',
  'UKRAINIAN': 'Ukrainian',
  'VIE': 'Vietnamese',
  'VIETNAMESE': 'Vietnamese',
};

final RegExp _langRx = RegExp(
  r'\b(ENG(?:LISH)?|ITA(?:LIAN)?|RUS(?:SIAN)?|HIN(?:DI)?|ESP|SPA(?:NISH)?'
  r'|LAT(?:INO|AM)?|CASTELLANO|KOR(?:EAN)?|JPN|JAPANESE|JAP|CHN|CHI(?:NESE)?'
  r'|ZHO|MAN(?:DARIN)?|CANTONESE|POR(?:TUGUESE)?|PTBR|DUBLADO|GER(?:MAN)?|DEU'
  r'|FRA|FRENCH|FRE|VFF|VFQ|VOSTFR|TUR(?:KISH)?|ARA(?:BIC)?|TAM(?:IL)?'
  r'|TEL(?:UGU)?|CES|CZECH|CZE|DAN(?:ISH)?|FIN(?:NISH)?|HEB(?:REW)?'
  r'|HUN(?:GARIAN)?|NLD|DUTCH|DUT|NOR(?:WEGIAN)?|POL(?:ISH)?|RON|ROM|ROMANIAN'
  r'|SWE(?:DISH)?|THA|THAI|UKR(?:AINIAN)?|VIE(?:TNAMESE)?|MULTI|DUAL)\b',
  caseSensitive: false,
);

const Map<String, String> _flagToLanguage = {
  'US': 'English',
  'GB': 'English',
  'CA': 'English',
  'AU': 'English',
  'NZ': 'English',
  'IE': 'English',
  'ES': 'Spanish',
  'MX': 'Spanish',
  'AR': 'Spanish',
  'CO': 'Spanish',
  'PE': 'Spanish',
  'CL': 'Spanish',
  'IT': 'Italian',
  'DE': 'German',
  'AT': 'German',
  'CH': 'German',
  'FR': 'French',
  'BE': 'French',
  'LU': 'French',
  'JP': 'Japanese',
  'KR': 'Korean',
  'KP': 'Korean',
  'CN': 'Chinese',
  'HK': 'Chinese',
  'TW': 'Chinese',
  'SG': 'Chinese',
  'PT': 'Portuguese',
  'BR': 'Portuguese',
  'RU': 'Russian',
  'BY': 'Russian',
  'IN': 'Hindi',
  'PK': 'Hindi',
  'SA': 'Arabic',
  'AE': 'Arabic',
  'EG': 'Arabic',
  'IQ': 'Arabic',
  'JO': 'Arabic',
  'KW': 'Arabic',
  'LB': 'Arabic',
  'MA': 'Arabic',
  'QA': 'Arabic',
  'SY': 'Arabic',
  'TN': 'Arabic',
  'IL': 'Hebrew',
  'TR': 'Turkish',
  'NL': 'Dutch',
  'NO': 'Norwegian',
  'PL': 'Polish',
  'RO': 'Romanian',
  'MD': 'Romanian',
  'SE': 'Swedish',
  'DK': 'Danish',
  'FI': 'Finnish',
  'CZ': 'Czech',
  'HU': 'Hungarian',
  'TH': 'Thai',
  'UA': 'Ukrainian',
  'VN': 'Vietnamese',
  'GR': 'Greek',
  'ID': 'Indonesian',
  'MY': 'Malay',
  'PH': 'Tagalog',
  'IR': 'Persian',
};

final RegExp _isoPairRx = RegExp(
  r'(?<=^|[.\-_\s\[(])(EN|FR|ES|IT|DE|PT|RU|JA|JP|KO|KR|ZH|CN|HI|AR|TR|NL|PL'
  r'|RO|SV|SE|DA|FI|CS|CZ|HU|TH|UK|UA|VI|GB|US|MX|BR|CA|AU|NZ|TW|HK|IL|HE|SA'
  r'|AE|EG|GR|ID|MY|PH|IR|FA)(?=[.\-_\s\])]|$)',
);
const Map<String, String> _isoPairToLanguage = {
  'EN': 'English',
  'GB': 'English',
  'US': 'English',
  'CA': 'English',
  'AU': 'English',
  'NZ': 'English',
  'ES': 'Spanish',
  'MX': 'Spanish',
  'IT': 'Italian',
  'DE': 'German',
  'FR': 'French',
  'PT': 'Portuguese',
  'BR': 'Portuguese',
  'RU': 'Russian',
  'JA': 'Japanese',
  'JP': 'Japanese',
  'KO': 'Korean',
  'KR': 'Korean',
  'ZH': 'Chinese',
  'CN': 'Chinese',
  'TW': 'Chinese',
  'HK': 'Chinese',
  'HI': 'Hindi',
  'AR': 'Arabic',
  'SA': 'Arabic',
  'AE': 'Arabic',
  'EG': 'Arabic',
  'TR': 'Turkish',
  'NL': 'Dutch',
  'PL': 'Polish',
  'RO': 'Romanian',
  'SV': 'Swedish',
  'SE': 'Swedish',
  'DA': 'Danish',
  'FI': 'Finnish',
  'CS': 'Czech',
  'CZ': 'Czech',
  'HU': 'Hungarian',
  'TH': 'Thai',
  'UK': 'Ukrainian',
  'UA': 'Ukrainian',
  'VI': 'Vietnamese',
  'IL': 'Hebrew',
  'HE': 'Hebrew',
  'GR': 'Greek',
  'ID': 'Indonesian',
  'MY': 'Malay',
  'PH': 'Tagalog',
  'IR': 'Persian',
  'FA': 'Persian',
};

const int _riBase = 0x1F1E6; // regional indicator 'A'

/// Detects the languages present in [text].
List<String> parseLanguages(String text) {
  final out = <String>{};

  for (final m in _langRx.allMatches(text)) {
    final upper = m.group(1)!.toUpperCase();
    final mapped = _langTokens[upper];
    if (mapped != null) {
      out.add(mapped);
    } else if (upper == 'MULTI' || upper == 'DUAL') {
      out.add('Multi');
    }
  }

  // Regional-indicator flag pairs → country code → language.
  final runes = text.runes.toList();
  for (var i = 0; i + 1 < runes.length; i++) {
    final a = runes[i];
    final b = runes[i + 1];
    if (a >= _riBase && a <= 0x1F1FF && b >= _riBase && b <= 0x1F1FF) {
      final code =
          String.fromCharCode(a - _riBase + 65) +
          String.fromCharCode(b - _riBase + 65);
      final lang = _flagToLanguage[code];
      if (lang != null) out.add(lang);
    }
  }

  for (final m in _isoPairRx.allMatches(text)) {
    final lang = _isoPairToLanguage[m.group(1)!.toUpperCase()];
    if (lang != null) out.add(lang);
  }

  final concrete = out.where((l) => l != 'Multi').toList();
  if (concrete.length > 1) return ['Multi', ...concrete];
  if (concrete.length == 1) return concrete;
  return out.contains('Multi') ? ['Multi'] : [];
}
