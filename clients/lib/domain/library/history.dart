import 'dart:math' as math;

import '../addons/models.dart';
import '../stremio/library_item.dart';
import '../trakt/trakt_types.dart';

/// A watched-history row for the Library "History" tab — a merge of the Stremio
/// library's played items and the Trakt watched history. Ported from the web
/// `HistoryEntry` in `views/library/history-tab.tsx`.
class HistoryEntry {
  const HistoryEntry({
    required this.key,
    required this.meta,
    required this.date,
    this.stremioId,
    this.season,
    this.episode,
    required this.progress,
    required this.watched,
    required this.durationMs,
    required this.timeOffsetMs,
    required this.watchedAt,
    this.item,
  });

  final String key;
  final MetaPreview meta;

  /// The sort/group timestamp (ms since epoch), or null when undated.
  final int? date;

  /// The Stremio library id, present only for Stremio-sourced rows (enables the
  /// remove action). Absent for Trakt-only rows.
  final String? stremioId;
  final int? season;
  final int? episode;

  /// Fractional playback progress in `[0, 1]`.
  final double progress;
  final bool watched;
  final int durationMs;
  final int timeOffsetMs;
  final int? watchedAt;

  /// The raw Stremio library item, when this row came from Stremio.
  final LibraryItem? item;
}

/// Parses an ISO timestamp to ms-since-epoch, or null when absent/unparseable.
/// Ports `parseTs` from `views/library/shared.tsx`.
int? parseTs(String? s) {
  if (s == null || s.isEmpty) return null;
  return DateTime.tryParse(s)?.millisecondsSinceEpoch;
}

/// Maps a library item type to a meta type. Ports `libraryMetaType`.
String _libraryMetaType(String t) =>
    (t == 'series' ||
        t == 'channel' ||
        t == 'tv' ||
        t == 'anime' ||
        t == 'other')
    ? t
    : 'movie';

/// Parses a `season:episode` pair from the tail of a Stremio `video_id`
/// (`<id>:<season>:<episode>`), or null when it has no valid trailing pair.
/// Ports `episodeFromVideoId`.
({int season, int episode})? episodeFromVideoId(String? videoId) {
  if (videoId == null || videoId.isEmpty) return null;
  final parts = videoId.split(':');
  if (parts.length < 3) return null;
  final season = int.tryParse(parts[parts.length - 2]);
  final episode = int.tryParse(parts[parts.length - 1]);
  if (season == null || episode == null || season < 0 || episode < 0) {
    return null;
  }
  return (season: season, episode: episode);
}

/// The season/episode a library item was last playing, from explicit state or,
/// failing that, its `video_id` (with the kitsu/mal/anilist/anidb single-index
/// convention → season 1). Ports `episodeOf`.
({int season, int episode})? _episodeOf(LibraryItem i) {
  final s = i.state?.season;
  final e = i.state?.episode;
  if (s != null && s != 0 && e != null && e != 0) {
    return (season: s, episode: e);
  }
  final vid = i.state?.videoId ?? '';
  final animeScheme = RegExp(r'^(kitsu|mal|anilist|anidb):').hasMatch(i.id);
  if (animeScheme && vid.split(':').length == 3) {
    final ep = int.tryParse(vid.split(':')[2]) ?? 0;
    return ep > 0 ? (season: 1, episode: ep) : null;
  }
  final parsed = episodeFromVideoId(vid);
  return parsed != null && parsed.episode > 0 ? parsed : null;
}

