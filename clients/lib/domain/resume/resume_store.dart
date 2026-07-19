import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// A saved resume position: milliseconds into the title and the epoch ms it was
/// written.
class ResumeEntry {
  const ResumeEntry({required this.ms, required this.t});
  final int ms;
  final int t;
}

/// The last-played episode of a series, from the resume store.
class LastPlayed {
  const LastPlayed({
    required this.season,
    required this.episode,
    required this.ms,
    required this.t,
  });
  final int season;
  final int episode;
  final int ms;
  final int t;
}

/// Resume/continue-watching position persistence, ported 1:1 from
/// `src/lib/resume.ts`. Persists to the `harbor.resume` key as
/// `{ "<id>" | "<id>|s<S>e<E>": { ms, t } }`.
class ResumeStore {
  ResumeStore(this._kv, {DateTime Function()? now})
    : _now = now ?? DateTime.now;

  static const _key = 'harbor.resume';

  final KvStore _kv;
  final DateTime Function() _now;

  int get _nowMs => _now().millisecondsSinceEpoch;

  static String entryKey(String id, [int? season, int? episode]) {
    if (season != null && episode != null) return '$id|s${season}e$episode';
    return id;
  }

  Map<String, dynamic> _readAll() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return {};
    try {
      return (jsonDecode(raw) as Map).cast<String, dynamic>();
    } catch (_) {
      return {};
    }
  }

  Future<void> _writeAll(Map<String, dynamic> all) =>
      _kv.setString(_key, jsonEncode(all));

  /// Saves a resume position (ms). No-ops on invalid ms or an invalid
  /// season/episode pair.
  Future<void> saveResumeMs(
    String id,
    int ms, [
    int? season,
    int? episode,
  ]) async {
    if (ms < 0) return;
    if (season != null && episode != null) {
      if (season < 0 || episode < 1) return;
    }
    final all = _readAll();
    all[entryKey(id, season, episode)] = {'ms': ms, 't': _nowMs};
    await _writeAll(all);
  }

  int readResumeMs(String id, [int? season, int? episode]) {
    final e = _readAll()[entryKey(id, season, episode)];
    return e is Map ? ((e['ms'] as num?)?.toInt() ?? 0) : 0;
  }

  ResumeEntry? readResumeEntry(String id, [int? season, int? episode]) {
    final e = _readAll()[entryKey(id, season, episode)];
    if (e is! Map) return null;
    return ResumeEntry(
      ms: (e['ms'] as num?)?.toInt() ?? 0,
      t: (e['t'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> clearResume(String id, [int? season, int? episode]) async {
    final all = _readAll();
    all.remove(entryKey(id, season, episode));
    await _writeAll(all);
  }

  /// The most recently played episode of [seriesId] (highest `t`).
  LastPlayed? lastPlayedEpisode(String seriesId) {
    final prefix = '$seriesId|s';
    LastPlayed? best;
    final rx = RegExp(r'\|s(\d+)e(\d+)$');
    for (final entry in _readAll().entries) {
      if (!entry.key.startsWith(prefix)) continue;
      final m = rx.firstMatch(entry.key);
      if (m == null) continue;
      final season = int.parse(m.group(1)!);
      final episode = int.parse(m.group(2)!);
      if (season < 1 || episode < 1) continue;
      final v = entry.value;
      if (v is! Map) continue;
      final t = (v['t'] as num?)?.toInt() ?? 0;
      if (best == null || t > best.t) {
        best = LastPlayed(
          season: season,
          episode: episode,
          ms: (v['ms'] as num?)?.toInt() ?? 0,
          t: t,
        );
      }
    }
    return best;
  }
}
