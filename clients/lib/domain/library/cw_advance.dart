import '../catalog/tmdb_details.dart' show Episode;
import 'cw_watched_sets.dart';
import 'history.dart' show episodeFromVideoId;
import 'local_cw.dart' show LocalCwEntry, isAnimeCwEntry;

/// The pure Continue-Watching advance engine, ported 1:1 from web
/// `src/views/home/hooks/use-cw-advance.ts` (the decision logic only — episode
/// fetching + the Riverpod wiring live in the provider). Every function is pure
/// and takes an injected `now`, so the whole air-date / watched-set behaviour is
/// deterministically unit-testable.

/// Web `FINISHED_RATIO` — a series episode counts as finished at ≥90% (NOT the
/// local CW store's 0.92 dismissal threshold; match web for parity).
const double kCwFinishedRatio = 0.9;

/// Whether anime is included / excluded / exclusive on the current shelf. Mirrors
/// the web `AnimeMode` ('all' | 'exclude' | 'only').
enum AnimeMode { all, exclude, only }

/// A season+episode coordinate.
class EpisodeRef {
  const EpisodeRef(this.season, this.episode);
  final int season;
  final int episode;

  @override
  bool operator ==(Object other) =>
      other is EpisodeRef && other.season == season && other.episode == episode;

  @override
  int get hashCode => Object.hash(season, episode);

  @override
  String toString() => 'S${season}E$episode';
}

/// The engine's view of a CW item, adapted from a [LocalCwEntry] (or, later, a
/// merged Stremio library item that supplies [flaggedWatched]).
class CwAdvanceItem {
  const CwAdvanceItem({
    required this.id,
    required this.type,
    required this.isAnime,
    this.name,
    this.season,
    this.episode,
    this.videoId,
    this.positionMs = 0,
    this.durationMs = 0,
    this.flaggedWatched = 0,
  });

  final String id;
  final String type; // movie | series
  final bool isAnime;
  final String? name;
  final int? season;
  final int? episode;
  final String? videoId;
  final int positionMs;
  final int durationMs;
  final int flaggedWatched;

  double get progress =>
      durationMs > 0 ? (positionMs / durationMs).clamp(0.0, 1.0) : 0.0;

  factory CwAdvanceItem.fromLocal(LocalCwEntry e) => CwAdvanceItem(
    id: e.id,
    type: e.type,
    isAnime: isAnimeCwEntry(e),
    name: e.name,
    season: e.season,
    episode: e.episode,
    videoId: e.videoId,
    positionMs: e.positionMs,
    durationMs: e.durationMs,
  );
}

final _animeIdScheme = RegExp(r'^(kitsu|mal|anilist|anidb):');

/// The season/episode the item is currently on — explicit state, else the anime
/// single-index videoId convention (→ season 1), else the trailing `s:e` of the
/// videoId. Ports web `currentEpisode`.
EpisodeRef? currentEpisode(CwAdvanceItem i) {
  final s = i.season;
  final e = i.episode;
  if (s != null && s != 0 && e != null && e != 0) return EpisodeRef(s, e);
  final vid = i.videoId ?? '';
  if (_animeIdScheme.hasMatch(i.id) && vid.split(':').length == 3) {
    final ep = int.tryParse(vid.split(':')[2]) ?? 0;
    return ep > 0 ? EpisodeRef(1, ep) : null;
  }
  final p = episodeFromVideoId(vid);
  return p != null && p.episode > 0 ? EpisodeRef(p.season, p.episode) : null;
}

/// Whether a series item is "finished" (its current episode fully watched via
/// library state). Ports web `isFinishedSeries`: requires `flaggedWatched > 0`
/// AND (no duration OR ≥90% through). Local-only entries carry
/// `flaggedWatched == 0`, so this is false for them — exactly as web behaves
/// without library state; their advance relies on the per-episode watched sets.
bool isFinishedSeries(CwAdvanceItem i) {
  if (i.type != 'series') return false;
  if (i.flaggedWatched <= 0) return false;
  return i.durationMs <= 0 || i.progress >= kCwFinishedRatio;
}

/// The first not-yet-watched episode at or after [from] in `(season, episode)`
/// order (seasons ≥ 1 only). Ports web `nextUnwatchedAfter`.
Episode? nextUnwatchedAfter(
  List<Episode> eps,
  EpisodeRef from,
  bool Function(int season, int episode) isWatched,
) {
  final sorted =
      [
        for (final e in eps)
          if (e.seasonNumber >= 1) e,
      ]..sort(
        (a, b) => a.seasonNumber != b.seasonNumber
            ? a.seasonNumber.compareTo(b.seasonNumber)
            : a.episodeNumber.compareTo(b.episodeNumber),
      );
  var idx = sorted.indexWhere(
    (e) => e.seasonNumber == from.season && e.episodeNumber == from.episode,
  );
  if (idx < 0) idx = 0;
  for (var i = idx; i < sorted.length; i++) {
    if (!isWatched(sorted[i].seasonNumber, sorted[i].episodeNumber)) {
      return sorted[i];
    }
  }
  return null;
}

