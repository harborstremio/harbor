import '../catalog/tmdb_details.dart' show Episode;

/// The recency window (45 days) beyond which a freshly-aired episode no longer
/// counts as "new" on a Continue-Watching card — web `RECENT_MS`.
const int kNewEpisodeRecentMs = 45 * 24 * 60 * 60 * 1000;

/// How many episodes aired since the viewer last watched, for the CW card's
/// "+N new episodes" badge. Ported from the web `new-episodes.ts` `compute`: an
/// episode counts when its air date is finite, already aired (`<= now`), later
/// than [lastWatchedMs], and within the recent window ([kNewEpisodeRecentMs]).
/// Returns 0 when the last-watch time is unknown (`<= 0`), matching web's
/// non-finite `lastWatched` early return.
int newEpisodeCount(List<Episode> episodes, int lastWatchedMs, DateTime now) {
  if (lastWatchedMs <= 0) return 0;
  final nowMs = now.millisecondsSinceEpoch;
  var count = 0;
  for (final e in episodes) {
    final raw = e.airDate;
    if (raw == null || raw.isEmpty) continue;
    final rel = DateTime.tryParse(raw)?.millisecondsSinceEpoch;
    if (rel == null) continue;
    if (rel > nowMs) continue; // not yet aired
    if (rel > lastWatchedMs && nowMs - rel < kNewEpisodeRecentMs) count++;
  }
  return count;
}
