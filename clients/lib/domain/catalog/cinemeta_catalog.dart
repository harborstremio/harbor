import '../addons/addon_client.dart';
import '../addons/addon_url.dart';
import '../addons/models.dart';
import 'catalog_row.dart';
import 'cinemeta.dart';
import 'kids_catalog.dart' show dropUnreleased, dropUnsafeCinemetaKids;
import 'movie_catalog.dart' show rotateDaily, kHeroPoolTarget;

const _movieGenres = [
  'Action',
  'Drama',
  'Comedy',
  'Sci-Fi',
  'Thriller',
  'Horror',
  'Romance',
  'Animation',
  'Adventure',
  'Crime',
  'Mystery',
  'Fantasy',
  'Documentary',
];

const _showGenres = [
  'Drama',
  'Comedy',
  'Crime',
  'Sci-Fi',
  'Thriller',
  'Mystery',
  'Action',
  'Animation',
  'Adventure',
  'Fantasy',
  'Documentary',
  'Romance',
  'Horror',
];

/// The Shows keyless hero size (`HERO_POOL_TARGET` in shows.tsx).
const _showHeroTarget = 6;

/// Cinemeta's `Top` catalog for [type] (`movie`/`series`), optionally scoped to
/// a [genre]. Ported from `topMovies`/`topSeries`; the public entry the keyless
/// feed pool uses.
Future<List<MetaPreview>> cinemetaTop(
  AddonClient client,
  String type, [
  String? genre,
]) => _top(client, type, genre);

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

List<MetaPreview> _slice30(List<MetaPreview> l) =>
    l.length > 30 ? l.sublist(0, 30) : l;

String _slug(String genre) =>
    genre.toLowerCase().replaceAll(RegExp('[^a-z]'), '');

/// The keyless Movies catalog, ported from the `movies.tsx` no-key branch:
/// Cinemeta `Top Movies` + a `Top {genre}` row for each of the 13 genres, with a
/// daily-rotated hero from the backdrop-bearing top movies.
Future<CinemetaHome> fetchCinemetaMovieCatalog(
  AddonClient client, {
  DateTime Function() clock = DateTime.now,
}) async {
  final results = await Future.wait([
    _top(client, 'movie'),
    for (final g in _movieGenres) _top(client, 'movie', g),
  ]);
  final top = results[0];
  final hero = rotateDaily(
    top.where((m) => m.background != null).toList(),
    kHeroPoolTarget,
    clock: clock,
  );
  final rows = <CatalogRow>[
    if (top.isNotEmpty)
      CatalogRow(
        key: 'cinemeta-top',
        title: 'Top Movies',
        type: 'movie',
        id: 'top',
        items: _slice30(top),
      ),
  ];
  for (var i = 0; i < _movieGenres.length; i++) {
    final list = results[i + 1];
    if (list.isEmpty) continue;
    rows.add(
      CatalogRow(
        key: 'cinemeta-genre-${_slug(_movieGenres[i])}',
        title: 'Top ${_movieGenres[i]}',
        type: 'movie',
        id: 'top',
        genre: _movieGenres[i],
        items: _slice30(list),
      ),
    );
  }
  return CinemetaHome(rows: rows, hero: hero);
}

/// The keyless Shows catalog, ported from the `shows.tsx` no-key branch: Cinemeta
/// `Top Series` + a `Top {genre}` row for each of the 13 genres, with the first
/// six backdrop-bearing top series as the hero.
Future<CinemetaHome> fetchCinemetaShowCatalog(AddonClient client) async {
  final results = await Future.wait([
    _top(client, 'series'),
    for (final g in _showGenres) _top(client, 'series', g),
  ]);
  final top = results[0];
  final hero = top
      .where((m) => m.background != null)
      .take(_showHeroTarget)
      .toList();
  final rows = <CatalogRow>[
    if (top.isNotEmpty)
      CatalogRow(
        key: 'cinemeta-top',
        title: 'Top Series',
        type: 'series',
        id: 'top',
        items: _slice30(top),
      ),
  ];
  for (var i = 0; i < _showGenres.length; i++) {
    final list = results[i + 1];
    if (list.isEmpty) continue;
    rows.add(
      CatalogRow(
        key: 'cinemeta-genre-${_slug(_showGenres[i])}',
        title: 'Top ${_showGenres[i]}',
        type: 'series',
        id: 'top',
        genre: _showGenres[i],
        items: _slice30(list),
      ),
    );
  }
  return CinemetaHome(rows: rows, hero: hero);
}

/// The keyless Kids catalog, ported from the `kids.tsx` no-key branch: Cinemeta
/// `Top Animation` and `Top Family` movies — the first five backdrop-bearing,
/// released animation titles as the hero, plus an Animated Movies and a Family
/// Movies row.
Future<CinemetaHome> fetchCinemetaKidsCatalog(AddonClient client) async {
  final results = await Future.wait([
    _top(client, 'movie', 'Animation'),
    _top(client, 'movie', 'Family'),
  ]);
  // Kid-safe allowlist on the keyless path (web
  // `.then(dropUnreleased).then(dropUnsafeCinemetaKids)`): the Cinemeta genre
  // catalog can't be scoped server-side, so an Animation title co-tagged
  // horror/thriller/crime must be dropped here before it reaches a child.
  final anim = dropUnsafeCinemetaKids(dropUnreleased(results[0]));
  final family = dropUnsafeCinemetaKids(dropUnreleased(results[1]));
  final heroPool = anim.where((m) => (m.background ?? '').isNotEmpty).toList();
  final hero = heroPool.length > 5 ? heroPool.sublist(0, 5) : heroPool;
  final rows = <CatalogRow>[
    if (anim.isNotEmpty)
      CatalogRow(
        key: 'cinemeta-animation',
        title: 'Animated Movies',
        type: 'movie',
        id: 'top',
        genre: 'Animation',
        items: _slice30(anim),
      ),
    if (family.isNotEmpty)
      CatalogRow(
        key: 'cinemeta-family',
        title: 'Family Movies',
        type: 'movie',
        id: 'top',
        genre: 'Family',
        items: _slice30(family),
      ),
  ];
  return CinemetaHome(rows: rows, hero: hero);
}