/// Whether an episode with [airDate] has aired by [now]. Ports web `isNextAired`:
/// anime treats an unknown/unparseable date as NOT aired; non-anime treats it as
/// aired (permissive).
bool isNextAired(bool isAnime, String? airDate, DateTime now) {
  final parsed = (airDate == null || airDate.isEmpty)
      ? null
      : DateTime.tryParse(airDate);
  if (!isAnime) return parsed == null ? true : !parsed.isAfter(now);
  return parsed != null && !parsed.isAfter(now);
}

/// Whether [next] should be treated as aired, with the anime boundary-index
/// fallback: when an anime next episode has no air date, it counts as aired if it
/// sits at or before the highest index in [list] whose date has passed. Ports web
/// `nextEpAired`.
bool nextEpAired(List<Episode> list, Episode next, bool isAnime, DateTime now) {
  if (isNextAired(isAnime, next.airDate, now)) return true;
  if (!isAnime || (next.airDate != null && next.airDate!.isNotEmpty)) {
    return false;
  }
  var boundary = -1;
  for (var k = 0; k < list.length; k++) {
    final raw = list[k].airDate;
    final t = (raw == null || raw.isEmpty) ? null : DateTime.tryParse(raw);
    if (t != null && !t.isAfter(now)) boundary = k;
  }
  if (boundary < 0) return false;
  final idx = list.indexWhere(
    (e) =>
        e.seasonNumber == next.seasonNumber &&
        e.episodeNumber == next.episodeNumber,
  );
  return idx >= 0 && idx <= boundary;
}

/// The per-episode watched test for an item: watched if any per-episode source
/// says so, else the current episode is watched when the series is finished, else
/// the whole-series completed fallback. Ports web `watchedPredicate`.
bool Function(int season, int episode) buildWatchedPredicate({
  required CwAdvanceItem item,
  required EpisodeRef cur,
  required CwWatchedSets sets,
}) {
  final finished = isFinishedSeries(item);
  final completed = sets.seriesCompleted(item.id);
  return (season, episode) {
    // Explicit "unwatched" is the hard override — it beats the per-episode
    // sources AND the whole-series finished/completed fallbacks (web
    // `getEpisodeProgress` early-returns on `manual===false` before all else).
    if (sets.episodeUnwatched(item.id, season, episode)) return false;
    if (sets.episodeWatched(item.id, season, episode)) return true;
    if (season == cur.season && episode == cur.episode) return finished;
    return completed;
  };
}

/// Whether an item is a candidate for advancing — a series whose current episode
/// is already watched. The provider filters on this BEFORE fetching episode
/// lists, so non-targets never hit the network.
bool isAdvanceTarget(CwAdvanceItem item, CwWatchedSets sets) {
  if (item.type != 'series') return false;
  final cur = currentEpisode(item);
  if (cur == null) return false;
  return buildWatchedPredicate(item: item, cur: cur, sets: sets)(
    cur.season,
    cur.episode,
  );
}

/// The outcome of the per-item advance decision.
sealed class CwAdvanceOutcome {
  const CwAdvanceOutcome();
}

/// Roll the card forward to [next] (upNext, progress reset).
class CwAdvance extends CwAdvanceOutcome {
  const CwAdvance(this.next);
  final EpisodeRef next;
}

/// The series is finished — drop the card.
class CwRemove extends CwAdvanceOutcome {
  const CwRemove();
}

/// Leave the card unchanged.
class CwKeep extends CwAdvanceOutcome {
  const CwKeep();
}

/// The full per-item decision given its (already-fetched) [episodes]. Ports the
/// advance/remove branch of the web effect: advance to the next aired unwatched
/// episode; otherwise (non-empty list, no aired next) remove the finished series
/// unless a mid-episode anime resume in `only` mode should be kept. An empty list
/// (fetch failed or genuinely empty) keeps the card, matching web's `continue`.
CwAdvanceOutcome decideAdvance({
  required CwAdvanceItem item,
  required List<Episode> episodes,
  required CwWatchedSets sets,
  required AnimeMode animeMode,
  required DateTime now,
}) {
  final cur = currentEpisode(item);
  if (cur == null) return const CwKeep();
  final pred = buildWatchedPredicate(item: item, cur: cur, sets: sets);
  if (!pred(cur.season, cur.episode)) return const CwKeep();
  if (episodes.isEmpty) return const CwKeep();

  final next = nextUnwatchedAfter(episodes, cur, pred);
  if (next != null && nextEpAired(episodes, next, item.isAnime, now)) {
    return CwAdvance(EpisodeRef(next.seasonNumber, next.episodeNumber));
  }

  final finaleEp = episodes.last;
  final off = item.positionMs, dur = item.durationMs;
  final midEpisode = off > 0 && dur > 0 && off / dur < kCwFinishedRatio;
  final freshMidResume =
      animeMode == AnimeMode.only &&
      midEpisode &&
      cur.episode < finaleEp.episodeNumber;
  return freshMidResume ? const CwKeep() : const CwRemove();
}
