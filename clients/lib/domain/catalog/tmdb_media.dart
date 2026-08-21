import 'tmdb.dart';

/// Ranks a title's YouTube videos into an ordered list of video keys, ported
/// 1:1 from `pickTrailers` in `src/lib/providers/tmdb/tmdb-trailers.ts`: official
/// trailers first, then unofficial trailers, official teasers, any teaser, then
/// clips/featurettes — de-duped by key.
List<String> pickTrailers(List<Map<String, dynamic>> videos) {
  bool isYouTube(Map<String, dynamic> v) => v['site'] == 'YouTube';
  String? type(Map<String, dynamic> v) => v['type'] as String?;
  bool official(Map<String, dynamic> v) => v['official'] == true;

  final yt = videos.where(isYouTube).toList();
  final ranked = <Map<String, dynamic>>[
    ...yt.where((v) => type(v) == 'Trailer' && official(v)),
    ...yt.where((v) => type(v) == 'Trailer' && !official(v)),
    ...yt.where((v) => type(v) == 'Teaser' && official(v)),
    ...yt.where((v) => type(v) == 'Teaser'),
    ...yt.where((v) => type(v) == 'Clip' || type(v) == 'Featurette'),
  ];

  final seen = <String>{};
  final out = <String>[];
  for (final v in ranked) {
    final key = v['key'] as String?;
    if (key == null || key.isEmpty || !seen.add(key)) continue;
    out.add(key);
  }
  return out;
}

/// Picks the best logo URL from TMDB logo entries, ported 1:1 from `pickLogo` in
/// `src/lib/providers/tmdb/tmdb-images.ts`: score by image-language rank (×100),
/// a PNG bonus, then vote average; the top-scoring `file_path` becomes a `w342`
/// URL. [imageLangNames] is the configured image-language priority (settings
/// `tmdbImageLangs`).
String? pickLogo(
  List<Map<String, dynamic>> logos,
  List<String> imageLangNames, {
  String? originalLang,
}) {
  if (logos.isEmpty) return null;
  double score(Map<String, dynamic> l) {
    final r = imageLangRank(
      l['iso_639_1'] as String?,
      imageLangNames,
      originalLang: originalLang,
    );
    final base = r >= 0 ? r * 100 : 0;
    final path = (l['file_path'] as String?)?.toLowerCase() ?? '';
    final isPng = path.endsWith('.png') ? 5 : 0;
    final vote = (l['vote_average'] as num?)?.toDouble() ?? 0;
    return base + isPng + vote;
  }

  final sorted = [...logos];
  stableSort(sorted, (a, b) => score(b).compareTo(score(a)));
  final path = sorted.first['file_path'] as String?;
  return path != null && path.isNotEmpty ? '$tmdbImg/w342$path' : null;
}
