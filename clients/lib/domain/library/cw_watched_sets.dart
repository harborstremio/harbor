/// An immutable snapshot of every "watched" signal the Continue-Watching advance
/// engine consults, normalized into one `(id, season, episode)` space. Ported
/// from the union of stores the web `watchedPredicate` reads (trakt/simkl/anilist
/// + per-episode progress); assembling it in one value object is what keeps the
/// engine ([cw_advance.dart]) pure and unit-testable — tests inject a populated
/// snapshot, production wires it from the real providers.
///
/// Key formats:
///  * [manualKeys] / [playbackKeys]: `'<id>|<season>|<episode>'`.
///  * [traktKeys]: `'imdb:<tt…>:<s>:<e>'` and/or `'tmdb:<n>:<s>:<e>'`.
///  * [anilistKeys] / [malKeys]: `id → {'<s>:<e>'}`.
///  * [completedSeriesIds]: ids a tracker marks as the whole series completed
///    (the Simkl `completed` fallback — every episode counts as watched).
class CwWatchedSets {
  const CwWatchedSets({
    this.manualKeys = const {},
    this.manualUnwatchedKeys = const {},
    this.playbackKeys = const {},
    this.traktKeys = const {},
    this.anilistKeys = const {},
    this.malKeys = const {},
    this.completedSeriesIds = const {},
  });

  final Set<String> manualKeys;

  /// Episodes the viewer EXPLICITLY marked unwatched (`harbor.manualunwatched.v1`).
  /// An explicit unwatched overrides every tracker/progress source, mirroring web
  /// `getEpisodeProgress`, which early-returns `watched:false` on `manual===false`.
  final Set<String> manualUnwatchedKeys;
  final Set<String> playbackKeys;
  final Set<String> traktKeys;
  final Map<String, Set<String>> anilistKeys;
  final Map<String, Set<String>> malKeys;
  final Set<String> completedSeriesIds;

  static const empty = CwWatchedSets();

  /// The TMDB numeric id of a `tmdb:tv:<n>` id, else null.
  static String? _tmdbId(String id) {
    if (!id.startsWith('tmdb:tv:')) return null;
    final parts = id.split(':');
    return parts.length > 2 ? parts[2] : null;
  }

  /// Whether a specific episode of [id] is marked watched by ANY per-episode
  /// source. Mirrors the web `getEpisodeProgress(...).watched` union — with the
  /// explicit-unwatched override winning first (web's `manual===false` early
  /// return).
  bool episodeWatched(String id, int season, int episode) {
    final k = '$id|$season|$episode';
    // Explicit "unwatched" beats every watched signal (the user's choice).
    if (manualUnwatchedKeys.contains(k)) return false;
    if (manualKeys.contains(k) || playbackKeys.contains(k)) return true;
    if (id.startsWith('tt') &&
        traktKeys.contains('imdb:$id:$season:$episode')) {
      return true;
    }
    // NOTE: this tmdb:tv Trakt key match is a deliberate superset of web (whose
    // watchedPredicate only builds imdb keys, so it never advances a tmdb:tv
    // title via Trakt) — a cross-device tmdb:tv finish SHOULD advance the card.
    final tmdb = _tmdbId(id);
    if (tmdb != null && traktKeys.contains('tmdb:$tmdb:$season:$episode')) {
      return true;
    }
    final se = '$season:$episode';
    if (anilistKeys[id]?.contains(se) ?? false) return true;
    if (malKeys[id]?.contains(se) ?? false) return true;
    return false;
  }

  /// Whether the viewer EXPLICITLY marked this episode unwatched. This is the
  /// hard override that beats every watched signal INCLUDING the whole-series
  /// `finished`/`completed` fallbacks, mirroring web `getEpisodeProgress`'s
  /// `manual===false` early return (which precedes all other resolution).
  bool episodeUnwatched(String id, int season, int episode) =>
      manualUnwatchedKeys.contains('$id|$season|$episode');

  /// Whether a tracker marks the whole series watched (the Simkl `completed`
  /// "all other episodes" fallback).
  bool seriesCompleted(String id) => completedSeriesIds.contains(id);
}
