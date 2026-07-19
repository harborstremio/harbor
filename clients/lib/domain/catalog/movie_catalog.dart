import '../addons/models.dart';
import '../feed/moods.dart';
import 'catalog_row.dart';
import 'cinemeta.dart' show CinemetaHome;
import 'tmdb.dart';

/// The hero pool target, ported from `HERO_POOL_TARGET`.
const int kHeroPoolTarget = 5;

/// The watch-history title key (lowercase, `(YYYY)` + non-alphanumeric stripped),
/// ported from `watchTitleKey`.
String watchTitleKey(String? name) {
  if (name == null || name.isEmpty) return '';
  return name
      .toLowerCase()
      .replaceAll(RegExp(r'\(\d{4}\)'), '')
      .replaceAll(RegExp(r'[^a-z0-9]+'), '');
}

/// Deterministically rotates a pool day-by-day, ported 1:1 from `rotateDaily`:
/// prefer titles not in [seenIds]/[seenTitles] (falling back to the full pool if
/// fewer than [n] remain), then pick [n] via the day-indexed stride.
List<MetaPreview> rotateDaily(
  List<MetaPreview> pool,
  int n, {
  Set<String> seenIds = const {},
  Set<String> seenTitles = const {},
  DateTime Function() clock = DateTime.now,
}) {
  final unseen = pool
      .where(
        (m) =>
            !seenIds.contains(m.id) &&
            !seenTitles.contains(watchTitleKey(m.name)),
      )
      .toList();
  final base = unseen.length >= n ? unseen : pool;
  if (base.isEmpty) return const [];
  final day = clock().millisecondsSinceEpoch ~/ 86400000;
  final out = <MetaPreview>[];
  final used = <int>{};
  while (out.length < n && used.length < base.length) {
    var j = (day * 13 + out.length * 17) % base.length;
    while (used.contains(j)) {
      j = (j + 1) % base.length;
    }
    used.add(j);
    out.add(base[j]);
  }
  return out;
}

/// Builds the Movies-catalog hero, ported 1:1 from `buildMovieHero`: prestige +
/// top-rated + modern discover pools, de-duped (backdrop required) in a fixed
/// order, then daily-rotated to [kHeroPoolTarget].
Future<List<MetaPreview>> buildMovieHero(
  TmdbClient client, {
  Set<String> seenIds = const {},
  Set<String> seenTitles = const {},
  DateTime Function() clock = DateTime.now,
}) async {
  Future<List<MetaPreview>> guard(Future<List<MetaPreview>> f) =>
      f.catchError((_) => <MetaPreview>[]);
  final results = await Future.wait([
    guard(client.movieRow('top_rated', region: 'US', page: 1)),
    guard(client.movieRow('top_rated', region: 'US', page: 2)),
    guard(
      client.discover('movie', {
        'vote_average.gte': '8.0',
        'vote_count.gte': '4000',
        'sort_by': 'vote_average.desc',
        'page': '1',
      }),
    ),
    guard(
      client.discover('movie', {
        'vote_average.gte': '8.0',
        'vote_count.gte': '4000',
        'sort_by': 'vote_average.desc',
        'page': '2',
      }),
    ),
    guard(
      client.discover('movie', {
        'primary_release_date.gte': '2016-01-01',
        'vote_average.gte': '7.8',
        'vote_count.gte': '2500',
        'sort_by': 'vote_average.desc',
        'page': '1',
      }),
    ),
  ]);
  final topA = results[0];
  final topB = results[1];
  final prestigeA = results[2];
  final prestigeB = results[3];
  final modern = results[4];

  final pool = <MetaPreview>[];
  final ids = <String>{};
  for (final list in [prestigeA, topA, modern, prestigeB, topB]) {
    for (final m in list) {
      if (m.background == null || !ids.add(m.id)) continue;
      pool.add(m);
    }
  }
  return rotateDaily(
    pool,
    kHeroPoolTarget,
    seenIds: seenIds,
    seenTitles: seenTitles,
    clock: clock,
  );
}

/// The `Quick Watches Under 90` discover row, ported from `fetchUnderNinety`.
Future<List<MetaPreview>> fetchUnderNinety(TmdbClient client, int page) {
  if (!client.hasKey) return Future.value(const []);
  return client.discover('movie', {
    'with_runtime.lte': '90',
    'with_runtime.gte': '70',
    'vote_average.gte': '7.0',
    'vote_count.gte': '300',
    'sort_by': 'vote_average.desc',
    'page': '$page',
  });
}

typedef _Fetch = Future<List<MetaPreview>> Function(int page);

class _MovieSpec {
  const _MovieSpec(this.key, this.title, this.fetch);
  final String key;
  final String title;
  final _Fetch fetch;
}

