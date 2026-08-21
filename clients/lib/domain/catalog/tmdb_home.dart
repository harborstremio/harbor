import '../addons/models.dart';
import 'catalog_row.dart';
import 'cinemeta.dart' show CinemetaHome;
import 'tmdb.dart';

typedef _Fetch = Future<List<MetaPreview>> Function(int page);

class _TmdbSpec {
  const _TmdbSpec(
    this.key,
    this.type,
    this.name,
    this.fetch, {
    this.noDedup = false,
  });

  final String key;
  final String type;
  final String name;
  final _Fetch fetch;
  final bool noDedup;
}

/// The eight fixed keyed-home row specs, ported 1:1 from `buildTmdbSpecs` in
/// `src/views/home/home-rows.ts`. `noDedup` rows (In Theaters / On The Air) show
/// even when their posters appear in another shelf.
List<_TmdbSpec> _tmdbSpecs(TmdbClient c, String region) => [
  _TmdbSpec(
    'tmdb-trending-movies',
    'movie',
    'Trending This Week',
    (p) => c.trending('movie', window: 'week', page: p),
  ),
  _TmdbSpec(
    'tmdb-now-playing',
    'movie',
    'In Theaters Now',
    (p) => c.movieRow('now_playing', region: region, page: p),
    noDedup: true,
  ),
  _TmdbSpec(
    'tmdb-popular-movies',
    'movie',
    'Popular Movies',
    (p) => c.movieRow('popular', region: region, page: p),
  ),
  _TmdbSpec(
    'tmdb-trending-tv',
    'series',
    'Trending Series',
    (p) => c.trending('tv', window: 'week', page: p),
  ),
  _TmdbSpec(
    'tmdb-on-the-air',
    'series',
    'On The Air',
    (p) => c.seriesRow('on_the_air', page: p),
    noDedup: true,
  ),
  _TmdbSpec(
    'tmdb-popular-tv',
    'series',
    'Popular Series',
    (p) => c.seriesRow('popular', page: p),
  ),
  _TmdbSpec(
    'tmdb-top-rated-tv',
    'series',
    'Top Rated Series',
    (p) => c.seriesRow('top_rated', page: p),
  ),
  _TmdbSpec(
    'tmdb-top-rated-movies',
    'movie',
    'Top Rated Movies',
    (p) => c.movieRow('top_rated', region: region, page: p),
  ),
];

/// Builds the keyed TMDB Home, ported 1:1 from `buildTmdbRows`: fetch page one
/// of all eight specs in parallel, keep the non-empty rows in spec order, and
/// seed the hero from the first poster of trending-movies, trending-tv,
/// now-playing, and on-the-air (in that order).
Future<CinemetaHome> fetchTmdbHome(
  TmdbClient client, {
  String region = 'US',
}) async {
  final specs = _tmdbSpecs(client, region);
  final firstPages = await Future.wait(
    specs.map((s) => s.fetch(1).catchError((_) => <MetaPreview>[])),
  );
  final rows = <CatalogRow>[];
  for (var i = 0; i < specs.length; i++) {
    final metas = firstPages[i];
    if (metas.isEmpty) continue;
    rows.add(
      CatalogRow(
        key: specs[i].key,
        title: specs[i].name,
        type: specs[i].type,
        id: specs[i].key,
        noDedup: specs[i].noDedup,
        items: metas,
      ),
    );
  }

  MetaPreview? firstOf(String key) {
    for (final r in rows) {
      if (r.key == key) return r.items.isNotEmpty ? r.items.first : null;
    }
    return null;
  }

  final hero = [
    firstOf('tmdb-trending-movies'),
    firstOf('tmdb-trending-tv'),
    firstOf('tmdb-now-playing'),
    firstOf('tmdb-on-the-air'),
  ].whereType<MetaPreview>().toList();

  return CinemetaHome(rows: rows, hero: hero);
}
