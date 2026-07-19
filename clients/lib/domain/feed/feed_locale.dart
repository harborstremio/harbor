import '../settings/settings.dart';

/// Language display names to ISO codes, ported 1:1 from `LANGUAGE_NAME_TO_CODE`.
const Map<String, String> _langNameToCode = {
  'english': 'en',
  'spanish': 'es',
  'french': 'fr',
  'german': 'de',
  'italian': 'it',
  'portuguese': 'pt',
  'japanese': 'ja',
  'korean': 'ko',
  'chinese': 'zh',
  'mandarin': 'zh',
  'cantonese': 'zh',
  'hindi': 'hi',
  'tamil': 'ta',
  'telugu': 'te',
  'arabic': 'ar',
  'russian': 'ru',
  'swedish': 'sv',
  'danish': 'da',
  'norwegian': 'no',
  'dutch': 'nl',
  'polish': 'pl',
  'turkish': 'tr',
  'thai': 'th',
  'indonesian': 'id',
  'vietnamese': 'vi',
  'hebrew': 'he',
  'greek': 'el',
  'finnish': 'fi',
  'czech': 'cs',
  'hungarian': 'hu',
  'romanian': 'ro',
  'ukrainian': 'uk',
  'filipino': 'tl',
  'tagalog': 'tl',
  'malay': 'ms',
};

/// Region codes to their primary language, ported 1:1 from `REGION_TO_CODE`.
const Map<String, String> _regionToCode = {
  'US': 'en',
  'GB': 'en',
  'CA': 'en',
  'AU': 'en',
  'NZ': 'en',
  'IE': 'en',
  'ES': 'es',
  'MX': 'es',
  'AR': 'es',
  'CO': 'es',
  'CL': 'es',
  'PE': 'es',
  'FR': 'fr',
  'BE': 'fr',
  'DE': 'de',
  'AT': 'de',
  'IT': 'it',
  'BR': 'pt',
  'PT': 'pt',
  'JP': 'ja',
  'KR': 'ko',
  'CN': 'zh',
  'TW': 'zh',
  'HK': 'zh',
  'IN': 'hi',
  'RU': 'ru',
  'SE': 'sv',
  'DK': 'da',
  'NO': 'no',
  'NL': 'nl',
  'PL': 'pl',
  'TR': 'tr',
};

final RegExp _twoLetter = RegExp(r'^[a-z]{2}$');

String? _toCode(String value) {
  final v = value.trim().toLowerCase();
  if (v.isEmpty) return null;
  if (_twoLetter.hasMatch(v)) return v;
  return _langNameToCode[v];
}

/// The user's preferred language codes — from their language list, TMDB UI
/// language, and (as a fallback) their region. Ported 1:1 from
/// `preferredLangCodes`.
List<String> preferredLangCodes(Settings settings) {
  final out = <String>{};
  for (final name in settings.getStringList('preferredLanguages')) {
    final code = _toCode(name);
    if (code != null) out.add(code);
  }
  final tmdbLang = settings.getString('tmdbLanguage').split('-').first;
  if (tmdbLang.isNotEmpty) {
    final code = _toCode(tmdbLang);
    if (code != null) out.add(code);
  }
  if (out.isEmpty) {
    final fromRegion = _regionToCode[settings.region.toUpperCase()];
    if (fromRegion != null) out.add(fromRegion);
  }
  return out.toList();
}

bool _alreadyLocalized(Map<String, String> floor) =>
    floor.containsKey('with_original_language') ||
    floor.containsKey('with_origin_country');

/// Adds the user's region to a discover floor so results skew local, but only
/// for movies when the locale bias is on and nothing localizing is already set.
/// Ported 1:1 from `localizeFloor`.
Map<String, String> localizeFloor(
  Map<String, String> floor,
  Settings settings,
  String mediaType,
) {
  if (!settings.getBool('feedLocaleBias')) return floor;
  if (_alreadyLocalized(floor)) return floor;
  final codes = preferredLangCodes(settings);
  if (codes.isEmpty) return floor;
  if (mediaType != 'movie' || settings.region.isEmpty) return floor;
  return {...floor, 'region': settings.region};
}

/// The preferred-language set and the ranking penalty for off-locale titles,
/// ported 1:1 from `localeWeights`.
class LocaleWeights {
  const LocaleWeights({required this.codes, required this.penalty});

  final Set<String> codes;
  final double penalty;
}

/// Ported 1:1 from `localeWeights`: a penalty of 3 against off-locale titles
/// when the locale bias is on and preferred languages resolve, else none.
LocaleWeights localeWeights(Settings settings) {
  if (!settings.getBool('feedLocaleBias')) {
    return const LocaleWeights(codes: <String>{}, penalty: 0);
  }
  final codes = preferredLangCodes(settings);
  if (codes.isEmpty) {
    return const LocaleWeights(codes: <String>{}, penalty: 0);
  }
  return LocaleWeights(codes: codes.toSet(), penalty: 3);
}
