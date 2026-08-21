import '../addons/addon_client.dart';
import '../addons/models.dart';
import '../catalog/cinemeta_catalog.dart' show cinemetaTop;
import '../catalog/tmdb.dart' show TmdbClient, kMovieGenres;
import 'feed_seed.dart' show dailySeed, feedShuffle, pickRandom;
import 'feed_tags.dart';

/// One entry in the Discover feed pool — a title plus its display [tag] and the
/// [category] it interleaves within. Ported 1:1 from the web `FeedItem`.
class FeedItem {
  const FeedItem({
    required this.meta,
    required this.tag,
    required this.category,
  });

  final MetaPreview meta;

  /// The human label ("Trending", "Top Rated", a genre or decade name).
  final String tag;

  /// The interleave bucket ("trending_movies", "genre_Action", …).
  final String category;
}

/// Labels each meta with a [tag]/[category], ported from `label`.
List<FeedItem> labelFeed(
  List<MetaPreview> metas,
  String tag,
  String category,
) => [for (final m in metas) FeedItem(meta: m, tag: tag, category: category)];

/// De-dupes by id, drops poster-less titles, then daily-shuffles and interleaves
/// the pool by category — ported 1:1 from the pool's `finalize` + `interleave`.
List<FeedItem> finalizePool(List<FeedItem> items, int seed) {
  final seen = <String>{};
  final filtered = <FeedItem>[];
  for (final it in items) {
    if (it.meta.poster == null) continue;
    if (!seen.add(it.meta.id)) continue;
    filtered.add(it);
  }
  return _interleave(feedShuffle(filtered, seed));
}

/// Round-robins the items across their categories, preserving each category's
/// (already-shuffled) order — ported 1:1 from `interleave`.
List<FeedItem> _interleave(List<FeedItem> items) {
  final buckets = <String, List<FeedItem>>{};
  for (final it in items) {
    (buckets[it.category] ??= <FeedItem>[]).add(it);
  }
  final queues = buckets.values.toList();
  final idx = List.filled(queues.length, 0);
  final out = <FeedItem>[];
  var any = true;
  while (any) {
    any = false;
    for (var q = 0; q < queues.length; q++) {
      if (idx[q] < queues[q].length) {
        out.add(queues[q][idx[q]]);
        idx[q]++;
        any = true;
      }
    }
  }
  return out;
}

Future<List<FeedItem>> _await(List<Future<List<FeedItem>>> queries) async {
  final batches = await Future.wait(
    queries.map((q) => q.catchError((_) => <FeedItem>[])),
  );
  return [for (final b in batches) ...b];
}

/// Builds the Discover pool, ported 1:1 from `buildPool`: the keyed TMDB pool,
/// or the keyless Cinemeta fallback pool.
Future<List<FeedItem>> buildPool(
  TmdbClient tmdb,
  AddonClient addon, {
  DateTime Function() clock = DateTime.now,
}) {
  return tmdb.hasKey
      ? _buildTmdbPool(tmdb, clock)
      : _buildFallbackPool(addon, clock);
}

/// The keyed pool — trending, top-rated, hidden gems, acclaimed, cult, plus
/// day-rotated genre / decade / language strands. Ported from `buildTmdbPool`.
Future<List<FeedItem>> _buildTmdbPool(
  TmdbClient tmdb,
  DateTime Function() clock,
) async {
  final seed = dailySeed(clock());
  final genres = pickRandom(kMovieGenres.keys.toList(), 4, seed);
  final decades = pickRandom(kDecades, 3, seed + 1);
  final languages = pickRandom(kFeedLanguages, 2, seed + 2);

  final merged = await _await([
    tmdb
        .trending('movie', page: 1)
        .then((m) => labelFeed(m, 'Trending', 'trending_movies')),
    tmdb
        .trending('movie', page: 2)
        .then((m) => labelFeed(m, 'Trending', 'trending_movies')),
    tmdb
        .trending('tv', page: 1)
        .then((m) => labelFeed(m, 'Trending', 'trending_series')),
    tmdb
        .movieRow('top_rated', page: 1)
        .then((m) => labelFeed(m, 'Top Rated', 'top_rated_movies')),
    tmdb
        .movieRow('top_rated', page: 2)
        .then((m) => labelFeed(m, 'Top Rated', 'top_rated_movies')),
    tmdb
        .movieRow('top_rated', page: 3)
        .then((m) => labelFeed(m, 'Top Rated', 'top_rated_movies')),
    tmdb
        .movieRow('popular', page: 1)
        .then((m) => labelFeed(m, 'Trending', 'popular_movies')),
    tmdb
        .seriesRow('top_rated', page: 1)
        .then((m) => labelFeed(m, 'Series', 'top_rated_series')),
    tmdb
        .seriesRow('top_rated', page: 2)
        .then((m) => labelFeed(m, 'Series', 'top_rated_series')),
    tmdb
        .discover('movie', _hiddenGemParams('1'))
        .then((m) => labelFeed(m, 'Hidden Gem', 'hidden_gems')),
    tmdb
        .discover('movie', _hiddenGemParams('2'))
        .then((m) => labelFeed(m, 'Hidden Gem', 'hidden_gems')),
    tmdb
        .discover('movie', _acclaimedParams())
        .then((m) => labelFeed(m, 'Acclaimed', 'acclaimed')),
    tmdb
        .discover('movie', _cultParams())
        .then((m) => labelFeed(m, 'Cult Classic', 'cult_classics')),
    for (final g in genres)
      tmdb
          .discover('movie', _genreParams(g))
          .then((m) => labelFeed(m, g, 'genre_$g')),
    for (final d in decades)
      tmdb
          .discover('movie', _decadeParams(d.from, d.to))
          .then(
            (m) => labelFeed(m, 'From the ${d.label}', 'decade_${d.label}'),
          ),
    for (final l in languages)
      tmdb
          .discover('movie', _languageParams(l.code))
          .then((m) => labelFeed(m, l.label, 'lang_${l.code}')),
  ]);
  return finalizePool(merged, seed);
}

