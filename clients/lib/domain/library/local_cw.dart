import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// A local continue-watching entry, ported from `LocalCwEntry` in
/// `src/lib/local-cw.ts`.
class LocalCwEntry {
  const LocalCwEntry({
    required this.id,
    required this.type,
    required this.name,
    this.poster,
    this.background,
    this.season,
    this.episode,
    this.videoId,
    required this.positionMs,
    required this.durationMs,
    required this.t,
    this.external,
    this.isAnime = false,
  });

  final String id;
  final String type; // movie | series
  final String name;
  final String? poster;
  final String? background;
  final int? season;
  final int? episode;
  final String? videoId;
  final int positionMs;
  final int durationMs;
  final int t;

  /// The external tracker this entry came from (`'simkl'`) when it is NOT a local
  /// play — its progress lives on that service, so the card shows a "Paused on
  /// {service}" tag and suppresses the (device-local) time-left pill. Null for a
  /// genuine local/Stremio entry. Ports the web `LibraryItem.external`.
  final String? external;

  /// Whether the source flagged this title as anime even though its id is a plain
  /// imdb/tmdb id (web `LibraryItem.isAnime`) — so it still buckets into the anime
  /// room. Complements the id-prefix check in [isAnimeCwEntry].
  final bool isAnime;

  double get progress =>
      durationMs > 0 ? (positionMs / durationMs).clamp(0.0, 1.0) : 0.0;

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'name': name,
    if (poster != null) 'poster': poster,
    if (background != null) 'background': background,
    if (season != null) 'season': season,
    if (episode != null) 'episode': episode,
    if (videoId != null) 'videoId': videoId,
    'positionMs': positionMs,
    'durationMs': durationMs,
    't': t,
  };

  factory LocalCwEntry.fromJson(Map<String, dynamic> j) => LocalCwEntry(
    id: j['id'].toString(),
    type: j['type'] == 'series' ? 'series' : 'movie',
    name: (j['name'] ?? '').toString(),
    poster: j['poster']?.toString(),
    background: j['background']?.toString(),
    season: (j['season'] as num?)?.toInt(),
    episode: (j['episode'] as num?)?.toInt(),
    videoId: j['videoId']?.toString(),
    positionMs: (j['positionMs'] as num?)?.toInt() ?? 0,
    durationMs: (j['durationMs'] as num?)?.toInt() ?? 0,
    t: (j['t'] as num?)?.toInt() ?? 0,
  );
}

/// The local continue-watching store, ported 1:1 from `src/lib/local-cw.ts`
/// (`harbor.localcw.v1`, MAX 60, finished ratio 0.92). Merged with Stremio +
/// Simkl CW by the aggregate provider.
class LocalCwStore {
  LocalCwStore(this._kv);

  static const _key = 'harbor.localcw.v1';
  static const _max = 60;
  static const _finishedRatio = 0.92;

  final KvStore _kv;

  Map<String, LocalCwEntry> _readAll() {
    final raw = _kv.getString(_key);
    final out = <String, LocalCwEntry>{};
    if (raw == null || raw.isEmpty) return out;
    try {
      final map = jsonDecode(raw);
      if (map is! Map) return out;
      for (final entry in map.entries) {
        final v = entry.value;
        if (v is Map) {
          out[entry.key.toString()] = LocalCwEntry.fromJson(
            v.cast<String, dynamic>(),
          );
        }
      }
    } catch (_) {
      return {};
    }
    return out;
  }

  Future<void> _writeAll(Map<String, LocalCwEntry> all) => _kv.setString(
    _key,
    jsonEncode(all.map((k, v) => MapEntry(k, v.toJson()))),
  );

  /// Saves/updates a CW entry. A finished movie (≥0.92) is removed; the store is
  /// capped at 60, dropping the oldest by timestamp.
  Future<void> save(LocalCwEntry entry) async {
    if (entry.id.isEmpty || (entry.type != 'movie' && entry.type != 'series')) {
      return;
    }
    final all = {..._readAll()};
    final finished =
        entry.durationMs > 0 &&
        entry.positionMs / entry.durationMs >= _finishedRatio;
    if (finished && entry.type == 'movie') {
      if (!all.containsKey(entry.id)) return;
      all.remove(entry.id);
    } else {
      all[entry.id] = entry;
      if (all.length > _max) {
        final ids = all.keys.toList()
          ..sort((a, b) => all[a]!.t.compareTo(all[b]!.t));
        for (final id in ids.take(all.length - _max)) {
          all.remove(id);
        }
      }
    }
    await _writeAll(all);
  }

  /// Entries most-recently-updated first.
  List<LocalCwEntry> list() {
    final entries = _readAll().values.toList()
      ..sort((a, b) => b.t.compareTo(a.t));
    return entries;
  }

  LocalCwEntry? entry(String id) => _readAll()[id];

  Future<void> clear(String id) async {
    final all = _readAll();
    if (!all.containsKey(id)) return;
    final next = {...all}..remove(id);
    await _writeAll(next);
  }
}

String _normCwName(String s) =>
    s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '');

/// Applies the continue-watching aggregate rules, ported 1:1 from the
/// `continueWatching` memo in `home.tsx`: drop non-playable (`other`/`iptv:`)
/// items, sort most-recent first (`cwSortKey`, the entry timestamp for local
/// items), then de-dupe by id and by normalized `type:name` (so the same show
/// appears once), capped at 100. Merges with the Stremio + Simkl sources land
/// with those subsystems.
List<LocalCwEntry> continueWatchingAggregate(List<LocalCwEntry> entries) {
  final eligible =
      entries
          .where((e) => e.type != 'other' && !e.id.startsWith('iptv:'))
          .toList()
        ..sort((a, b) => b.t.compareTo(a.t));

  final seenId = <String>{};
  final seenName = <String>{};
  final out = <LocalCwEntry>[];
  for (final e in eligible) {
    if (seenId.contains(e.id)) continue;
    final nm = _normCwName(e.name);
    final nameKey = '${e.type}:$nm';
    if (nm.isNotEmpty && seenName.contains(nameKey)) continue;
    seenId.add(e.id);
    if (nm.isNotEmpty) seenName.add(nameKey);
    out.add(e);
    if (out.length >= 100) break;
  }
  return out;
}

/// Whether a Continue-Watching entry is an anime title. Ports the id-prefix core
/// of web `isAnimeCwItem` (`/^(kitsu|mal|anilist|anidb):/`) — all four anime id
/// namespaces, not just kitsu/mal; used to keep anime out of the Home shelf when
/// `animeOnlyInAnimeRoom` is on. (Web additionally honours an `isAnime` flag and
/// a runtime `isDetectedAnime` store; neither is modelled on the local CW entry
/// yet, so an IMDb-id title only detected as anime at runtime still slips
/// through — tracked in the Home depth backlog.)
bool isAnimeCwEntry(LocalCwEntry e) =>
    e.isAnime ||
    e.id.startsWith('kitsu:') ||
    e.id.startsWith('mal:') ||
    e.id.startsWith('anilist:') ||
    e.id.startsWith('anidb:');
