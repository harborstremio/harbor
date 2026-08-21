/// Picks the single most "filename-like" line out of a stream's assorted text
/// fields, so parsing runs against the real release name rather than an addon's
/// decorative label. Ported from `src/lib/streams/parser/parser-filename.ts`.
library;

final RegExp _torrentioNoiseRx = RegExp(
  r'^[\s👤👥💾📦⚡🌐📺🎬🔊📅⚙️🔗📂🧑‍💻🇬🇧🇺🇸🌍🕵️‍♂️🔑]+'
  r'|[\s👤👥💾📦⚡🌐📺🎬🔊📅⚙️🔗📂🧑‍💻🇬🇧🇺🇸🌍🕵️‍♂️🔑]+$',
  unicode: true,
);

/// Returns the best filename line among [title], [filename], [description],
/// [name] (in that priority order), stripped of decorative noise.
String extractFilenameLine({
  String? title,
  String? filename,
  String? description,
  String? name,
}) {
  final lines = <String>[];
  for (final raw in [title, filename, description, name]) {
    if (raw == null || raw.isEmpty) continue;
    for (final line in raw.split(RegExp(r'\r?\n'))) {
      final trimmed = line.replaceAll(_torrentioNoiseRx, '').trim();
      if (trimmed.isNotEmpty) lines.add(trimmed);
    }
  }
  var best = '';
  var bestScore = double.negativeInfinity;
  for (final line in lines) {
    final s = _filenameScore(line);
    if (s > bestScore) {
      bestScore = s;
      best = line;
    }
  }
  return best;
}

double _filenameScore(String line) {
  if (line.length < 8) return -100;
  if (RegExp(
    r'^(?:torrentio|comet|mediafusion|aiostreams|knightcrawler|jackettio|torbox)\b',
    caseSensitive: false,
  ).hasMatch(line)) {
    return -100;
  }
  if (RegExp(
    r'^(?:4k|1080p|720p|480p|sd|hd|hdr|dv|uhd)$',
    caseSensitive: false,
  ).hasMatch(line)) {
    return -100;
  }
  if (RegExp(
    r'^[👤👥💾📦⚡🌐📺🎬🔊📅⚙️🔗📂🧑‍💻🇬🇧🇺🇸🌍🕵️‍♂️🔑]',
    unicode: true,
  ).hasMatch(line)) {
    return -100;
  }
  if (RegExp(
    r'^(?:size|seeders?|peers?|languages?)\s*[:=]',
    caseSensitive: false,
  ).hasMatch(line)) {
    return -50;
  }
  if (RegExp(
    r'^\[(?:RD|TB|AD|PM|DL)\+\]\s+\S+\s+library',
    caseSensitive: false,
  ).hasMatch(line)) {
    return -50;
  }

  final hasYear = RegExp(r'\b(?:19|20)\d{2}\b').hasMatch(line);
  final hasResolution =
      RegExp(r'\b\d{3,4}p\b', caseSensitive: false).hasMatch(line) ||
      RegExp(r'\b(?:4k|uhd|2160p)\b', caseSensitive: false).hasMatch(line);
  final hasEpisode = RegExp(
    r'\bS\d{1,2}E\d{1,3}\b',
    caseSensitive: false,
  ).hasMatch(line);
  final hasSource = RegExp(
    r'\b(?:Blu[.\-]?Ray|WEB[.\-]?DL|WEBRip|HDRip|BDRip|HDTV|REMUX|Remux'
    r'|HDCAM|TELESYNC|TELECINE|CAM|HDTS|DVDRip)\b',
    caseSensitive: false,
  ).hasMatch(line);
  final hasCodec = RegExp(
    r'\b(?:x264|x265|HEVC|AVC|h264|h265|AV1|MPEG2|MPEG-2)\b',
    caseSensitive: false,
  ).hasMatch(line);
  final hasContainer = RegExp(
    r'\.(?:mkv|mp4|m4v|avi|ts)\b',
    caseSensitive: false,
  ).hasMatch(line);
  final hasDots = RegExp(r'\.').allMatches(line).length >= 3;
  final technicalMarkers = [
    hasYear,
    hasResolution,
    hasEpisode,
    hasSource,
    hasCodec,
    hasContainer,
    hasDots,
  ].where((b) => b).length;

  if (technicalMarkers == 0) return -20;

  var s = 0.0;
  if (line.length >= 20) s += 2;
  if (hasDots) s += 3;
  if (hasYear) s += 2;
  if (hasResolution) s += 2;
  if (hasEpisode) s += 3;
  if (hasSource) s += 3;
  if (hasCodec) s += 1;
  if (hasContainer) s += 2;
  return s;
}
