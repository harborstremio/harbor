import '../addons/models.dart';
import 'catalog_row.dart';
import 'cinemeta.dart' show CinemetaHome;
import 'movie_catalog.dart' show rotateDaily;
import 'tmdb.dart';

/// The kid-safe TMDB discover constraints for movies, ported 1:1 from
/// `KID_MOVIE`: US certification capped at PG, horror/thriller dropped, and no
/// adult results.
const Map<String, String> _kidMovie = {
  'certification_country': 'US',
  'certification.lte': 'PG',
  'without_genres': '27,53',
  'include_adult': 'false',
};

/// The kid-safe TMDB discover constraints for TV, ported from `KID_TV`.
const Map<String, String> _kidTv = {
  'without_genres': '27,53',
  'include_adult': 'false',
};

/// Drops titles that have not been released yet, ported 1:1 from
/// `dropUnreleased`: keep a title whose [MetaPreview.releaseDate] is on or
/// before today, or (absent that) whose [MetaPreview.releaseInfo] year is not
/// in the future (an unparseable year is kept).
List<MetaPreview> dropUnreleased(
  List<MetaPreview> metas, {
  DateTime Function() clock = DateTime.now,
}) {
  final now = clock().toUtc();
  final today = now.toIso8601String().substring(0, 10);
  final yearNow = now.year;
  return metas.where((m) {
    final rd = m.releaseDate;
    if (rd != null && rd.isNotEmpty) {
      final head = rd.length >= 10 ? rd.substring(0, 10) : rd;
      return head.compareTo(today) <= 0;
    }
    final ri = m.releaseInfo;
    final year = (ri != null && ri.length >= 4)
        ? int.tryParse(ri.substring(0, 4))
        : null;
    return year == null || year <= yearNow;
  }).toList();
}

/// Genres that disqualify an otherwise kid-tagged Cinemeta title. Ported from
/// web `UNSAFE_CINEMETA_GENRE`.
final _unsafeCinemetaGenre = RegExp(
  r'^(action|biography|crime|history|horror|romance|thriller|war)$',
  caseSensitive: false,
);

/// Whether a catalog meta is adult-flagged — TMDB's top-level `adult` or a
/// Stremio addon's `behaviorHints.adult` (MetaPreview exposes neither getter).
bool _isAdultMeta(MetaPreview m) {
  if (m.json['adult'] == true) return true;
  final bh = m.json['behaviorHints'];
  return bh is Map && bh['adult'] == true;
}

/// Drops adult-flagged titles. Ported from `dropAdultContent`.
List<MetaPreview> dropAdultContent(List<MetaPreview> metas) =>
    [for (final m in metas) if (!_isAdultMeta(m)) m];

/// The keyless Cinemeta kid-safe allowlist — ported 1:1 from
/// `dropUnsafeCinemetaKids`. Keeps only non-adult titles with no unsafe genre
/// that are Family (or Animation *and* Comedy), so an animated title co-tagged
/// horror/thriller/crime/etc never reaches a child on the keyless (no-TMDB-key)
/// path, where the source catalog can't be genre-scoped server-side.
List<MetaPreview> dropUnsafeCinemetaKids(List<MetaPreview> metas) => [
  for (final m in dropAdultContent(metas))
    if (_isKidSafeCinemeta(m.genres)) m,
];

bool _isKidSafeCinemeta(List<String> genres) {
  for (final g in genres) {
    if (_unsafeCinemetaGenre.hasMatch(g.trim())) return false;
  }
  return genres.contains('Family') ||
      (genres.contains('Animation') && genres.contains('Comedy'));
}

/// The Kids rows actually shown, ported from the `restRows` memo: each row's
/// titles are de-duped against the [hero] and the earlier rows and re-filtered
/// of unreleased entries, and a row is dropped when fewer than four survive.
List<CatalogRow> kidsVisibleRows(
  List<MetaPreview> hero,
  List<CatalogRow> rows,
) {
  final seen = <String>{for (final m in hero) m.id};
  final out = <CatalogRow>[];
  for (final r in rows) {
    final metas = <MetaPreview>[];
    for (final m in dropUnreleased(r.items)) {
      if (seen.add(m.id)) metas.add(m);
    }
    if (metas.length >= 4) out.add(r.copyWith(items: metas));
  }
  return out;
}

