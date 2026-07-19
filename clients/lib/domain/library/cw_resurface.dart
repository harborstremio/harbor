import '../catalog/tmdb_details.dart' show Episode;
import '../stremio/library_item.dart';
import 'cw_advance.dart' show AnimeMode, EpisodeRef;
import 'cw_watched_sets.dart';
import 'history.dart' show episodeFromVideoId, parseTs;

/// The recency window: a finished title only resurfaces if it was last watched
/// within 45 days (web `RECENT_MS`).
const int kResurfaceRecentMs = 45 * 24 * 60 * 60 * 1000;

final _animeId = RegExp(r'^(kitsu|mal|anilist|anidb):');

/// Whether a library id belongs to an anime provider (web `ANIME_ID`).
bool isResurfaceAnimeId(String id) => _animeId.hasMatch(id);

/// The current (last-played) episode of a library item, ported from the web
/// resurface `currentEpisode`: explicit season/episode, else the trailing index
/// of a 3-segment anime videoId (`kitsu:9:5` → Ep 5, season 1), else the parsed
/// `s/e` of the videoId. Null when nothing resolves.
EpisodeRef? resurfaceCurrentEpisode(LibraryItem i) {
  final s = i.state?.season;
  final e = i.state?.episode;
  if (s != null && e != null && s > 0 && e > 0) return EpisodeRef(s, e);
  final vid = i.state?.videoId ?? '';
  if (isResurfaceAnimeId(i.id) && vid.split(':').length == 3) {
    final ep = int.tryParse(vid.split(':')[2]);
    return (ep != null && ep > 0) ? EpisodeRef(1, ep) : null;
  }
  final parsed = episodeFromVideoId(vid);
  return parsed == null ? null : EpisodeRef(parsed.season, parsed.episode);
}

/// STRICT air-date gate for a resurface next-episode: the date must be finite and
/// already past (web `resurfaceAired` — no permissive "missing date is aired"
/// fallback, unlike the advance engine).
bool resurfaceAired(String? airDate, DateTime now) {
  if (airDate == null || airDate.isEmpty) return false;
  // A bare `YYYY-MM-DD` is UTC midnight in web's `Date.parse`; Dart's
  // `DateTime.tryParse` would read it as LOCAL midnight, skewing this strict gate
  // by the timezone offset near the air moment — normalize date-only to UTC.
  final iso = airDate.length == 10 ? '${airDate}T00:00:00Z' : airDate;
  final t = DateTime.tryParse(iso);
  return t != null && !t.isAfter(now);
}

/// Whether an item is currently an in-progress Continue-Watching member — the
/// Flutter slice of web `isCwMember` that a library snapshot can decide (an
/// item with playback `timeOffset > 0`; a genuine tombstone is excluded). Local
/// resume state is already reflected by the `inCw` id set the caller passes.
bool isResurfaceCwMember(LibraryItem i) {
  if (i.removed && !i.temp) return false;
  return (i.state?.timeOffset ?? 0) > 0;
}

/// Whether [i] is a resurface candidate — the pure filter ported from web
/// `resurfaceCandidates` (lines 62-75): a recently-finished series/anime not
/// already in Continue-Watching, with a resolvable current episode. Non-anime
/// requires Stremio's `flaggedWatched`; anime falls back to the watched-set.
bool isResurfaceCandidate(
  LibraryItem i, {
  required Set<String> inCw,
  required AnimeMode animeMode,
  required DateTime now,
  required CwWatchedSets sets,
}) {
  final anime = isResurfaceAnimeId(i.id);
  if (i.type != 'series' && !anime) return false;
  if (i.state == null) return false;
  if (i.removed && !i.temp) return false;
  if (inCw.contains(i.id) || isResurfaceCwMember(i)) return false;
  if (animeMode == AnimeMode.exclude && anime) return false;
  if (animeMode == AnimeMode.only && !anime) return false;
  final lw = parseTs(i.state?.lastWatched);
  if (lw == null || now.millisecondsSinceEpoch - lw > kResurfaceRecentMs) {
    return false;
  }
  final cur = resurfaceCurrentEpisode(i);
  if (cur == null) return false;
  if ((i.state?.flaggedWatched ?? 0) > 0) return true;
  return anime && sets.episodeWatched(i.id, cur.season, cur.episode);
}

/// The episode a candidate should resurface to, or null. Ports the web decision
/// (lines 91-100): the episode immediately AFTER [cur] in air order, only if it
/// has strictly aired and is not itself already watched. Returns null on an
/// empty/failed episode fetch, so a resurface never invents a card.
EpisodeRef? resurfaceNext(
  List<Episode> episodes,
  EpisodeRef cur, {
  required String id,
  required DateTime now,
  required CwWatchedSets sets,
}) {
  if (episodes.isEmpty) return null;
  final sorted = [...episodes]
    ..sort(
      (a, b) => a.seasonNumber != b.seasonNumber
          ? a.seasonNumber.compareTo(b.seasonNumber)
          : a.episodeNumber.compareTo(b.episodeNumber),
    );
  final idx = sorted.indexWhere(
    (e) => e.seasonNumber == cur.season && e.episodeNumber == cur.episode,
  );
  if (idx < 0 || idx + 1 >= sorted.length) return null;
  final next = sorted[idx + 1];
  if (!resurfaceAired(next.airDate, now)) return null;
  // Web gates the next episode with the FULL watchedPredicate, so a title the
  // account completed on Simkl (`seriesCompleted`) never resurfaces — while an
  // explicit "unwatched" still wins. Bare `episodeWatched` omits the whole-series
  // completed fallback, so fold it in here to match.
  final watched =
      sets.episodeWatched(id, next.seasonNumber, next.episodeNumber) ||
      (sets.seriesCompleted(id) &&
          !sets.episodeUnwatched(id, next.seasonNumber, next.episodeNumber));
  if (watched) return null;
  return EpisodeRef(next.seasonNumber, next.episodeNumber);
}
