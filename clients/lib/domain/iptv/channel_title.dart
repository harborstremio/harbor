// Extracts a metadata search query from an IPTV channel name (for logo/poster
// hydration). Ported 1:1 from `iptv/channel-title.ts`.

const List<String> _countryPrefixes = [
  'US',
  'USA',
  'UK',
  'GB',
  'CA',
  'AU',
  'NZ',
  'IE',
  'FR',
  'DE',
  'IT',
  'ES',
  'PT',
  'BR',
  'MX',
  'NL',
  'SE',
  'NO',
  'DK',
  'FI',
  'PL',
  'RU',
  'TR',
  'JP',
  'KR',
  'CN',
  'IN',
  'AR',
  'EN',
  'AM',
  'EU',
  'LATAM',
  'LATINO',
];

const List<String> _qualityTokens = [
  'HD',
  'FHD',
  'UHD',
  '4K',
  'SD',
  'HEVC',
  '265',
  '264',
  '1080',
  '720',
];

const Set<String> _noiseWords = {
  'TV',
  'NETWORK',
  'CHANNEL',
  'STREAM',
  'LIVE',
  'PPV',
  'VIP',
  'BACKUP',
  'PRIMARY',
  'MAIN',
  'ALT',
  'GOLD',
  'PLUS',
  'PREMIUM',
  'FREE',
};

const List<String> _skipHydrationTokens = [
  'NEWS',
  'SPORT',
  'SPORTS',
  'WEATHER',
  'RADIO',
  'MUSIC',
  'EVENT',
  'EVENTS',
  'MATCH',
  'GAME',
  'LIVE',
];

final RegExp _seasonEpRe = RegExp(
  r'\bS\d{1,3}E\d{1,3}\b',
  caseSensitive: false,
);
final RegExp _seasonRe = RegExp(r'\bS\d{1,3}\b', caseSensitive: false);
final RegExp _resRe = RegExp(r'\b(\d{2,4}p)\b', caseSensitive: false);
final RegExp _twentyFourSevenRe = RegExp(r'\b24/7\b', caseSensitive: false);
final RegExp _symbolsRe = RegExp(r'[#*_~`<>]+');
final RegExp _wsRe = RegExp(r'\s+');
final List<RegExp> _qualityRes = [
  for (final q in _qualityTokens) RegExp('\\b$q\\b', caseSensitive: false),
];
final List<RegExp> _prefixRes = [
  for (final p in _countryPrefixes)
    RegExp('^$p\\s*[:\\-|]\\s*', caseSensitive: false),
];

/// A channel name reduced to a searchable title. Ports `ExtractedTitle`.
class ExtractedTitle {
  const ExtractedTitle({required this.raw, this.query, this.preferType});
  final String raw;

  /// The cleaned search query, or null when the name shouldn't be hydrated
  /// (too short, or a live-only news/sports/etc channel).
  final String? query;

  /// `'series'` when an SxxEyy marker was present, else null.
  final String? preferType;
}

/// Strips country prefixes, quality/resolution tokens, season markers, symbols,
/// and noise words from a channel name to derive a hydration query. Ports
/// `extractTitleFromChannelName`.
ExtractedTitle extractTitleFromChannelName(String name) {
  final raw = name.trim();
  var working = raw;

  final lastPipe = working.lastIndexOf('|');
  if (lastPipe > 0 && lastPipe < working.length - 1) {
    working = working.substring(lastPipe + 1).trim();
  }
  final lastDash = working.lastIndexOf(' - ');
  if (lastDash > 0 && lastDash < working.length - 3) {
    final after = working.substring(lastDash + 3).trim();
    if (after.length >= 3) working = after;
  }

  final isEpisodic = _seasonEpRe.hasMatch(working);
  working = working.replaceFirst(_seasonEpRe, '').trim();
  working = working.replaceFirst(_seasonRe, '').trim();
  working = working.replaceAll(_resRe, '').trim();
  working = working.replaceAll(_twentyFourSevenRe, '').trim();
  for (final re in _qualityRes) {
    working = working.replaceAll(re, '').trim();
  }
  for (final re in _prefixRes) {
    working = working.replaceFirst(re, '').trim();
  }
  working = working.replaceAll(_symbolsRe, ' ').trim();
  working = working.replaceAll(_wsRe, ' ').trim();

  final lowerWords = working.toLowerCase().split(_wsRe);
  final meaningful = [
    for (final w in lowerWords)
      if (!_noiseWords.contains(w.toUpperCase())) w,
  ];
  final cleaned = meaningful.join(' ').trim();
  if (cleaned.isEmpty || cleaned.length < 3) {
    return ExtractedTitle(raw: raw);
  }

  final upper = raw.toUpperCase();
  for (final skip in _skipHydrationTokens) {
    if (upper.contains(skip)) return ExtractedTitle(raw: raw);
  }

  return ExtractedTitle(
    raw: raw,
    query: cleaned,
    preferType: isEpisodic ? 'series' : null,
  );
}
