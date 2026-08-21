import '../addons/models.dart';
import 'catalog_row.dart';
import 'cinemeta.dart' show CinemetaHome;
import 'tmdb.dart';

/// `YYYY-MM-DD` for `days` before now (UTC), ported from `isoDaysAgo`.
String isoDaysAgo(int days, DateTime now) =>
    DateTime.fromMillisecondsSinceEpoch(
      now.millisecondsSinceEpoch - days * 86400000,
      isUtc: true,
    ).toIso8601String().substring(0, 10);

typedef _Fetch = Future<List<MetaPreview>> Function(int page);

class _ShowSpec {
  const _ShowSpec(this.key, this.title, this.fetch);
  final String key;
  final String title;
  final _Fetch fetch;
}

int _tv(String name) => kTvGenres[name]!;

List<_ShowSpec> _showSpecs(TmdbClient c, DateTime now) {
  _Fetch discover(Map<String, String> params) =>
      (p) => c.discover('tv', {...params, 'page': '$p'});
  return [
    _ShowSpec(
      'trending',
      'Trending This Week',
      (p) => c.trending('tv', window: 'week', page: p),
    ),
    _ShowSpec(
      'on-the-air',
      'On Tonight',
      (p) => c.seriesRow('on_the_air', page: p),
    ),
    _ShowSpec(
      'fresh',
      'Premiered This Month',
      discover({
        'first_air_date.gte': isoDaysAgo(45, now),
        'first_air_date.lte': isoDaysAgo(0, now),
        'vote_count.gte': '20',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'net-hbo',
      'From HBO',
      discover({
        'with_networks': '49',
        'vote_count.gte': '200',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'net-netflix',
      'Netflix Originals',
      discover({
        'with_networks': '213',
        'vote_count.gte': '300',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'net-apple',
      'Apple TV+',
      discover({
        'with_networks': '2552',
        'vote_count.gte': '100',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'net-amc',
      'AMC',
      discover({
        'with_networks': '174',
        'vote_count.gte': '200',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'net-fx',
      'FX',
      discover({
        'with_networks': '88',
        'vote_count.gte': '200',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'net-disney',
      'Disney+ Originals',
      discover({
        'with_networks': '2739',
        'vote_count.gte': '100',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'net-amazon',
      'Prime Video',
      discover({
        'with_networks': '1024',
        'vote_count.gte': '200',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'limited',
      'Limited Series & Miniseries',
      discover({
        'with_type': '2',
        'vote_average.gte': '7.5',
        'vote_count.gte': '300',
        'sort_by': 'vote_count.desc',
      }),
    ),
    _ShowSpec(
      'prestige-drama',
      'Prestige Drama',
      discover({
        'with_genres': '${_tv('Drama')}',
        'vote_average.gte': '8.0',
        'vote_count.gte': '1000',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _ShowSpec(
      'comedy',
      'Comedy Series',
      discover({
        'with_genres': '${_tv('Comedy')}',
        'vote_average.gte': '7.6',
        'vote_count.gte': '500',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'crime',
      'Crime & Mystery',
      discover({
        'with_genres': '${_tv('Crime')}',
        'vote_average.gte': '7.5',
        'vote_count.gte': '500',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _ShowSpec(
      'scifi',
      'Sci-Fi & Fantasy',
      discover({
        'with_genres': '${_tv('Sci-Fi & Fantasy')}',
        'vote_average.gte': '7.5',
        'vote_count.gte': '500',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'doc-series',
      'Documentary Series',
      discover({
        'with_genres': '${_tv('Documentary')}',
        'vote_average.gte': '7.5',
        'vote_count.gte': '100',
        'sort_by': 'vote_average.desc',
      }),
    ),
    _ShowSpec(
      'all-time',
      'All-Time Great Series',
      (p) => c.seriesRow('top_rated', page: p),
    ),
    _ShowSpec(
      'long-runners',
      'Iconic Long-Runners',
      discover({
        'vote_average.gte': '7.8',
        'vote_count.gte': '500',
        'first_air_date.lte': '2010-12-31',
        'sort_by': 'vote_count.desc',
      }),
    ),
    _ShowSpec(
      'kdrama',
      'K-Drama',
      discover({
        'with_origin_country': 'KR',
        'vote_average.gte': '7.5',
        'vote_count.gte': '100',
        'sort_by': 'popularity.desc',
      }),
    ),
    _ShowSpec(
      'british',
      'British Television',
      discover({
        'with_origin_country': 'GB',
        'vote_average.gte': '7.5',
        'vote_count.gte': '300',
        'sort_by': 'vote_average.desc',
      }),
    ),
  ];
}

/// Builds the full keyed Shows catalog (curated network/genre rows), ported from
/// `show-specs.ts`: page one of every row fetched in parallel, empties dropped.
/// The hero is added by `buildShowHero` (hero-curation). Keyless → empty.
Future<CinemetaHome> fetchShowCatalog(
  TmdbClient client, {
  DateTime Function() clock = DateTime.now,
}) async {
  if (!client.hasKey) return const CinemetaHome(rows: [], hero: []);
  final specs = _showSpecs(client, clock());
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
        type: 'series',
        id: specs[i].key,
        items: firstPages[i],
      ),
    );
  }
  return CinemetaHome(rows: rows, hero: const []);
}
