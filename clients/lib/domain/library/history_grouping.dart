import 'history.dart';

/// A labelled bucket of history entries for the grouped grid. Ported from the
/// `{ label, items }` groups the web `groupByDate`/`sortedGroups` return.
class HistoryGroup {
  const HistoryGroup({required this.label, required this.items});
  final String label;
  final List<HistoryEntry> items;
}

/// The relative-time bucket ([rank] orders buckets, [label] names them) a
/// timestamp falls into, relative to [nowMs]. Ported 1:1 from `bucketFor`.
({int rank, String label}) bucketFor(int? ms, int nowMs) {
  if (ms == null) return (rank: 1000, label: 'No date');
  final days = (nowMs - ms) / 86400000;
  if (days < 1) return (rank: 0, label: 'Today');
  if (days < 7) return (rank: 1, label: 'This week');
  if (days < 30) return (rank: 2, label: 'This month');
  final year = DateTime.fromMillisecondsSinceEpoch(ms).year;
  final thisYear = DateTime.fromMillisecondsSinceEpoch(nowMs).year;
  return (rank: 10 + (thisYear - year), label: '$year');
}

/// A stable sort (Dart's `List.sort` is not stable for 32+ items, the web's
/// `Array.sort` is) — ties keep input order via a decorated index.
List<HistoryEntry> _stableSort(
  List<HistoryEntry> items,
  int Function(HistoryEntry a, HistoryEntry b) compare,
) {
  final indexed = [
    for (var i = 0; i < items.length; i++) (index: i, item: items[i]),
  ];
  indexed.sort((a, b) {
    final c = compare(a.item, b.item);
    return c != 0 ? c : a.index.compareTo(b.index);
  });
  return [for (final e in indexed) e.item];
}

/// Groups entries into relative-date buckets (Today / This week / This month /
/// year / No date), newest first within each and buckets ordered by recency.
/// Ported 1:1 from `groupByDate`.
List<HistoryGroup> groupByDate(List<HistoryEntry> entries, int nowMs) {
  final sorted = _stableSort(
    entries,
    (a, b) => (b.date ?? _negInf).compareTo(a.date ?? _negInf),
  );
  final buckets = <String, ({int rank, List<HistoryEntry> items})>{};
  for (final e in sorted) {
    final b = bucketFor(e.date, nowMs);
    final g = buckets.putIfAbsent(
      b.label,
      () => (rank: b.rank, items: <HistoryEntry>[]),
    );
    g.items.add(e);
  }
  final groups = buckets.entries.toList()
    ..sort((a, b) => a.value.rank.compareTo(b.value.rank));
  return [
    for (final g in groups) HistoryGroup(label: g.key, items: g.value.items),
  ];
}

/// The leading four-digit year of a meta's `releaseInfo`, else 0. Ports
/// `releaseYear`.
int _releaseYear(HistoryEntry e) {
  final info = e.meta.releaseInfo ?? '';
  final head = info.length >= 4 ? info.substring(0, 4) : info;
  return int.tryParse(head) ?? 0;
}

/// Groups entries by the active library sort: `title` → a single A–Z group,
/// `year` → a single by-year group (newest first), otherwise (`recent`) the
/// relative-date buckets. Ported 1:1 from `sortedGroups`.
List<HistoryGroup> sortedGroups(
  List<HistoryEntry> entries,
  String sort,
  int nowMs,
) {
  if (sort == 'title') {
    final items = _stableSort(
      entries,
      (a, b) => a.meta.name.toLowerCase().compareTo(b.meta.name.toLowerCase()),
    );
    return [HistoryGroup(label: 'A to Z', items: items)];
  }
  if (sort == 'year') {
    final items = _stableSort(
      entries,
      (a, b) => _releaseYear(b).compareTo(_releaseYear(a)),
    );
    return [HistoryGroup(label: 'By year', items: items)];
  }
  return groupByDate(entries, nowMs);
}

/// The grouped view the history grid renders, matching the web `groups` memo: a
/// non-`recent` sort → [sortedGroups]; `recent` + [flat] → a single "Everything"
/// group (newest first); otherwise the relative-date buckets ([groupByDate]).
List<HistoryGroup> historyGroups(
  List<HistoryEntry> entries, {
  required String sort,
  required bool flat,
  required int nowMs,
}) {
  if (sort != 'recent') return sortedGroups(entries, sort, nowMs);
  if (flat) {
    final items = _stableSort(
      entries,
      (a, b) => (b.date ?? _negInf).compareTo(a.date ?? _negInf),
    );
    return [HistoryGroup(label: 'Everything', items: items)];
  }
  return groupByDate(entries, nowMs);
}

/// Filters history entries by type (`all` / `movie` / `series`, an exact
/// `meta.type` match) and a case-insensitive title query. Ports `applyFilter`.
List<HistoryEntry> filterHistoryByType(
  List<HistoryEntry> entries,
  String type,
  String query,
) {
  final q = query.trim().toLowerCase();
  return [
    for (final e in entries)
      if ((type == 'all' || e.meta.type == type) &&
          (q.isEmpty || e.meta.name.toLowerCase().contains(q)))
        e,
  ];
}

/// The all/movie/series counts for the filter pills. Ports `countByType`.
({int all, int movie, int series}) countHistoryTypes(
  List<HistoryEntry> entries,
) => (
  all: entries.length,
  movie: entries.where((e) => e.meta.type == 'movie').length,
  series: entries.where((e) => e.meta.type == 'series').length,
);

/// A sentinel far below any real epoch-ms, standing in for the web's
/// `-Infinity` fallback so undated entries sort last.
const _negInf = -1 << 62;
