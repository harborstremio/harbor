import 'dart:math' as math;

import '../addons/models.dart';
import '../discover/affinity.dart';
import 'feed_locale.dart';
import 'feed_pool.dart' show FeedItem;

String? _decadeOf(String? year) {
  if (year == null || year.isEmpty) return null;
  final head = year.length >= 4 ? year.substring(0, 4) : year;
  final y = int.tryParse(head);
  if (y == null) return null;
  return '${(y ~/ 10) * 10}s';
}

double _maxAbs(Iterable<double> values) {
  var max = 0.0;
  for (final v in values) {
    final a = v.abs();
    if (a > max) max = a;
  }
  return max;
}

double _maxAbsOr1(Iterable<double> values) {
  final m = _maxAbs(values);
  return m == 0 ? 1 : m;
}

double _localeScore(MetaPreview meta, Affinity affinity, LocaleWeights locale) {
  if (locale.penalty == 0) return 0;
  final code = meta.originalLanguage;
  if (code == null || locale.codes.contains(code)) return 0;
  final langMax = _maxAbsOr1(affinity.languages.values);
  final liked = math.max(0.0, (affinity.languages[code] ?? 0) / langMax);
  return -locale.penalty * (1 - liked);
}

double _scoreItem(FeedItem item, Affinity affinity, LocaleWeights locale) {
  var s = _localeScore(item.meta, affinity, locale);
  if (affinity.totalEvents == 0) return s;
  final genreMax = _maxAbsOr1(affinity.genres.values);
  for (final g in item.meta.genres) {
    final w = affinity.genres[g] ?? 0;
    if (w != 0) s += (w / genreMax) * 4;
  }
  final decade = _decadeOf(item.meta.releaseInfo);
  if (decade != null) {
    final decadeMax = _maxAbsOr1(affinity.decades.values);
    final w = affinity.decades[decade] ?? 0;
    if (w != 0) s += (w / decadeMax) * 1.5;
  }
  return s;
}

/// Reorders feed items by taste and locale — genre/decade affinity boosts and an
/// off-locale penalty — breaking ties by original order. Returns the input
/// unchanged when there is nothing to rank by. Ported 1:1 from `rankByAffinity`.
List<FeedItem> rankByAffinity(
  List<FeedItem> items,
  Affinity affinity,
  LocaleWeights locale,
) {
  if (affinity.totalEvents < 1 && locale.penalty == 0) return items;
  final scored = [
    for (var i = 0; i < items.length; i++)
      (item: items[i], score: _scoreItem(items[i], affinity, locale), idx: i),
  ];
  scored.sort((a, b) {
    if (b.score != a.score) return b.score.compareTo(a.score);
    return a.idx.compareTo(b.idx);
  });
  return [for (final s in scored) s.item];
}

/// [rankByAffinity] over bare metas. Ported 1:1 from `rankMetasByAffinity`.
List<MetaPreview> rankMetasByAffinity(
  List<MetaPreview> metas,
  Affinity affinity,
  LocaleWeights locale,
) {
  final wrapped = [
    for (final m in metas) FeedItem(meta: m, tag: '', category: ''),
  ];
  return [for (final w in rankByAffinity(wrapped, affinity, locale)) w.meta];
}
