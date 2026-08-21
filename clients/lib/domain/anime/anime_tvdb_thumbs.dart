import '../catalog/tvdb.dart';

/// An index of TVDB episode thumbnails, resolvable by `"season:episode"` and by
/// absolute number. Ported from `TvdbThumbIndex`.
class TvdbThumbIndex {
  const TvdbThumbIndex({
    required this.bySeasonEpisode,
    required this.byAbsolute,
  });

  final Map<String, String> bySeasonEpisode;
  final Map<int, String> byAbsolute;
}

/// Builds a thumbnail index for a series, preferring the absolute-order list —
/// which numbers episodes positionally across seasons and also honours each
/// episode's own absolute number — and falling back to the wanted seasons in
/// aired order, numbered positionally after sorting. Ported 1:1 from
/// `fetchTvdbThumbs`.
Future<TvdbThumbIndex> fetchTvdbThumbs(
  TvdbClient tvdb,
  String apiKey,
  int seriesId,
  List<int> seasons,
) async {
  final bySeasonEpisode = <String, String>{};
  final byAbsolute = <int, String>{};

  List<TvdbEpisode> absEps;
  try {
    absEps = await tvdb.episodesAbsolute(apiKey, seriesId);
  } catch (_) {
    absEps = const [];
  }
  if (absEps.isNotEmpty) {
    var pos = 0;
    for (final e in absEps) {
      pos += 1;
      final image = e.image;
      if (image == null) continue;
      bySeasonEpisode['${e.seasonNumber}:${e.number}'] = image;
      byAbsolute.putIfAbsent(pos, () => image);
      final abs = e.absoluteNumber;
      if (abs != null) byAbsolute.putIfAbsent(abs, () => image);
    }
    return TvdbThumbIndex(
      bySeasonEpisode: bySeasonEpisode,
      byAbsolute: byAbsolute,
    );
  }

  final wanted = (seasons.isNotEmpty ? seasons : const [1]).toSet();
  final lists = await Future.wait([
    for (final s in wanted) _episodesOrEmpty(tvdb, apiKey, seriesId, s),
  ]);
  for (final list in lists) {
    for (final e in list) {
      final image = e.image;
      if (image == null) continue;
      bySeasonEpisode['${e.seasonNumber}:${e.number}'] = image;
    }
  }
  final flat = [
    for (final list in lists)
      for (final e in list)
        if (e.image != null) e,
  ];
  flat.sort((a, b) {
    final s = a.seasonNumber.compareTo(b.seasonNumber);
    return s != 0 ? s : a.number.compareTo(b.number);
  });
  var abs = 0;
  for (final e in flat) {
    abs += 1;
    byAbsolute.putIfAbsent(abs, () => e.image!);
  }
  return TvdbThumbIndex(
    bySeasonEpisode: bySeasonEpisode,
    byAbsolute: byAbsolute,
  );
}

Future<List<TvdbEpisode>> _episodesOrEmpty(
  TvdbClient tvdb,
  String apiKey,
  int seriesId,
  int season,
) async {
  try {
    return await tvdb.episodes(apiKey, seriesId, season);
  } catch (_) {
    return const [];
  }
}