/// Reduces a raw Stremio library to just its watched-history rows: drops removal
/// tombstones (`removed && !temp`), keeps only items the user actually played
/// (`flaggedWatched == 1` or `timeOffset > 0`), newest first by last-watched.
/// Ports `filterHistory`.
List<LibraryItem> filterHistory(List<LibraryItem> items) {
  final kept = [
    for (final i in items)
      if ((!i.removed || i.temp) &&
          ((i.state?.flaggedWatched ?? 0) == 1 ||
              (i.state?.timeOffset ?? 0) > 0))
        i,
  ];
  // Stable newest-first sort: the web's Array.sort is stable, but Dart's
  // List.sort is not (introsort for 32+ items), so break timestamp ties on the
  // original input order to keep tied rows (e.g. a bulk mark-watched) 1:1.
  final indexed = [
    for (var i = 0; i < kept.length; i++) (index: i, item: kept[i]),
  ];
  indexed.sort((a, b) {
    final at = parseTs(a.item.state?.lastWatched ?? a.item.mtime) ?? 0;
    final bt = parseTs(b.item.state?.lastWatched ?? b.item.mtime) ?? 0;
    final c = bt.compareTo(at);
    return c != 0 ? c : a.index.compareTo(b.index);
  });
  return [for (final e in indexed) e.item];
}

/// Merges the filtered Stremio library and the Trakt watched history into a
/// single de-duplicated history list (keyed by id — a Stremio row wins over the
/// Trakt row for the same title). Ports `mergeHistory`.
List<HistoryEntry> mergeHistory(
  List<LibraryItem> stremio,
  List<TraktHistoryItem> trakt,
) {
  final out = <String, HistoryEntry>{};
  final order = <String>[];
  for (final item in stremio) {
    final dur = item.state?.duration ?? 0;
    final off = item.state?.timeOffset ?? 0;
    final progress = dur > 0 ? math.min(1.0, off / dur) : 0.0;
    final ep = item.type == 'movie' ? null : _episodeOf(item);
    if (!out.containsKey(item.id)) order.add(item.id);
    out[item.id] = HistoryEntry(
      key: item.id,
      meta: MetaPreview({
        'id': item.id,
        'type': _libraryMetaType(item.type),
        'name': item.name,
        if (item.poster != null) 'poster': item.poster,
        if (item.background != null) 'background': item.background,
      }),
      date: parseTs(item.mtime),
      stremioId: item.id,
      season: ep?.season,
      episode: ep?.episode,
      progress: progress,
      watched: (item.state?.flaggedWatched ?? 0) == 1 || progress >= 0.9,
      durationMs: dur,
      timeOffsetMs: off,
      watchedAt: parseTs(item.state?.lastWatched ?? item.mtime),
      item: item,
    );
  }
  for (final h in trakt) {
    final id = h.isMovie ? h.imdb : h.showImdb;
    if (id == null || id.isEmpty || out.containsKey(id)) continue;
    order.add(id);
    out[id] = HistoryEntry(
      key: id,
      meta: MetaPreview({
        'id': id,
        'type': h.isMovie ? 'movie' : 'series',
        'name': h.isMovie ? h.title : (h.showImdb != null ? '' : h.title),
      }),
      date: parseTs(h.watchedAt),
      progress: 0,
      watched: false,
      durationMs: 0,
      timeOffsetMs: 0,
      watchedAt: parseTs(h.watchedAt),
    );
  }
  return [for (final k in order) out[k]!];
}

/// Converts Trakt history rows to de-duplicated dated meta entries — the Trakt
/// tab's "recently watched" source. Ports `historyItemsToDated`.
List<HistoryEntry> historyItemsToDated(List<TraktHistoryItem> items) {
  final seen = <String>{};
  final out = <HistoryEntry>[];
  for (final h in items) {
    final id = h.isMovie ? h.imdb : h.showImdb;
    if (id == null || id.isEmpty || seen.contains(id)) continue;
    seen.add(id);
    out.add(
      HistoryEntry(
        key: id,
        meta: MetaPreview({
          'id': id,
          'type': h.isMovie ? 'movie' : 'series',
          'name': h.title,
        }),
        date: parseTs(h.watchedAt),
        progress: 0,
        watched: false,
        durationMs: 0,
        timeOffsetMs: 0,
        watchedAt: parseTs(h.watchedAt),
      ),
    );
  }
  return out;
}