List<_MovieSpec> _movieSpecs(TmdbClient c, String region, DateTime now) {
  _Fetch discover(Map<String, String> params) =>
      (p) => c.discover('movie', {...params, 'page': '$p'});
  final docGenre = '${kMovieGenres['Documentary']}';
  return [
    _MovieSpec(
      'trending',
      'Trending This Week',
      (p) => c.trending('movie', window: 'week', page: p),
    ),
    _MovieSpec(
      'in-theaters',
      'In Theaters Now',
      (p) => c.movieRow('now_playing', region: region, page: p),
    ),
    for (final m in pickMoodSpecs(now))
      _MovieSpec(m.id, m.title, discover(m.params)),
    _MovieSpec(
      'critics-acclaim',
      "Critics' Picks",
      discover({
        'primary_release_date.gte': '2015-01-01',
        'vote_average.gte': '7.6',
        'vote_count.gte': '2500',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _MovieSpec(
      'all-time-greats',
      'All-Time Greats',
      (p) => c.movieRow('top_rated', region: region, page: p),
    ),
    _MovieSpec(
      'hidden-gems',
      'Hidden Gems',
      discover({
        'vote_average.gte': '7.6',
        'vote_count.gte': '200',
        'vote_count.lte': '1500',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _MovieSpec(
      'under-90',
      'Quick Watches Under 90',
      (p) => fetchUnderNinety(c, p),
    ),
    _MovieSpec(
      'coming-soon',
      'Coming to Theaters',
      (p) => c.movieRow('upcoming', region: region, page: p),
    ),
    _MovieSpec(
      'decade-2010',
      'Defining the 2010s',
      discover({
        'primary_release_date.gte': '2010-01-01',
        'primary_release_date.lte': '2019-12-31',
        'vote_average.gte': '7.6',
        'vote_count.gte': '2000',
        'sort_by': 'vote_count.desc',
      }),
    ),
    _MovieSpec(
      'decade-90',
      'Essential 90s',
      discover({
        'primary_release_date.gte': '1990-01-01',
        'primary_release_date.lte': '1999-12-31',
        'vote_average.gte': '7.6',
        'vote_count.gte': '1000',
        'sort_by': 'popularity.desc',
      }),
    ),
    _MovieSpec(
      'decade-80',
      '80s Classics',
      discover({
        'primary_release_date.gte': '1980-01-01',
        'primary_release_date.lte': '1989-12-31',
        'vote_average.gte': '7.4',
        'vote_count.gte': '500',
        'sort_by': 'popularity.desc',
      }),
    ),
    _MovieSpec(
      'decade-70',
      '70s Auteurs',
      discover({
        'primary_release_date.gte': '1970-01-01',
        'primary_release_date.lte': '1979-12-31',
        'vote_average.gte': '7.4',
        'vote_count.gte': '300',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _MovieSpec(
      'lang-jp',
      'Japanese Cinema',
      discover({
        'with_original_language': 'ja',
        'vote_average.gte': '7.5',
        'vote_count.gte': '200',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _MovieSpec(
      'lang-kr',
      'Korean Cinema',
      discover({
        'with_original_language': 'ko',
        'vote_average.gte': '7.5',
        'vote_count.gte': '200',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _MovieSpec(
      'lang-fr',
      'French Cinema',
      discover({
        'with_original_language': 'fr',
        'vote_average.gte': '7.3',
        'vote_count.gte': '200',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _MovieSpec(
      'doc',
      'Documentary Spotlight',
      discover({
        'with_genres': docGenre,
        'vote_average.gte': '7.5',
        'vote_count.gte': '200',
        'sort_by': 'vote_average.desc',
      }),
    ),
  ];
}

/// Builds the full keyed Movies catalog (curated rows + hero), ported from
/// `movies.tsx`'s build: fetches page one of every [_movieSpecs] row in parallel
/// (empties dropped) plus [buildMovieHero]. Keyless → empty.
Future<CinemetaHome> fetchMovieCatalog(
  TmdbClient client, {
  String region = 'US',
  Set<String> seenIds = const {},
  Set<String> seenTitles = const {},
  DateTime Function() clock = DateTime.now,
}) async {
  if (!client.hasKey) return const CinemetaHome(rows: [], hero: []);
  final specs = _movieSpecs(client, region, clock());
  final heroFuture = buildMovieHero(
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
    if (firstPages[i].isEmpty) continue;
    rows.add(
      CatalogRow(
        key: specs[i].key,
        title: specs[i].title,
        type: 'movie',
        id: specs[i].key,
        items: firstPages[i],
      ),
    );
  }
  return CinemetaHome(rows: rows, hero: await heroFuture);
}
