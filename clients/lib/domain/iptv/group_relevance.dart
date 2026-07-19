import 'm3u.dart';

// Region → alias tokens for relevance scoring. Ported from
// `iptv/group-relevance.ts`.
const Map<String, List<String>> _regionToTokens = {
  'US': ['US', 'USA', 'UNITED STATES', 'AMERICA', 'AMERICAN'],
  'CA': ['CA', 'CAN', 'CANADA', 'CANADIAN'],
  'GB': ['UK', 'GB', 'BRITAIN', 'BRITISH', 'ENGLAND', 'ENGLISH'],
  'AU': ['AU', 'AUS', 'AUSTRALIA', 'AUSTRALIAN'],
  'NZ': ['NZ', 'NEW ZEALAND'],
  'IE': ['IE', 'IRELAND', 'IRISH'],
  'IN': ['IN', 'INDIA', 'INDIAN'],
  'FR': ['FR', 'FRANCE', 'FRENCH'],
  'DE': ['DE', 'GERMANY', 'DEUTSCH', 'GERMAN'],
  'IT': ['IT', 'ITALY', 'ITALIAN'],
  'ES': ['ES', 'SPAIN', 'SPANISH'],
  'PT': ['PT', 'PORTUGAL', 'PORTUGUESE'],
  'BR': ['BR', 'BRAZIL', 'BRASIL'],
  'MX': ['MX', 'MEXICO', 'MEXICAN'],
  'NL': ['NL', 'NETHERLANDS', 'DUTCH'],
  'SE': ['SE', 'SWEDEN', 'SWEDISH'],
  'NO': ['NO', 'NORWAY', 'NORWEGIAN'],
  'DK': ['DK', 'DENMARK', 'DANISH'],
  'FI': ['FI', 'FINLAND', 'FINNISH'],
  'PL': ['PL', 'POLAND', 'POLISH'],
  'RU': ['RU', 'RUSSIA', 'RUSSIAN'],
  'TR': ['TR', 'TURKEY', 'TURKISH'],
  'JP': ['JP', 'JAPAN', 'JAPANESE'],
  'KR': ['KR', 'KOREA', 'KOREAN'],
  'CN': ['CN', 'CHINA', 'CHINESE'],
};

// Preferred-language → alias tokens.
const Map<String, List<String>> _langToTokens = {
  'english': ['EN', 'ENG', 'ENGLISH', 'US', 'UK', 'CA', 'AU'],
  'spanish': ['ES', 'ESP', 'SPANISH', 'ESPANOL', 'LATINO'],
  'french': ['FR', 'FRA', 'FRENCH', 'FRANCAIS'],
  'german': ['DE', 'GER', 'GERMAN', 'DEUTSCH'],
  'italian': ['IT', 'ITA', 'ITALIAN', 'ITALIANO'],
  'portuguese': ['PT', 'POR', 'PORTUGUESE', 'BR', 'BRAZIL'],
  'dutch': ['NL', 'DUTCH', 'NEDERLANDS'],
  'russian': ['RU', 'RUS', 'RUSSIAN'],
  'arabic': ['AR', 'ARA', 'ARABIC', 'ARAB'],
  'turkish': ['TR', 'TUR', 'TURKISH'],
  'hindi': ['HI', 'HIN', 'HINDI', 'INDIAN'],
  'japanese': ['JA', 'JPN', 'JAPANESE'],
  'korean': ['KO', 'KOR', 'KOREAN'],
  'chinese': ['ZH', 'CHI', 'CHINESE', 'MANDARIN'],
  'polish': ['PL', 'POL', 'POLISH'],
  'swedish': ['SV', 'SWE', 'SWEDISH'],
  'norwegian': ['NO', 'NOR', 'NORWEGIAN'],
  'danish': ['DA', 'DAN', 'DANISH'],
  'finnish': ['FI', 'FIN', 'FINNISH'],
};

const Set<String> _neutralPriorityBump = {
  'ENTERTAINMENT',
  'NEWS',
  'SPORTS',
  'MOVIES',
  'KIDS',
  'DOCUMENTARY',
};

final RegExp _tokenSep = RegExp(r'[\s|/_\-:]+');
final RegExp _nonAlpha = RegExp(r'[^A-Z]');

List<String> _tokenize(String group) => group
    .toUpperCase()
    .split(_tokenSep)
    .map((t) => t.replaceAll(_nonAlpha, ''))
    .where((t) => t.isNotEmpty)
    .toList();

/// Scores a group's relevance to the user's region + preferred languages
/// (region head 100 / any 80; language head 60 / any 45, minus 5 per rank;
/// neutral category 5). Ports `scoreGroupForUser`.
int scoreGroupForUser(
  String group,
  String region,
  List<String> preferredLanguages,
) {
  final tokens = _tokenize(group);
  if (tokens.isEmpty) return 0;
  final head = tokens[0];
  final regionTokens = _regionToTokens[region.toUpperCase()] ?? const [];
  if (regionTokens.contains(head)) return 100;
  if (regionTokens.any(tokens.contains)) return 80;
  for (var i = 0; i < preferredLanguages.length; i++) {
    final lang = preferredLanguages[i].toLowerCase();
    final langTokens = _langToTokens[lang];
    if (langTokens == null) continue;
    if (langTokens.contains(head)) return 60 - i * 5;
    if (langTokens.any(tokens.contains)) return 45 - i * 5;
  }
  if (_neutralPriorityBump.contains(head)) return 5;
  return 0;
}

/// Sorts group titles by relevance (score desc, then name). Ports
/// `sortGroupsByRelevance`.
List<String> sortGroupsByRelevance(
  List<String> groups,
  String region,
  List<String> preferredLanguages,
) {
  final out = [...groups];
  out.sort((a, b) {
    final sa = scoreGroupForUser(a, region, preferredLanguages);
    final sb = scoreGroupForUser(b, region, preferredLanguages);
    if (sa != sb) return sb.compareTo(sa);
    return a.compareTo(b);
  });
  return out;
}

/// Sorts channels so the most relevant groups lead, keeping same-group channels
/// in their original order (a stable sort, matching the web's `Array.sort`).
/// Ports `sortChannelsByGroupRelevance`.
List<IptvChannel> sortChannelsByGroupRelevance(
  List<IptvChannel> channels,
  String region,
  List<String> preferredLanguages,
) {
  final scoreCache = <String, int>{};
  int scoreOf(String? group) {
    if (group == null || group.isEmpty) return -1;
    return scoreCache.putIfAbsent(
      group,
      () => scoreGroupForUser(group, region, preferredLanguages),
    );
  }

  final indexed = [for (var i = 0; i < channels.length; i++) (channels[i], i)];
  indexed.sort((a, b) {
    final sa = scoreOf(a.$1.group);
    final sb = scoreOf(b.$1.group);
    if (sa != sb) return sb.compareTo(sa);
    final ga = a.$1.group ?? '';
    final gb = b.$1.group ?? '';
    final byGroup = ga.compareTo(gb);
    if (byGroup != 0) return byGroup;
    return a.$2.compareTo(b.$2); // stable: preserve input order within a group
  });
  return [for (final e in indexed) e.$1];
}
