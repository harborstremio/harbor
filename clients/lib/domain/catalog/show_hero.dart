import '../addons/models.dart';
import 'show_catalog.dart' show isoDaysAgo;
import 'tmdb.dart';

const int _heroPoolTarget = 6;
const int _heroCandidateTarget = 240;

/// The low 32 bits of a 32-bit integer multiply, matching JS `Math.imul` (Dart's
/// 64-bit two's-complement multiply preserves the low bits through overflow).
int _imul(int a, int b) => (a * b) & 0xFFFFFFFF;

/// A mulberry32 PRNG returning doubles in [0, 1), ported 1:1 from `mulberry32`
/// (all arithmetic kept in the unsigned 32-bit domain).
double Function() mulberry32(int seed) {
  var s = seed & 0xFFFFFFFF;
  return () {
    s = (s + 0x6d2b79f5) & 0xFFFFFFFF;
    var t = s;
    t = _imul(t ^ (t >> 15), t | 1);
    t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF;
    return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296;
  };
}

/// A seeded Fisher-Yates shuffle, ported 1:1 from `seededShuffle`.
List<T> seededShuffle<T>(List<T> arr, int seed) {
  final out = [...arr];
  final rand = mulberry32(seed);
  for (var i = out.length - 1; i > 0; i--) {
    final j = (rand() * (i + 1)).floor();
    final tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/// The 1-based day of the year, ported from `dayOfYear` (`new Date(year,0,0)` is
/// Dec 31 of the previous year, so the offset is 1..365/366).
int dayOfYear(DateTime d) {
  final start = DateTime(d.year, 1, 0); // Dec 31 previous year.
  return (d.millisecondsSinceEpoch - start.millisecondsSinceEpoch) ~/ 86400000;
}

/// The time-of-day bucket, ported from `dayBucket` (note: the Shows buckets
/// differ from the mood buckets — morning starts at 5).
String dayBucket(DateTime now) {
  final h = now.hour;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

const Map<String, int> _bucketIndex = {
  'morning': 0,
  'afternoon': 1,
  'evening': 2,
  'night': 3,
};

/// The daily hero rotation seed, ported from `rotationSeed`.
int rotationSeed(DateTime now) =>
    dayOfYear(now) * 4 + _bucketIndex[dayBucket(now)]!;

Future<List<MetaPreview>> _fetchPool(TmdbClient c, DateTime now) async {
  final drama = '${kTvGenres['Drama']}';
  final comedy = '${kTvGenres['Comedy']}';
  final crime = '${kTvGenres['Crime']}';
  final sciFi = '${kTvGenres['Sci-Fi & Fantasy']}';
  final doc = '${kTvGenres['Documentary']}';

  Future<List<MetaPreview>> safe(Future<List<MetaPreview>> f) =>
      f.catchError((_) => <MetaPreview>[]);
  Future<List<MetaPreview>> disc(Map<String, String> p) =>
      safe(c.discover('tv', p));

  final sources = await Future.wait([
    safe(c.trending('tv', window: 'week', page: 1)),
    safe(c.seriesRow('popular', page: 1)),
    safe(c.seriesRow('on_the_air', page: 1)),
    safe(c.seriesRow('top_rated', page: 1)),
    disc({
      'vote_average.gte': '8.6',
      'vote_count.gte': '2000',
      'sort_by': 'vote_average.desc',
      'page': '1',
    }),
    disc({
      'with_genres': drama,
      'vote_average.gte': '8.2',
      'vote_count.gte': '1000',
      'first_air_date.gte': '2018-01-01',
      'sort_by': 'popularity.desc',
      'page': '1',
    }),
    disc({
      'with_genres': comedy,
      'vote_average.gte': '8.0',
      'vote_count.gte': '700',
      'sort_by': 'vote_average.desc',
      'page': '1',
    }),
    disc({
      'with_genres': crime,
      'vote_average.gte': '8.0',
      'vote_count.gte': '600',
      'sort_by': 'vote_count.desc',
      'page': '1',
    }),
    disc({
      'with_genres': sciFi,
      'vote_average.gte': '8.0',
      'vote_count.gte': '600',
      'sort_by': 'vote_count.desc',
      'page': '1',
    }),
    disc({
      'with_genres': doc,
      'vote_average.gte': '8.0',
      'vote_count.gte': '150',
      'sort_by': 'vote_average.desc',
      'page': '1',
    }),
    disc({
      'with_type': '2',
      'vote_average.gte': '7.8',
      'vote_count.gte': '300',
      'sort_by': 'vote_count.desc',
      'page': '1',
    }),
    disc({
      'first_air_date.gte': isoDaysAgo(90, now),
      'vote_count.gte': '60',
      'vote_average.gte': '7.4',
      'sort_by': 'popularity.desc',
      'page': '1',
    }),
    disc({
      'with_origin_country': 'GB',
      'vote_average.gte': '8.0',
      'vote_count.gte': '300',
      'sort_by': 'vote_average.desc',
      'page': '1',
    }),
    disc({
      'with_origin_country': 'KR',
      'vote_average.gte': '7.8',
      'vote_count.gte': '120',
      'sort_by': 'popularity.desc',
      'page': '1',
    }),
    disc({
      'with_networks': '49',
      'vote_count.gte': '250',
      'sort_by': 'vote_average.desc',
      'page': '1',
    }),
    disc({
      'with_networks': '213',
      'vote_average.gte': '7.8',
      'vote_count.gte': '400',
      'sort_by': 'vote_average.desc',
      'page': '1',
    }),
    disc({
      'vote_average.gte': '7.8',
      'vote_count.gte': '500',
      'first_air_date.lte': '2010-12-31',
      'sort_by': 'vote_count.desc',
      'page': '1',
    }),
  ]);

  final seen = <String>{};
  final pool = <MetaPreview>[];
  for (var i = 0; i < 24 && pool.length < _heroCandidateTarget; i++) {
    for (final list in sources) {
      if (i >= list.length) continue;
      final m = list[i];
      if (m.background == null || !seen.add(m.id)) continue;
      pool.add(m);
      if (pool.length >= _heroCandidateTarget) break;
    }
  }
  return pool;
}

/// Builds the Shows-catalog hero, ported 1:1 from `buildShowHero`: a large
/// backdrop-bearing candidate pool (round-robin de-dup across ~17 discover
/// sources), seed-shuffled by the daily rotation seed and cut to six. Keyless →
/// empty. (The session-persistent pool cache is superseded by provider caching.)
Future<List<MetaPreview>> buildShowHero(
  TmdbClient client, {
  DateTime Function() clock = DateTime.now,
}) async {
  if (!client.hasKey) return const [];
  final pool = await _fetchPool(client, clock());
  if (pool.isEmpty) return const [];
  final shuffled = seededShuffle(pool, rotationSeed(clock()));
  return shuffled.take(_heroPoolTarget).toList();
}
