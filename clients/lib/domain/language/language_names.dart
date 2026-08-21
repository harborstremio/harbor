/// Language code/name normalization, transcribed from Harbor's
/// `src/lib/subtitles/language.ts`. Used to canonicalize stored preferred
/// sub/audio languages on settings load, and later by subtitle selection.
library;

const Map<String, String> _iso3to1 = {
  'eng': 'en',
  'fre': 'fr',
  'fra': 'fr',
  'ger': 'de',
  'deu': 'de',
  'spa': 'es',
  'ita': 'it',
  'jpn': 'ja',
  'kor': 'ko',
  'rus': 'ru',
  'por': 'pt',
  'chi': 'zh',
  'zho': 'zh',
  'ara': 'ar',
  'hin': 'hi',
  'tha': 'th',
  'vie': 'vi',
  'tur': 'tr',
  'pol': 'pl',
  'dut': 'nl',
  'nld': 'nl',
  'swe': 'sv',
  'nor': 'no',
  'dan': 'da',
  'fin': 'fi',
  'heb': 'he',
  'ind': 'id',
  'ces': 'cs',
  'cze': 'cs',
  'ell': 'el',
  'gre': 'el',
  'hun': 'hu',
  'rum': 'ro',
  'ron': 'ro',
  'ukr': 'uk',
  'tam': 'ta',
  'tel': 'te',
  'mal': 'ml',
  'kan': 'kn',
  'ben': 'bn',
  'mar': 'mr',
  'guj': 'gu',
  'pan': 'pa',
  'urd': 'ur',
  'ori': 'or',
  'ory': 'or',
  'asm': 'as',
  'nep': 'ne',
  'sin': 'si',
  'msa': 'ms',
  'may': 'ms',
  'fil': 'tl',
  'tgl': 'tl',
  'mya': 'my',
  'bur': 'my',
  'khm': 'km',
  'lao': 'lo',
  'fas': 'fa',
  'per': 'fa',
  'pus': 'ps',
  'kur': 'ku',
  'aze': 'az',
  'kat': 'ka',
  'geo': 'ka',
  'hye': 'hy',
  'arm': 'hy',
  'kaz': 'kk',
  'uzb': 'uz',
  'bul': 'bg',
  'srp': 'sr',
  'hrv': 'hr',
  'bos': 'bs',
  'slk': 'sk',
  'slo': 'sk',
  'slv': 'sl',
  'lit': 'lt',
  'lav': 'lv',
  'est': 'et',
  'isl': 'is',
  'ice': 'is',
  'gle': 'ga',
  'cat': 'ca',
  'eus': 'eu',
  'baq': 'eu',
  'glg': 'gl',
  'cym': 'cy',
  'wel': 'cy',
  'mlt': 'mt',
  'sqi': 'sq',
  'alb': 'sq',
  'mkd': 'mk',
  'mac': 'mk',
  'bel': 'be',
  'swa': 'sw',
  'amh': 'am',
  'afr': 'af',
  'hau': 'ha',
  'yor': 'yo',
  'ibo': 'ig',
  'zul': 'zu',
};

const Map<String, String> _names = {
  'en': 'English',
  'es': 'Spanish',
  'es-419': 'Spanish (Latin America)',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ru': 'Russian',
  'pt': 'Portuguese',
  'pt-br': 'Portuguese (Brazil)',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'tr': 'Turkish',
  'pl': 'Polish',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'fi': 'Finnish',
  'he': 'Hebrew',
  'id': 'Indonesian',
  'cs': 'Czech',
  'el': 'Greek',
  'hu': 'Hungarian',
  'ro': 'Romanian',
  'uk': 'Ukrainian',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ml': 'Malayalam',
  'kn': 'Kannada',
  'bn': 'Bengali',
  'mr': 'Marathi',
  'gu': 'Gujarati',
  'pa': 'Punjabi',
  'ur': 'Urdu',
  'or': 'Odia',
  'as': 'Assamese',
  'ne': 'Nepali',
  'si': 'Sinhala',
  'ms': 'Malay',
  'tl': 'Filipino',
  'my': 'Burmese',
  'km': 'Khmer',
  'lo': 'Lao',
  'fa': 'Persian',
  'ps': 'Pashto',
  'ku': 'Kurdish',
  'az': 'Azerbaijani',
  'ka': 'Georgian',
  'hy': 'Armenian',
  'kk': 'Kazakh',
  'uz': 'Uzbek',
  'bg': 'Bulgarian',
  'sr': 'Serbian',
  'hr': 'Croatian',
  'bs': 'Bosnian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'lt': 'Lithuanian',
  'lv': 'Latvian',
  'et': 'Estonian',
  'is': 'Icelandic',
  'ga': 'Irish',
  'ca': 'Catalan',
  'eu': 'Basque',
  'gl': 'Galician',
  'cy': 'Welsh',
  'mt': 'Maltese',
  'sq': 'Albanian',
  'mk': 'Macedonian',
  'be': 'Belarusian',
  'sw': 'Swahili',
  'am': 'Amharic',
  'af': 'Afrikaans',
  'ha': 'Hausa',
  'yo': 'Yoruba',
  'ig': 'Igbo',
  'zu': 'Zulu',
};

