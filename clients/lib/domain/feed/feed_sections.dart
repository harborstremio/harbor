import '../addons/addon_client.dart';
import '../addons/models.dart';
import '../catalog/cinemeta_catalog.dart' show cinemetaTop;
import '../catalog/tmdb.dart' show TmdbClient, kMovieGenres;
import '../discover/affinity.dart';
import '../library/playback_history.dart' show WatchedSet;
import '../settings/settings.dart';
import 'feed_locale.dart';
import 'feed_rank.dart';

/// Genre-name aliases TMDB uses that are not in [kMovieGenres], ported from
/// `GENRE_ALIAS`.
const Map<String, int> _genreAlias = {
  'Science Fiction': 878,
  'Action & Adventure': 28,
  'Sci-Fi & Fantasy': 878,
};

/// The TMDB genre id for a genre [name], or null. Ported 1:1 from
/// `genreToTmdbId`.
int? genreToTmdbId(String name) => kMovieGenres[name] ?? _genreAlias[name];

String _fmtDay(int ms) => DateTime.fromMillisecondsSinceEpoch(
  ms,
  isUtc: true,
).toIso8601String().substring(0, 10);

/// Short movies (70–90 min), well-rated. Ported 1:1 from `fetchUnderNinety`.
Future<List<MetaPreview>> fetchUnderNinety(TmdbClient tmdb, {int page = 1}) {
  if (!tmdb.hasKey) return Future.value(const []);
  return tmdb.discover('movie', {
    'with_runtime.lte': '90',
    'with_runtime.gte': '70',
    'vote_average.gte': '7.0',
    'vote_count.gte': '300',
    'sort_by': 'vote_average.desc',
    'page': '$page',
  });
}

/// Movies released in the last 90 days, by popularity. Ported 1:1 from
/// `fetchRecentlyAdded`.
Future<List<MetaPreview>> fetchRecentlyAdded(
  TmdbClient tmdb, {
  int page = 1,
  DateTime Function() clock = DateTime.now,
}) {
  if (!tmdb.hasKey) return Future.value(const []);
  const day = 24 * 60 * 60 * 1000;
  final now = clock().millisecondsSinceEpoch;
  return tmdb.discover('movie', {
    'primary_release_date.gte': _fmtDay(now - 90 * day),
    'primary_release_date.lte': _fmtDay(now),
    'vote_count.gte': '50',
    'with_runtime.gte': '70',
    'sort_by': 'popularity.desc',
    'page': '$page',
  });
}

/// Upcoming releases. Ported 1:1 from `fetchComingSoon`.
Future<List<MetaPreview>> fetchComingSoon(TmdbClient tmdb, {int page = 1}) {
  if (!tmdb.hasKey) return Future.value(const []);
  return tmdb.movieRow('upcoming', page: page);
}

/// Now in theaters. Ported 1:1 from `fetchInTheaters`.
Future<List<MetaPreview>> fetchInTheaters(TmdbClient tmdb, {int page = 1}) {
  if (!tmdb.hasKey) return Future.value(const []);
  return tmdb.movieRow('now_playing', page: page);
}

/// Top-rated movies. Ported 1:1 from `fetchTopRated`.
Future<List<MetaPreview>> fetchTopRated(TmdbClient tmdb, {int page = 1}) {
  if (!tmdb.hasKey) return Future.value(const []);
  return tmdb.movieRow('top_rated', page: page);
}

/// Trending movies this week. Ported 1:1 from `fetchTrendingWeek`.
Future<List<MetaPreview>> fetchTrendingWeek(TmdbClient tmdb, {int page = 1}) {
  if (!tmdb.hasKey) return Future.value(const []);
  return tmdb.trending('movie', page: page);
}

/// Top-rated series. Ported 1:1 from `fetchTopSeries`.
Future<List<MetaPreview>> fetchTopSeries(TmdbClient tmdb, {int page = 1}) {
  if (!tmdb.hasKey) return Future.value(const []);
  return tmdb.seriesRow('top_rated', page: page);
}

/// Acclaimed documentaries. Ported 1:1 from `fetchDocumentaries`.
Future<List<MetaPreview>> fetchDocumentaries(TmdbClient tmdb, {int page = 1}) {
  if (!tmdb.hasKey) return Future.value(const []);
  return tmdb.discover('movie', {
    'with_genres': '${kMovieGenres['Documentary']}',
    'vote_average.gte': '7.5',
    'vote_count.gte': '200',
    'sort_by': 'vote_average.desc',
    'page': '$page',
  });
}

/// Up to three TMDB genre ids drawn from the strongest positive genre affinities,
/// ported 1:1 from `tasteSeedGenres`.
List<int> _tasteSeedGenres(Affinity affinity) {
  if (affinity.totalEvents == 0) return const [];
  final seen = <int>{};
  final out = <int>[];
  for (final e in topEntries(affinity.genres, 6)) {
    if (e.value <= 0) continue;
    final gid = genreToTmdbId(e.key);
    if (gid == null || seen.contains(gid)) continue;
    seen.add(gid);
    out.add(gid);
    if (out.length >= 3) break;
  }
  return out;
}

