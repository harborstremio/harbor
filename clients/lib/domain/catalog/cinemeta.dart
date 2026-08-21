import '../addons/addon_client.dart';
import '../addons/addon_url.dart';
import '../addons/models.dart';
import 'catalog_row.dart';

/// Cinemeta is Harbor's default metadata addon and provides catalogs without
/// requiring a TMDB key (the keyless content path). Base per `docs/30`.
const String cinemetaBase = 'https://v3-cinemeta.strem.io';

/// The full keyless Home content: the ordered rows plus the hero pool.
class CinemetaHome {
  const CinemetaHome({required this.rows, required this.hero});
  final List<CatalogRow> rows;
  final List<MetaPreview> hero;
}

/// Fetches Cinemeta's `top` catalog for a type, optionally by genre.
Future<List<MetaPreview>> _top(
  AddonClient client,
  String type, [
  String? genre,
]) async {
  final r = await client.catalog(
    cinemetaBase,
    type,
    'top',
    extras: genre != null ? [CatalogExtra('genre', genre)] : const [],
  );
  return r.valueOrNull ?? const [];
}

List<MetaPreview> _slice(List<MetaPreview> list, int start, [int? end]) {
  if (start >= list.length) return const [];
  return list.sublist(start, end != null && end < list.length ? end : null);
}

/// Builds the full keyless Home rows + hero pool, ported 1:1 from
/// `buildCinemetaRows` in `src/views/home/home-rows.ts` — the top-10 + popular
/// leads plus twelve movie-genre and three series-genre shelves.
Future<CinemetaHome> fetchCinemetaHome(AddonClient client) async {
  final results = await Future.wait([
    _top(client, 'movie'), // 0 movies
    _top(client, 'series'), // 1 series
    _top(client, 'movie', 'Drama'), // 2
    _top(client, 'movie', 'Comedy'), // 3
    _top(client, 'movie', 'Action'), // 4
    _top(client, 'movie', 'Sci-Fi'), // 5
    _top(client, 'movie', 'Thriller'), // 6
    _top(client, 'movie', 'Animation'), // 7
    _top(client, 'movie', 'Horror'), // 8
    _top(client, 'movie', 'Romance'), // 9
    _top(client, 'movie', 'Adventure'), // 10
    _top(client, 'movie', 'Documentary'), // 11
    _top(client, 'movie', 'Mystery'), // 12
    _top(client, 'movie', 'Fantasy'), // 13
    _top(client, 'series', 'Drama'), // 14
    _top(client, 'series', 'Comedy'), // 15
    _top(client, 'series', 'Crime'), // 16
  ]);
  final movies = results[0];
  final series = results[1];

  CatalogRow row(
    String key,
    String type,
    String name,
    List<MetaPreview> metas, {
    String? genre,
    bool numerals = false,
  }) => CatalogRow(
    key: key,
    title: name,
    type: type,
    id: 'top',
    genre: genre,
    numerals: numerals,
    items: metas,
  );

  final rows = <CatalogRow>[
    row(
      'cm-top-movies',
      'movie',
      'Top 10 on Stremio',
      _slice(movies, 0, 10),
      numerals: true,
    ),
    row('cm-popular', 'movie', 'Popular Movies', _slice(movies, 10, 40)),
    row(
      'cm-drama',
      'movie',
      'Top 10 Drama',
      _slice(results[2], 0, 10),
      genre: 'Drama',
      numerals: true,
    ),
    row('cm-trending-tv', 'series', 'Trending Series', _slice(series, 0, 30)),
    row(
      'cm-comedy',
      'movie',
      'Top 10 Comedy',
      _slice(results[3], 0, 10),
      genre: 'Comedy',
      numerals: true,
    ),
    row(
      'cm-action',
      'movie',
      'Action Hits',
      _slice(results[4], 0, 30),
      genre: 'Action',
    ),
    row(
      'cm-scifi',
      'movie',
      'Sci-Fi & Fantasy',
      _slice(results[5], 0, 30),
      genre: 'Sci-Fi',
    ),
    row(
      'cm-thriller',
      'movie',
      'Thrillers',
      _slice(results[6], 0, 30),
      genre: 'Thriller',
    ),
    row(
      'cm-animation',
      'movie',
      'Animated Movies',
      _slice(results[7], 0, 30),
      genre: 'Animation',
    ),
    row(
      'cm-horror',
      'movie',
      'Horror',
      _slice(results[8], 0, 30),
      genre: 'Horror',
    ),
    row(
      'cm-romance',
      'movie',
      'Romance',
      _slice(results[9], 0, 30),
      genre: 'Romance',
    ),
    row(
      'cm-adventure',
      'movie',
      'Adventure',
      _slice(results[10], 0, 30),
      genre: 'Adventure',
    ),
    row(
      'cm-documentary',
      'movie',
      'Documentaries',
      _slice(results[11], 0, 30),
      genre: 'Documentary',
    ),
    row(
      'cm-mystery',
      'movie',
      'Mystery',
      _slice(results[12], 0, 30),
      genre: 'Mystery',
    ),
    row(
      'cm-fantasy',
      'movie',
      'Fantasy',
      _slice(results[13], 0, 30),
      genre: 'Fantasy',
    ),
    row(
      'cm-drama-tv',
      'series',
      'Drama Series',
      _slice(results[14], 0, 30),
      genre: 'Drama',
    ),
    row(
      'cm-comedy-tv',
      'series',
      'Comedy Series',
      _slice(results[15], 0, 30),
      genre: 'Comedy',
    ),
    row(
      'cm-crime-tv',
      'series',
      'Crime Series',
      _slice(results[16], 0, 30),
      genre: 'Crime',
    ),
  ].where((r) => r.items.isNotEmpty).toList();

  final hero = [
    if (movies.isNotEmpty) movies[0],
    if (series.isNotEmpty) series[0],
    if (results[2].isNotEmpty) results[2][0],
    if (results[3].isNotEmpty) results[3][0],
    if (results[4].isNotEmpty) results[4][0],
    if (results[5].isNotEmpty) results[5][0],
  ];

  return CinemetaHome(rows: rows, hero: hero);
}

/// Keyless search: query Cinemeta's movie + series catalogs, each capped at 12.
/// Ported from `searchCinemeta` — the two kinds stay separate (no cross-dedup).
Future<({List<MetaPreview> movies, List<MetaPreview> series})> searchCinemeta(
  AddonClient client,
  String query,
) async {
  final q = query.trim();
  if (q.length < 2) {
    return (movies: const <MetaPreview>[], series: const <MetaPreview>[]);
  }
  final results = await Future.wait([
    client.catalog(
      cinemetaBase,
      'movie',
      'top',
      extras: [CatalogExtra('search', q)],
    ),
    client.catalog(
      cinemetaBase,
      'series',
      'top',
      extras: [CatalogExtra('search', q)],
    ),
  ]);
  List<MetaPreview> kind(int i) =>
      (results[i].valueOrNull ?? const <MetaPreview>[]).take(12).toList();
  return (movies: kind(0), series: kind(1));
}