final List<String> allLanguageNames = _names.values.toList();

const Set<String> _latamAliases = {
  'es-419',
  'es-la',
  'lat',
  'latam',
  'latino',
  'latin american spanish',
  'spanish (latin america)',
  'spanish latin america',
  'español latino',
  'espanol latino',
  'español latinoamericano',
};

const Set<String> _latamRegions = {
  'mx',
  'ar',
  'co',
  'cl',
  'pe',
  've',
  'ec',
  'gt',
  'cu',
  'bo',
  'do',
  'hn',
  'py',
  'sv',
  'ni',
  'cr',
  'pa',
  'uy',
  'pr',
  '419',
};

const Set<String> _brazilAliases = {
  'pt-br',
  'pt_br',
  'pob',
  'por-br',
  'brazilian',
  'brazilian portuguese',
  'portuguese (brazil)',
  'portuguese brazil',
  'português (brasil)',
  'portugues (brasil)',
  'português brasil',
  'portugues brasil',
};

final Map<String, String> _nameToCode = () {
  final m = <String, String>{};
  _names.forEach((code, name) => m[name.toLowerCase()] = code);
  m['jp'] = 'ja';
  m['mandarin'] = 'zh';
  m['cantonese'] = 'zh';
  return m;
}();

String normalizeLang(String? input) {
  if (input == null || input.isEmpty) return '';
  final raw = input.trim().toLowerCase();
  if (_latamAliases.contains(raw)) return 'es-419';
  if (_brazilAliases.contains(raw)) return 'pt-br';
  if (raw.length == 2) return raw;
  if (raw.length == 3 && _iso3to1.containsKey(raw)) return _iso3to1[raw]!;
  if (_nameToCode.containsKey(raw)) return _nameToCode[raw]!;
  if (raw.contains('-') || raw.contains('_')) {
    final parts = raw.split(RegExp('[-_]'));
    final head = parts[0];
    final region = parts.length > 1 ? parts[1] : '';
    final headCode = head.length == 2
        ? head
        : (_iso3to1[head] ?? _nameToCode[head]);
    if (headCode == 'es' &&
        region.isNotEmpty &&
        _latamRegions.contains(region)) {
      return 'es-419';
    }
    if (headCode == 'pt' && region == 'br') return 'pt-br';
    if (headCode != null) return headCode;
  }
  return raw;
}

String languageName(String code) {
  final n = normalizeLang(code);
  return _names[n] ?? code.toUpperCase();
}

/// Scores [lang] against the ordered [preferred] list, ported from
/// `langScore` in `src/lib/subtitles/language.ts`. Exact match beats base-code
/// match; earlier preferences score higher; no match scores -1.
int langScore(String lang, List<String> preferred) {
  if (preferred.isEmpty) return 0;
  final n = normalizeLang(lang);
  String baseOf(String c) => c.split('-')[0];
  var exactIdx = -1;
  var baseIdx = -1;
  for (var i = 0; i < preferred.length; i++) {
    final pn = normalizeLang(preferred[i]);
    if (exactIdx == -1 && pn == n) exactIdx = i;
    if (baseIdx == -1 && baseOf(pn) == baseOf(n)) baseIdx = i;
  }
  if (exactIdx != -1) return (preferred.length - exactIdx) * 2;
  if (baseIdx != -1) return (preferred.length - baseIdx) * 2 - 1;
  return -1;
}
