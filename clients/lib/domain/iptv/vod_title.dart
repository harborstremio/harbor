// Title parsing for VOD/series channel names. Ported 1:1 from
// `iptv/vod-title.ts`.

final RegExp _yearRe = RegExp(r'\b(19\d{2}|20\d{2})\b');
final RegExp _seRe = RegExp(
  r'\bS(\d{1,2})\s*[._\-\s]?\s*E(\d{1,3})\b',
  caseSensitive: false,
);
final RegExp _xRe = RegExp(r'\b(\d{1,2})x(\d{1,3})\b');
final RegExp _noiseRe = RegExp(
  r'\b(2160p|1080p|720p|480p|4k|uhd|fhd|hd|sd|hevc|x265|x264|h\.?264|h\.?265|'
  r'web-?dl|web-?rip|bluray|blu-?ray|bdrip|hdrip|dvdrip|hdtv|multi|dual|'
  r'multi-?sub|subbed|dubbed|imax|remux|10bit|aac|ac3|eac3|dts|ddp?5\.?1|'
  r'hdr10?|dolby|atmos|vision)\b',
  caseSensitive: false,
);
final RegExp _bracketRe = RegExp(r'[\[(][^\])]*[\])]');
final RegExp _prefixRe = RegExp(
  r'^\s*(?:[A-Z]{2,4}|[\u{1F1E6}-\u{1F1FF}]{2})\s*[|\-:]\s*',
  unicode: true,
);
final RegExp _epWordRe = RegExp(
  r'\s*[-|:]?\s*\b(?:episode|ep|part|pt)\b\s*\.?\s*\d{1,3}\s*$',
  caseSensitive: false,
);
final RegExp _lastDelimRe = RegExp(r'^(.*\S)\s+[-|:]\s+\S.*$');
final RegExp _dotsRe = RegExp(r'[._]+');
final RegExp _wsRe = RegExp(r'\s{2,}');
final RegExp _trailDelimRe = RegExp(r'[\-|:]+\s*$');

/// Parses a season/episode marker (`SxxEyy` or `NxMM`) from a name, or null.
/// Ports `parseSeriesEpisode`.
({int season, int episode})? parseSeriesEpisode(String name) {
  final m = _seRe.firstMatch(name) ?? _xRe.firstMatch(name);
  if (m == null) return null;
  final season = int.tryParse(m.group(1)!);
  final episode = int.tryParse(m.group(2)!);
  if (season == null || episode == null) return null;
  return (season: season, episode: episode);
}

/// Extracts a 1900–2099 year from a name, or null. Ports `extractYear`.
int? extractYear(String name) {
  final m = _yearRe.firstMatch(name);
  if (m == null) return null;
  final year = int.parse(m.group(1)!);
  return year >= 1900 && year <= 2099 ? year : null;
}

/// Strips release-noise, brackets, SxxEyy, years, and country prefixes to a
/// clean display title (falling back to the trimmed input). Ports `cleanTitle`.
String cleanTitle(String name) {
  var s = name;
  s = s.replaceAll(_prefixRe, '');
  s = s.replaceAll(_bracketRe, ' ');
  s = s.replaceFirst(_seRe, ' ').replaceFirst(_xRe, ' ');
  s = s.replaceFirst(_yearRe, ' ');
  s = s.replaceAll(_noiseRe, ' ');
  s = s.replaceAll(_dotsRe, ' ');
  s = s.replaceAll(_wsRe, ' ').trim();
  s = s.replaceFirst(_trailDelimRe, '').trim();
  return s.isEmpty ? name.trim() : s;
}

/// Derives the show title from an episode name (cutting at the SxxEyy marker,
/// an "Episode N" suffix, or the last delimiter). Ports `showTitleFromEpisode`.
String showTitleFromEpisode(String name) {
  final seIdx = _seRe.firstMatch(name)?.start ?? -1;
  final xIdx = _xRe.firstMatch(name)?.start ?? -1;
  var cut = -1;
  if (seIdx >= 0) {
    cut = seIdx;
  } else if (xIdx >= 0) {
    cut = xIdx;
  }
  if (cut >= 0) return cleanTitle(name.substring(0, cut));
  final stripped = name.replaceFirst(_epWordRe, '').trim();
  if (stripped.isNotEmpty && stripped != name.trim()) {
    return cleanTitle(stripped);
  }
  final m = _lastDelimRe.firstMatch(name);
  if (m != null && m.group(1)!.trim().isNotEmpty) {
    return cleanTitle(m.group(1)!);
  }
  return cleanTitle(name);
}
