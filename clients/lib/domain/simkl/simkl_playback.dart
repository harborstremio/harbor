import '../library/local_cw.dart';

/// Nominal durations used to turn a Simkl progress percentage into a resume
/// position (web `DURATION_MS`).
const int _durMovie = 6300000;
const int _durSeries = 2640000;

final _imdbRe = RegExp(r'^tt\d+$');

String? _movieMetaId(Map ids) {
  final imdb = ids['imdb'];
  if (imdb is String && _imdbRe.hasMatch(imdb)) return imdb;
  final tmdb = ids['tmdb'];
  if (tmdb != null) return 'tmdb:movie:$tmdb';
  return null;
}

String? _seriesMetaId(Map ids) {
  final imdb = ids['imdb'];
  if (imdb is String && _imdbRe.hasMatch(imdb)) return imdb;
  final tmdb = ids['tmdb'];
  if (tmdb != null) return 'tmdb:tv:$tmdb';
  final mal = ids['mal'];
  if (mal != null) return 'mal:$mal';
  final kitsu = ids['kitsu'];
  if (kitsu != null) return 'kitsu:$kitsu';
  return null;
}

int _whenMs(Object? watchedAt) {
  if (watchedAt is! String) return 0;
  return DateTime.tryParse(watchedAt)?.millisecondsSinceEpoch ?? 0;
}

LocalCwEntry _item(
  String id,
  String type,
  Map node,
  double pct,
  int durMs,
  int whenMs, {
  int? season,
  int? episode,
  bool isAnime = false,
}) => LocalCwEntry(
  id: id,
  type: type,
  name: (node['title'] ?? 'Untitled').toString(),
  season: (season != null && season > 0) ? season : null,
  episode: (episode != null && episode > 0) ? episode : null,
  positionMs: ((pct / 100) * durMs).round(),
  durationMs: durMs,
  t: whenMs,
  external: 'simkl',
  isAnime: isAnime,
);

LocalCwEntry? _toEntry(Map r) {
  final pct = ((r['progress'] as num?)?.toDouble() ?? 0).clamp(0.0, 100.0);
  // Skip not-started / basically-finished sessions (web 2–98% window).
  if (pct < 2 || pct > 98) return null;
  final whenMs = _whenMs(r['watched_at']);

  final movie = r['movie'];
  if (movie is Map) {
    final ids = movie['ids'];
    final id = ids is Map ? _movieMetaId(ids) : null;
    return id == null
        ? null
        : _item(id, 'movie', movie, pct, _durMovie, whenMs);
  }

  final anime = r['anime'];
  final show = r['show'];
  final episode = r['episode'];
  // An anime movie: an anime node with no show/episode context.
  if (show == null && episode == null && anime is Map) {
    final ids = anime['ids'];
    final movieId = ids is Map ? _movieMetaId(ids) : null;
    if (movieId != null) {
      return _item(
        movieId,
        'movie',
        anime,
        pct,
        _durMovie,
        whenMs,
        isAnime: true,
      );
    }
  }

  final seriesNode = (show is Map) ? show : (anime is Map ? anime : null);
  if (seriesNode != null) {
    final ids = seriesNode['ids'];
    final id = ids is Map ? _seriesMetaId(ids) : null;
    if (id == null) return null;
    final ep = episode is Map ? episode : const {};
    return _item(
      id,
      'series',
      seriesNode,
      pct,
      _durSeries,
      whenMs,
      season: (ep['season'] as num?)?.toInt(),
      episode: (ep['number'] as num?)?.toInt(),
      // Anime when the series node came from `anime`, not `show` (web `!raw.show`).
      isAnime: show is! Map,
    );
  }
  return null;
}

/// Parses Simkl `/sync/playback` sessions into external Continue-Watching
/// entries (`external: 'simkl'`). Ports web `toLibraryItem` +
/// `fetchSimklPlaybackItems`: only 2–98% progress, deduped by `id|season|
/// episode`, movie/show/anime nodes resolved to stremio ids.
List<LocalCwEntry> parseSimklPlayback(List<dynamic> raw) {
  final out = <LocalCwEntry>[];
  final seen = <String>{};
  for (final r in raw) {
    if (r is! Map) continue;
    final entry = _toEntry(r);
    if (entry == null) continue;
    final key = '${entry.id}|${entry.season ?? ''}|${entry.episode ?? ''}';
    if (!seen.add(key)) continue;
    out.add(entry);
  }
  return out;
}
