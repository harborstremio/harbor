import '../addons/addon_client.dart';
import '../addons/models.dart';
import '../catalog/cinemeta_catalog.dart' show cinemetaTop;
import '../catalog/tmdb.dart' show TmdbClient, kMovieGenres;
import 'feed_seed.dart' show dailySeed, feedShuffle, pickRandom;
import 'feed_tags.dart';

/// A themed Discover shelf — a titled row with its own paged fetcher. Ported 1:1
/// from `Shelf`.
class Shelf {
  const Shelf({
    required this.id,
    required this.title,
    required this.fetch,
    this.kicker,
  });

  final String id;
  final String title;
  final String? kicker;
  final Future<List<MetaPreview>> Function([int page]) fetch;
}

/// The Discover shelves: a day-shuffled selection of TMDB rows, or the Cinemeta
/// fallback without a key. Ported 1:1 from `pickShelves`.
List<Shelf> pickShelves(
  TmdbClient tmdb,
  AddonClient addon, {
  int n = 8,
  DateTime Function() clock = DateTime.now,
}) {
  if (!tmdb.hasKey) return fallbackShelves(addon, clock: clock);
  return _tmdbShelves(tmdb, n, clock);
}

List<Shelf> _tmdbShelves(TmdbClient tmdb, int n, DateTime Function() clock) {
  final seed = dailySeed(clock());
  final genres = pickRandom(kMovieGenres.keys.toList(), 4, seed + 10);
  final decades = pickRandom(kDecades, 3, seed + 20);
  final languages = pickRandom(kFeedLanguages, 2, seed + 30);

  Future<List<MetaPreview>> disc(Map<String, String> floor, int page) =>
      tmdb.discover('movie', {...floor, 'page': '$page'});

  final all = <Shelf>[
    Shelf(
      id: 'trending_week',
      title: 'Trending This Week',
      kicker: 'What people are watching',
      fetch: ([page = 1]) => tmdb.trending('movie', page: page),
    ),
    Shelf(
      id: 'in_theaters',
      title: 'In Theaters',
      kicker: 'Showing now',
      fetch: ([page = 1]) => tmdb.movieRow('now_playing', page: page),
    ),
    Shelf(
      id: 'critically_loved',
      title: 'Critically Loved',
      kicker: 'Vote average ≥ 8.0',
      fetch: ([page = 1]) => disc({
        'vote_average.gte': '8.0',
        'vote_count.gte': '1000',
        'with_runtime.gte': '70',
        'sort_by': 'vote_average.desc',
      }, page),
    ),
    Shelf(
      id: 'hidden_gems',
      title: 'Highly Rated, Quietly Loved',
      kicker: 'High score, low fanfare',
      fetch: ([page = 1]) => disc({
        'vote_average.gte': '7.2',
        'vote_count.gte': '300',
        'vote_count.lte': '3500',
        'with_runtime.gte': '70',
        'sort_by': 'vote_average.desc',
      }, page),
    ),
    Shelf(
      id: 'cult_classics',
      title: 'Cult Classics',
      kicker: 'Beloved, slightly forgotten',
      fetch: ([page = 1]) => disc({
        'primary_release_date.lte': '1999-12-31',
        'vote_average.gte': '7.4',
        'vote_count.gte': '300',
        'vote_count.lte': '5000',
        'sort_by': 'vote_average.desc',
      }, page),
    ),
    Shelf(
      id: 'series_top',
      title: 'Series, Critically Acclaimed',
      kicker: 'Top rated television',
      fetch: ([page = 1]) => tmdb.seriesRow('top_rated', page: page),
    ),
    for (final g in genres)
      Shelf(
        id: 'genre_$g',
        title: 'Top Rated $g',
        fetch: ([page = 1]) => disc({
          'with_genres': '${kMovieGenres[g]}',
          'vote_average.gte': '6.8',
          'vote_count.gte': '300',
          'with_runtime.gte': '70',
          'sort_by': 'vote_average.desc',
        }, page),
      ),
    for (final d in decades)
      Shelf(
        id: 'decade_${d.label}',
        title: 'Hidden Gems · ${d.label}',
        kicker: 'From the ${d.label}',
        fetch: ([page = 1]) => disc({
          'primary_release_date.gte': d.from,
          'primary_release_date.lte': d.to,
          'vote_average.gte': '7.2',
          'vote_count.gte': '200',
          'vote_count.lte': '3000',
          'with_runtime.gte': '70',
          'sort_by': 'vote_average.desc',
        }, page),
      ),
    for (final l in languages)
      Shelf(
        id: 'lang_${l.code}',
        title: l.label,
        kicker: 'Top rated abroad',
        fetch: ([page = 1]) => disc({
          'with_original_language': l.code,
          'vote_average.gte': '7.0',
          'vote_count.gte': '150',
          'sort_by': 'vote_average.desc',
        }, page),
      ),
    Shelf(
      id: 'animated_for_grown_ups',
      title: 'Animated, For Grown-Ups',
      kicker: "Beyond the kids' shelf",
      fetch: ([page = 1]) => disc({
        'with_genres': '${kMovieGenres['Animation']}',
        'vote_average.gte': '7.4',
        'vote_count.gte': '500',
        'sort_by': 'vote_average.desc',
      }, page),
    ),
  ];

  return feedShuffle(all, seed).take(n).toList();
}

/// The keyless Discover shelves — Cinemeta top movies, top series, and a handful
/// of day-picked genre tops. Ported 1:1 from `fallbackShelves`.
List<Shelf> fallbackShelves(
  AddonClient addon, {
  DateTime Function() clock = DateTime.now,
}) {
  const genres = [
    'Drama',
    'Comedy',
    'Action',
    'Crime',
    'Sci-Fi',
    'Thriller',
    'Horror',
    'Romance',
  ];
  final picked = pickRandom(genres, 5, dailySeed(clock()));
  return [
    Shelf(
      id: 'cinemeta_movies',
      title: 'Top Movies',
      fetch: ([page = 1]) => cinemetaTop(addon, 'movie'),
    ),
    Shelf(
      id: 'cinemeta_series',
      title: 'Top Series',
      fetch: ([page = 1]) => cinemetaTop(addon, 'series'),
    ),
    for (final g in picked)
      Shelf(
        id: 'cinemeta_$g',
        title: 'Top $g',
        fetch: ([page = 1]) => cinemetaTop(addon, 'movie', g),
      ),
  ];
}
