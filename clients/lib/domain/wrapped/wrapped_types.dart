/// The Harbor "Wrapped" year-in-review data model, ported 1:1 from
/// `src/lib/wrapped/types.ts`. Pure value types — the aggregation
/// ([aggregateWrapped]) and collection ([collectWatchEvents]) build these from
/// the viewer's local watch history and/or Trakt.
library;

/// What kind of thing was watched. Anime is split out from series so the
/// archetype and split can weight it separately.
enum WatchType { movie, series, anime }

/// Where the watch events came from — Trakt history, the local stores, or
/// nothing at all (the empty state).
enum WrappedSource { trakt, local, empty }

/// A single play: one title watched at one moment.
class WatchEvent {
  const WatchEvent({
    required this.id,
    required this.title,
    required this.type,
    required this.watchedAt,
    this.imdb,
  });

  final String id;
  final String title;
  final WatchType type;

  /// Epoch milliseconds of when it was watched.
  final int watchedAt;
  final String? imdb;
}

/// A most-watched title with its play count.
class TopTitle {
  const TopTitle({
    required this.title,
    required this.count,
    required this.id,
    required this.type,
    this.imdb,
  });

  final String title;
  final int count;
  final String id;
  final WatchType type;
  final String? imdb;
}

/// One day's play count for the year heatmap.
class HeatCell {
  const HeatCell({required this.date, required this.count});

  /// `YYYY-MM-DD` in local time.
  final String date;
  final int count;
}

/// The viewer's personality archetype for the year.
class WrappedArchetype {
  const WrappedArchetype({
    required this.id,
    required this.label,
    required this.blurb,
  });

  final String id;
  final String label;
  final String blurb;
}

/// The movie / series / anime play split.
class WatchSplit {
  const WatchSplit({this.movies = 0, this.series = 0, this.anime = 0});

  final int movies;
  final int series;
  final int anime;
}

/// The busiest single day.
class LongestBinge {
  const LongestBinge({required this.date, required this.count});

  final String date;
  final int count;
}

/// The fully aggregated year-in-review, matching the web `WrappedStats`.
class WrappedStats {
  const WrappedStats({
    required this.source,
    required this.year,
    required this.totalTitles,
    required this.totalPlays,
    required this.estimatedHours,
    required this.heatmap,
    required this.topTitles,
    required this.topGenres,
    required this.posters,
    required this.split,
    required this.firstPlay,
    required this.lastPlay,
    required this.longestBinge,
    required this.archetype,
  });

  final WrappedSource source;
  final int? year;
  final int totalTitles;
  final int totalPlays;
  final int estimatedHours;
  final List<HeatCell> heatmap;
  final List<TopTitle> topTitles;
  final List<({String genre, int count})> topGenres;
  final Map<String, String> posters;
  final WatchSplit split;
  final WatchEvent? firstPlay;
  final WatchEvent? lastPlay;
  final LongestBinge longestBinge;
  final WrappedArchetype archetype;

  /// The empty state — no plays found for the requested year.
  static const empty = WrappedStats(
    source: WrappedSource.empty,
    year: null,
    totalTitles: 0,
    totalPlays: 0,
    estimatedHours: 0,
    heatmap: [],
    topTitles: [],
    topGenres: [],
    posters: {},
    split: WatchSplit(),
    firstPlay: null,
    lastPlay: null,
    longestBinge: LongestBinge(date: '', count: 0),
    archetype: WrappedArchetype(
      id: 'balanced',
      label: 'The Well-Rounded',
      blurb: 'A little of everything, all year long.',
    ),
  );
}
