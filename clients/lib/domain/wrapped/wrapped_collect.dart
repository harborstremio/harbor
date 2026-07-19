import '../anime/anime_detail.dart' show isAnimeId;
import '../trakt/trakt_types.dart';
import 'wrapped_types.dart';

/// A single local play, flattened from the playback-history store — the base
/// meta id, when it was saved, and any titles. Matches the shape web's
/// `playbackEntries()` yields.
typedef PlaybackWatch = ({
  String metaId,
  int savedAt,
  String? title,
  String? parsedTitle,
});

/// Predicate for "this id was detected as anime" — the session/persisted
/// detected-anime set (web `isDetectedAnime`). Injected so the collector stays
/// pure and testable.
typedef IsDetectedAnime = bool Function(String id);

/// Whether an id (with an optional imdb) counts as anime for Wrapped: an
/// anime-scheme id, or one detected as anime by id or imdb. Ports the web
/// `isAnime` in collect.ts.
bool isWrappedAnime(String id, String? imdb, IsDetectedAnime detected) =>
    isAnimeId(id) || detected(id) || (imdb != null && detected(imdb));

/// The local type for an id with no movie/series signal — anime when it is an
/// anime-scheme or detected id, otherwise series. Ports `localType`.
WatchType wrappedLocalType(String id, IsDetectedAnime detected) =>
    isAnimeId(id) || detected(id) ? WatchType.anime : WatchType.series;

int? _parseMs(String iso) => DateTime.tryParse(iso)?.millisecondsSinceEpoch;

/// Maps a Trakt history feed to [WatchEvent]s, 1:1 with the web collect.ts
/// trakt branch: pick the movie or show imdb/tmdb, synthesise an id, classify
/// movie/series/anime, and drop rows with no title or an unparseable date.
List<WatchEvent> traktWatchEvents(
  List<TraktHistoryItem> history,
  IsDetectedAnime detected,
) {
  final out = <WatchEvent>[];
  for (final h in history) {
    final movie = h.type == 'movie';
    final imdb = movie ? h.imdb : (h.showImdb ?? h.imdb);
    final tmdb = movie ? h.tmdb : (h.showTmdb ?? h.tmdb);
    final id =
        imdb ??
        (tmdb != null ? 'tmdb:${movie ? 'movie' : 'tv'}:$tmdb' : '${h.id}');
    final type = isWrappedAnime(id, imdb, detected)
        ? WatchType.anime
        : (movie ? WatchType.movie : WatchType.series);
    final ms = _parseMs(h.watchedAt);
    if (h.title.isEmpty || ms == null) continue;
    out.add(
      WatchEvent(id: id, title: h.title, type: type, watchedAt: ms, imdb: imdb),
    );
  }
  return out;
}

/// The local anime plays not already present in [exclude] (keyed `id:ts`) —
/// used to top up a Trakt-sourced year with anime the tracker missed. Ports
/// `localAnimeEvents` (the playback-history half; the manual-watched-library
/// half needs a name/markedAt meta cache Flutter does not keep).
List<WatchEvent> localAnimeEvents(
  List<PlaybackWatch> playback,
  Set<String> exclude,
  IsDetectedAnime detected,
) {
  final out = <WatchEvent>[];
  final seen = <String>{};
  for (final p in playback) {
    final id = p.metaId;
    final title = p.parsedTitle ?? p.title ?? p.metaId;
    final ts = p.savedAt;
    if (id.isEmpty || title.isEmpty || ts <= 0) continue;
    if (!(isAnimeId(id) || detected(id))) continue;
    final key = '$id:$ts';
    if (!seen.add(key) || exclude.contains(key)) continue;
    out.add(WatchEvent(id: id, title: title, type: WatchType.anime, watchedAt: ts));
  }
  return out;
}

/// Builds the raw watch-event feed for Wrapped. Prefers a non-empty Trakt
/// history (topped up with local anime plays); otherwise falls back to the
/// local playback history; otherwise empty. Ports `collectWatchEvents` — the
/// caller fetches the Trakt history (null when disconnected or the fetch
/// failed) so this stays pure.
({List<WatchEvent> events, WrappedSource source}) collectWatchEvents({
  required List<TraktHistoryItem>? traktHistory,
  required List<PlaybackWatch> playback,
  required IsDetectedAnime detected,
}) {
  if (traktHistory != null) {
    final events = traktWatchEvents(traktHistory, detected);
    if (events.isNotEmpty) {
      final seen = {for (final e in events) '${e.id}:${e.watchedAt}'};
      return (
        events: [...events, ...localAnimeEvents(playback, seen, detected)],
        source: WrappedSource.trakt,
      );
    }
  }

  final events = <WatchEvent>[];
  for (final p in playback) {
    final title = p.parsedTitle ?? p.title ?? p.metaId;
    if (p.metaId.isEmpty || p.savedAt <= 0 || title.isEmpty) continue;
    events.add(
      WatchEvent(
        id: p.metaId,
        title: title,
        type: wrappedLocalType(p.metaId, detected),
        watchedAt: p.savedAt,
      ),
    );
  }
  return events.isNotEmpty
      ? (events: events, source: WrappedSource.local)
      : (events: const <WatchEvent>[], source: WrappedSource.empty);
}
