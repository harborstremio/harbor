import 'wrapped_archetype.dart';
import 'wrapped_types.dart';

/// Average movie / episode lengths used to estimate hours (web parity).
const _movieMin = 115;
const _episodeMin = 42;

/// `YYYY-MM-DD` in local time, matching the web `dayKey` (which uses the local
/// `Date` getters).
String _dayKey(int ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms);
  final mm = d.month.toString().padLeft(2, '0');
  final dd = d.day.toString().padLeft(2, '0');
  return '${d.year}-$mm-$dd';
}

/// Aggregates a list of [WatchEvent]s into the year-in-review [WrappedStats].
/// Ported 1:1 from `src/lib/wrapped/aggregate.ts`: filters to [year] (when
/// given, by the event's local year), counts per-title and per-day, estimates
/// hours from the movie/episode averages, and derives the archetype.
WrappedStats aggregateWrapped(
  List<WatchEvent> events,
  WrappedSource source,
  int? year,
) {
  final filtered = year != null
      ? events
            .where(
              (e) =>
                  DateTime.fromMillisecondsSinceEpoch(e.watchedAt).year == year,
            )
            .toList()
      : events;
  final sorted = [...filtered]..sort((a, b) => a.watchedAt.compareTo(b.watchedAt));

  // A LinkedHashMap preserves first-seen order, matching JS Map iteration so the
  // top-titles tie-break is stable against the web.
  final byId = <String, TopTitle>{};
  final byDay = <String, int>{};
  var movies = 0, series = 0, anime = 0;
  var hours = 0.0;

  for (final e in sorted) {
    final t = byId[e.id];
    if (t != null) {
      byId[e.id] = TopTitle(
        title: t.title,
        count: t.count + 1,
        id: t.id,
        type: t.type,
        imdb: t.imdb,
      );
    } else {
      byId[e.id] = TopTitle(
        title: e.title,
        count: 1,
        id: e.id,
        type: e.type,
        imdb: e.imdb,
      );
    }
    final dk = _dayKey(e.watchedAt);
    byDay[dk] = (byDay[dk] ?? 0) + 1;
    if (e.type == WatchType.movie) {
      movies += 1;
      hours += _movieMin / 60;
    } else {
      if (e.type == WatchType.anime) {
        anime += 1;
      } else {
        series += 1;
      }
      hours += _episodeMin / 60;
    }
  }

  final heatmap = byDay.entries
      .map((e) => HeatCell(date: e.key, count: e.value))
      .toList();
  var longestBinge = const LongestBinge(date: '', count: 0);
  for (final e in byDay.entries) {
    if (e.value > longestBinge.count) {
      longestBinge = LongestBinge(date: e.key, count: e.value);
    }
  }

  // JS Array.sort is stable, Dart's List.sort is not — decorate with the
  // first-seen index so count ties keep insertion order (web parity).
  final ordered = byId.values.toList(); // LinkedHashMap → insertion order
  final indexed = [for (var i = 0; i < ordered.length; i++) (i, ordered[i])];
  indexed.sort((a, b) {
    final c = b.$2.count.compareTo(a.$2.count);
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });
  final topTitles = [for (final e in indexed) e.$2];
  final split = WatchSplit(movies: movies, series: series, anime: anime);

  return WrappedStats(
    source: source,
    year: year,
    totalTitles: byId.length,
    totalPlays: sorted.length,
    estimatedHours: hours.round(),
    heatmap: heatmap,
    topTitles: topTitles.take(10).toList(),
    topGenres: const [],
    posters: const {},
    split: split,
    firstPlay: sorted.isNotEmpty ? sorted.first : null,
    lastPlay: sorted.isNotEmpty ? sorted.last : null,
    longestBinge: longestBinge,
    archetype: deriveArchetype(
      split: split,
      longestBinge: longestBinge,
      totalTitles: byId.length,
    ),
  );
}