/// Builds the Kids-catalog hero, ported 1:1 from `buildKidsHero`: top-rated
/// family films, popular animation, and popular family films, de-duped (a
/// backdrop is required) in a fixed order, then daily-rotated to ten.
Future<List<MetaPreview>> buildKidsHero(
  TmdbClient client, {
  Set<String> seenIds = const {},
  Set<String> seenTitles = const {},
  DateTime Function() clock = DateTime.now,
}) async {
  Future<List<MetaPreview>> guard(Future<List<MetaPreview>> f) =>
      f.catchError((_) => <MetaPreview>[]);
  final results = await Future.wait([
    guard(
      client.discover('movie', {
        'with_genres': '10751',
        'vote_average.gte': '7.0',
        'vote_count.gte': '800',
        'sort_by': 'vote_average.desc',
        'page': '1',
        ..._kidMovie,
      }),
    ),
    guard(
      client.discover('movie', {
        'with_genres': '16',
        'vote_count.gte': '500',
        'sort_by': 'popularity.desc',
        'page': '1',
        ..._kidMovie,
      }),
    ),
    guard(
      client.discover('movie', {
        'with_genres': '10751',
        'vote_count.gte': '400',
        'sort_by': 'popularity.desc',
        'page': '1',
        ..._kidMovie,
      }),
    ),
  ]);
  final pool = <MetaPreview>[];
  final ids = <String>{};
  for (final list in results) {
    for (final m in list) {
      if (m.background == null || !ids.add(m.id)) continue;
      pool.add(m);
    }
  }
  return rotateDaily(
    pool,
    10,
    seenIds: seenIds,
    seenTitles: seenTitles,
    clock: clock,
  );
}

typedef _Fetch = Future<List<MetaPreview>> Function(int page);

class _KidsSpec {
  const _KidsSpec(this.key, this.title, this.type, this.fetch);
  final String key;
  final String title;

  /// The app content type of the row: `movie` or `series`.
  final String type;
  final _Fetch fetch;
}

List<_KidsSpec> _kidsSpecs(TmdbClient c) {
  _Fetch movie(Map<String, String> params) =>
      (p) => c.discover('movie', {...params, 'page': '$p'});
  _Fetch tv(Map<String, String> params) =>
      (p) => c.discover('tv', {...params, 'page': '$p'});
  return [
    _KidsSpec(
      'trending-kids',
      'Trending for Kids',
      'movie',
      movie({
        'with_genres': '10751,16',
        'vote_count.gte': '200',
        'sort_by': 'popularity.desc',
        ..._kidMovie,
      }),
    ),
    _KidsSpec(
      'animated-movies',
      'Animated Movies',
      'movie',
      movie({
        'with_genres': '16',
        'vote_count.gte': '150',
        'sort_by': 'popularity.desc',
        ..._kidMovie,
      }),
    ),
    _KidsSpec(
      'g-pg-picks',
      'G and PG Picks',
      'movie',
      movie({
        'vote_count.gte': '100',
        'sort_by': 'popularity.desc',
        ..._kidMovie,
        // Family only, with animation folded into the excluded genres so this
        // row is live-action — the web override order (spread then override).
        'with_genres': '10751',
        'without_genres': '16,27,53',
      }),
    ),
    _KidsSpec(
      'kids-tv',
      'Kids TV',
      'series',
      tv({'with_genres': '10762', 'sort_by': 'popularity.desc', ..._kidTv}),
    ),
    _KidsSpec(
      'family-tv',
      'Family TV Nights',
      'series',
      tv({'with_genres': '10751', 'sort_by': 'popularity.desc', ..._kidTv}),
    ),
    _KidsSpec(
      'adventures-kids',
      'Adventures',
      'movie',
      movie({
        'with_genres': '12,10751',
        'vote_count.gte': '120',
        'sort_by': 'popularity.desc',
        ..._kidMovie,
      }),
    ),
    _KidsSpec(
      'sing-along-kids',
      'Sing-Along and Musicals',
      'movie',
      movie({
        'with_genres': '10402,10751',
        'vote_count.gte': '50',
        'sort_by': 'popularity.desc',
        ..._kidMovie,
      }),
    ),
  ];
}

/// Fetches the full Kids catalog — the hero plus the seven kid-safe rows — from
/// TMDB discover, mirroring `fetchMovieCatalog`. Every row and the hero are run
/// through [dropUnreleased] so nothing unreleased surfaces to a child; empty
/// rows are dropped. Returns an empty catalog when no TMDB key is configured
/// (the keyless path, no fake data).
Future<CinemetaHome> fetchKidsCatalog(
  TmdbClient client, {
  Set<String> seenIds = const {},
  Set<String> seenTitles = const {},
  DateTime Function() clock = DateTime.now,
}) async {
  if (!client.hasKey) return const CinemetaHome(rows: [], hero: []);
  final specs = _kidsSpecs(client);
  final heroFuture = buildKidsHero(
    client,
    seenIds: seenIds,
    seenTitles: seenTitles,
    clock: clock,
  );
  final firstPages = await Future.wait(
    specs.map((s) => s.fetch(1).catchError((_) => <MetaPreview>[])),
  );
  final rows = <CatalogRow>[];
  for (var i = 0; i < specs.length; i++) {
    final items = dropUnreleased(firstPages[i], clock: clock);
    if (items.isEmpty) continue;
    rows.add(
      CatalogRow(
        key: specs[i].key,
        title: specs[i].title,
        type: specs[i].type,
        id: specs[i].key,
        items: items,
      ),
    );
  }
  return CinemetaHome(
    rows: rows,
    hero: dropUnreleased(await heroFuture, clock: clock),
  );
}