/// The keyless pool — Cinemeta top movies/series plus six genre tops. Ported
/// from `buildFallbackPool`.
Future<List<FeedItem>> _buildFallbackPool(
  AddonClient addon,
  DateTime Function() clock,
) async {
  const genres = ['Drama', 'Comedy', 'Action', 'Crime', 'Sci-Fi', 'Thriller'];
  final merged = await _await([
    cinemetaTop(
      addon,
      'movie',
    ).then((m) => labelFeed(m, 'Trending', 'cinemeta_top_movies')),
    cinemetaTop(
      addon,
      'series',
    ).then((m) => labelFeed(m, 'Series', 'cinemeta_top_series')),
    for (final g in genres)
      cinemetaTop(
        addon,
        'movie',
        g,
      ).then((m) => labelFeed(m, g, 'cinemeta_genre_$g')),
  ]);
  return finalizePool(merged, dailySeed(clock()));
}

/// A further page of the keyed pool for infinite scroll, ported from
/// `extendPool`. Empty without a key.
Future<List<FeedItem>> extendPool(
  TmdbClient tmdb,
  int page, {
  DateTime Function() clock = DateTime.now,
}) async {
  if (!tmdb.hasKey) return const [];
  final seed = dailySeed(clock()) + page;
  final genres = pickRandom(kMovieGenres.keys.toList(), 3, seed);
  final decades = pickRandom(kDecades, 2, seed + 1);
  final merged = await _await([
    tmdb
        .trending('movie', page: page)
        .then((m) => labelFeed(m, 'Trending', 'trending_movies')),
    tmdb
        .trending('tv', page: page)
        .then((m) => labelFeed(m, 'Trending', 'trending_series')),
    tmdb
        .movieRow('popular', page: page)
        .then((m) => labelFeed(m, 'Trending', 'popular_movies')),
    tmdb
        .movieRow('top_rated', page: page + 2)
        .then((m) => labelFeed(m, 'Top Rated', 'top_rated_movies')),
    tmdb
        .seriesRow('top_rated', page: page + 2)
        .then((m) => labelFeed(m, 'Series', 'top_rated_series')),
    for (final g in genres)
      tmdb
          .discover('movie', {..._genreParams(g), 'page': '$page'})
          .then((m) => labelFeed(m, g, 'genre_$g')),
    for (final d in decades)
      tmdb
          .discover('movie', {..._decadeParams(d.from, d.to), 'page': '$page'})
          .then(
            (m) => labelFeed(m, 'From the ${d.label}', 'decade_${d.label}'),
          ),
  ]);
  return finalizePool(merged, seed);
}

Map<String, String> _hiddenGemParams(String page) => {
  'vote_average.gte': '7.2',
  'vote_count.gte': '300',
  'vote_count.lte': '3500',
  'with_runtime.gte': '70',
  'sort_by': 'vote_average.desc',
  'page': page,
};

Map<String, String> _acclaimedParams() => {
  'vote_average.gte': '8.0',
  'vote_count.gte': '1000',
  'with_runtime.gte': '70',
  'sort_by': 'vote_average.desc',
  'page': '1',
};

Map<String, String> _cultParams() => {
  'primary_release_date.lte': '1999-12-31',
  'vote_average.gte': '7.4',
  'vote_count.gte': '300',
  'vote_count.lte': '5000',
  'with_runtime.gte': '70',
  'sort_by': 'vote_average.desc',
  'page': '1',
};

Map<String, String> _genreParams(String genre) => {
  'with_genres': '${kMovieGenres[genre]}',
  'vote_average.gte': '6.8',
  'vote_count.gte': '200',
  'with_runtime.gte': '70',
  'sort_by': 'vote_average.desc',
  'page': '1',
};

Map<String, String> _decadeParams(String from, String to) => {
  'primary_release_date.gte': from,
  'primary_release_date.lte': to,
  'vote_average.gte': '7.0',
  'vote_count.gte': '200',
  'with_runtime.gte': '70',
  'sort_by': 'vote_average.desc',
  'page': '1',
};

Map<String, String> _languageParams(String code) => {
  'with_original_language': code,
  'vote_average.gte': '6.8',
  'vote_count.gte': '100',
  'with_runtime.gte': '70',
  'sort_by': 'vote_average.desc',
  'page': '1',
};
