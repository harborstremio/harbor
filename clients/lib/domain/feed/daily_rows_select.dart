import 'dart:math' as math;

import '../addons/models.dart';
import '../catalog/tmdb.dart' show TmdbClient;
import '../discover/affinity.dart' show Affinity;
import '../library/playback_history.dart' show WatchedSet;
import '../settings/settings.dart';
import 'award_winners.dart';
import 'daily_rows_types.dart';
import 'feed_locale.dart' show LocaleWeights, localizeFloor;
import 'feed_rank.dart' show rankMetasByAffinity;

/// The row-length floor below which a discover row falls back to its relaxed
/// floor, ported from `MIN_ROW`.
const int _minRow = 8;

/// The max-normalized, floored-at-zero weight of [key] within [map] — a taste
/// strength in [0, 1]. Ported 1:1 from `normalizedAffinity`.
double normalizedAffinity<K>(Map<K, double> map, K key) {
  var max = 0.0;
  for (final v in map.values) {
    final a = v.abs();
    if (a > max) max = a;
  }
  if (max == 0) return 0;
  final w = map[key] ?? 0;
  return math.max(0.0, w / max);
}

/// Draws [n] values from [values] weighted by [weightFn] (negatives clamped to
/// zero), without replacement, using [rng]. When all remaining weights are zero
/// it falls back to a uniform pick. Ported 1:1 from
/// `weightedPickWithoutReplacement`.
List<T> weightedPickWithoutReplacement<T>(
  List<T> values,
  double Function(T value) weightFn,
  double Function() rng,
  int n,
) {
  final pool = [
    for (final value in values)
      (value: value, weight: math.max(0.0, weightFn(value))),
  ];
  final out = <T>[];
  while (out.length < n && pool.isNotEmpty) {
    var total = 0.0;
    for (final p in pool) {
      total += p.weight;
    }
    int idx;
    if (total <= 0) {
      idx = (rng() * pool.length).floor();
    } else {
      var r = rng() * total;
      idx = 0;
      for (var i = 0; i < pool.length; i++) {
        r -= pool[i].weight;
        if (r <= 0) {
          idx = i;
          break;
        }
      }
    }
    out.add(pool[idx].value);
    pool.removeAt(idx);
  }
  return out;
}

/// Drops titles with no poster, or that the user has voted on or recently
/// watched. Ported 1:1 from `applyExclusions` ([blocked] = the up/down-voted
/// ids, [watched] = the recently-played set).
List<MetaPreview> applyExclusions(
  List<MetaPreview> metas,
  Set<String> blocked,
  WatchedSet watched,
) => [
  for (final m in metas)
    if (m.poster != null &&
        !blocked.contains(m.id) &&
        !watched.contains(m.id, m.name))
      m,
];

Future<List<MetaPreview>> _runRow(
  TmdbClient tmdb,
  AwardWinnersResolver awards,
  ExpandedRow row,
  Map<String, String> floor,
  int page,
) {
  switch (row.endpoint) {
    case RowEndpoint.awards:
      return awards.page(page);
    case RowEndpoint.trending:
      return tmdb.trending(row.mediaType, page: page);
    case RowEndpoint.discover:
      return tmdb.discover(row.mediaType, {...floor, 'page': '$page'});
  }
}

/// Fetches a daily row, localizing its floor and excluding voted/watched titles;
/// discover rows that come back thin (under [_minRow]) merge in a relaxed-floor
/// second pass before ranking, while trending and awards rows return as-is.
/// Ported 1:1 from `fetchRowWithFallback`.
Future<List<MetaPreview>> fetchRowWithFallback({
  required TmdbClient tmdb,
  required AwardWinnersResolver awards,
  required ExpandedRow row,
  required int page,
  required Settings settings,
  required Affinity affinity,
  required LocaleWeights locale,
  required Set<String> blocked,
  required WatchedSet watched,
}) async {
  if (!tmdb.hasKey) return const [];
  final tmdbPage = (row.pageBase ?? 1) + (page - 1);
  final primaryFloor = localizeFloor(row.floorPrimary, settings, row.mediaType);
  final primary = applyExclusions(
    await _runRow(tmdb, awards, row, primaryFloor, tmdbPage),
    blocked,
    watched,
  );
  if (row.endpoint == RowEndpoint.awards) return primary;
  if (primary.length >= _minRow || row.endpoint == RowEndpoint.trending) {
    return rankMetasByAffinity(primary, affinity, locale);
  }
  final relaxed = applyExclusions(
    await _runRow(tmdb, awards, row, row.floorRelaxed, tmdbPage),
    blocked,
    watched,
  );
  final seen = {for (final m in primary) m.id};
  final merged = [...primary];
  for (final m in relaxed) {
    if (seen.add(m.id)) merged.add(m);
  }
  return rankMetasByAffinity(merged, affinity, locale);
}