/// The featured-hero pool: taste-seeded genre picks interleaved with top-rated,
/// trending and acclaimed movies (or the Cinemeta top without a key), excluding
/// voted and recently-watched titles and any without a backdrop, then ranked by
/// affinity down to ten. Ported 1:1 from `fetchFeatured`.
Future<List<MetaPreview>> fetchFeatured(
  TmdbClient tmdb,
  AddonClient addon,
  Settings settings,
  Affinity affinity,
  Set<String> blocked,
  WatchedSet watched,
) async {
  final locale = localeWeights(settings);
  Map<String, String> loc(Map<String, String> floor) =>
      localizeFloor(floor, settings, 'movie');
  bool skip(MetaPreview m) =>
      blocked.contains(m.id) || watched.contains(m.id, m.name);

  if (!tmdb.hasKey) {
    final list = await cinemetaTop(addon, 'movie');
    final pool = [
      for (final m in list)
        if (m.background != null && !skip(m)) m,
    ].take(40).toList();
    return rankMetasByAffinity(pool, affinity, locale).take(10).toList();
  }

  final seedGenres = _tasteSeedGenres(affinity);
  final results = await Future.wait([
    tmdb.movieRow('top_rated', region: settings.region),
    tmdb.trending('movie'),
    tmdb.discover(
      'movie',
      loc({
        'vote_average.gte': '8.0',
        'vote_count.gte': '3000',
        'sort_by': 'vote_count.desc',
        'page': '1',
      }),
    ),
    for (final gid in seedGenres)
      tmdb.discover(
        'movie',
        loc({
          'with_genres': '$gid',
          'vote_average.gte': '6.8',
          'vote_count.gte': '600',
          'sort_by': 'popularity.desc',
          'page': '1',
        }),
      ),
  ]);
  final topRated = results[0];
  final trending = results[1];
  final acclaimed = results[2];
  final seeds = results.sublist(3);

  final seen = <String>{};
  final pool = <MetaPreview>[];
  void push(MetaPreview? m) {
    if (m == null || seen.contains(m.id) || m.background == null || skip(m)) {
      return;
    }
    seen.add(m.id);
    pool.add(m);
  }

  for (var i = 0; i < 20 && pool.length < 40; i++) {
    for (final list in seeds) {
      if (i < list.length) push(list[i]);
    }
  }
  final slots = [trending, topRated, acclaimed];
  for (var i = 0; i < 16 && pool.length < 40; i++) {
    for (final list in slots) {
      if (i < list.length) push(list[i]);
    }
  }
  return rankMetasByAffinity(pool, affinity, locale).take(10).toList();
}

/// The day-rotated critics' picks — four high-vote discover pages interleaved,
/// excluding recently-watched titles. Ported 1:1 from `fetchCriticsPickList`.
Future<List<MetaPreview>> fetchCriticsPickList(
  TmdbClient tmdb,
  Settings settings,
  WatchedSet watched, {
  DateTime Function() clock = DateTime.now,
}) async {
  if (!tmdb.hasKey) return const [];
  Map<String, String> loc(Map<String, String> floor) =>
      localizeFloor(floor, settings, 'movie');
  final now = clock();
  final dayOfYear =
      (now.millisecondsSinceEpoch -
          DateTime(now.year, 1, 0).millisecondsSinceEpoch) ~/
      86400000;
  String pageOf(int offset) => '${((dayOfYear + offset) % 5) + 1}';

  final queries = await Future.wait([
    tmdb.discover(
      'movie',
      loc({
        'vote_average.gte': '8.0',
        'vote_count.gte': '5000',
        'sort_by': 'vote_average.desc',
        'page': pageOf(0),
      }),
    ),
    tmdb.discover(
      'movie',
      loc({
        'vote_average.gte': '7.6',
        'vote_count.gte': '1500',
        'primary_release_date.gte': '2018-01-01',
        'sort_by': 'vote_average.desc',
        'page': pageOf(1),
      }),
    ),
    tmdb.discover(
      'movie',
      loc({
        'vote_average.gte': '7.5',
        'vote_count.gte': '1200',
        'sort_by': 'vote_count.desc',
        'page': pageOf(2),
      }),
    ),
    tmdb.discover(
      'movie',
      loc({
        'vote_average.gte': '7.5',
        'vote_count.gte': '800',
        'primary_release_date.lte': '1999-12-31',
        'sort_by': 'vote_average.desc',
        'page': pageOf(3),
      }),
    ),
  ]);

  final seen = <String>{};
  final merged = <MetaPreview>[];
  final max = queries.fold<int>(0, (m, q) => q.length > m ? q.length : m);
  for (var i = 0; i < max; i++) {
    for (final list in queries) {
      if (i >= list.length) continue;
      final m = list[i];
      if (seen.contains(m.id)) continue;
      if (watched.contains(m.id, m.name)) continue;
      seen.add(m.id);
      merged.add(m);
    }
  }
  return merged;
}

/// A sample of well-rated titles in [genre] — TMDB discover when keyed, else the
/// Cinemeta genre top (capped at 24). Ported 1:1 from `fetchGenreSample`.
Future<List<MetaPreview>> fetchGenreSample(
  TmdbClient tmdb,
  AddonClient addon,
  String genre,
) async {
  final gid = kMovieGenres[genre];
  if (tmdb.hasKey && gid != null) {
    return tmdb.discover('movie', {
      'with_genres': '$gid',
      'vote_average.gte': '7.0',
      'vote_count.gte': '500',
      'sort_by': 'popularity.desc',
      'page': '1',
    });
  }
  final list = await cinemetaTop(addon, 'movie', genre);
  return list.length > 24 ? list.sublist(0, 24) : list;
}
