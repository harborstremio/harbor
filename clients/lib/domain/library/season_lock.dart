import 'dart:convert';

import '../../core/storage/kv_store.dart';
import 'playback_history.dart';

/// The per-season source lock (`harbor.season-lock.v1`): a map of `metaId|s{n}`
/// (or `metaId|all`) → the [PlaybackEntry] source profile chosen for that
/// season, so the rest of that season replays from the same release without
/// re-picking. TTL-pruned to 120 days and capped at 300 entries. Ports the web
/// `season-lock.ts`.
class SeasonLockStore {
  SeasonLockStore(this._kv, {int Function()? nowMs})
    : _nowMs = nowMs ?? (() => DateTime.now().millisecondsSinceEpoch);

  static const _key = 'harbor.season-lock.v1';
  static const _ttlMs = 120 * 24 * 60 * 60 * 1000;
  static const _maxEntries = 300;

  final KvStore _kv;
  final int Function() _nowMs;

  static String _seasonKey(String metaId, int? season) =>
      season != null ? '$metaId|s$season' : '$metaId|all';

  Map<String, PlaybackEntry> _readAll() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return {};
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! Map) return {};
      final now = _nowMs();
      final out = <String, PlaybackEntry>{};
      parsed.forEach((k, v) {
        if (v is! Map) return;
        final e = PlaybackEntry.fromJson(v.cast<String, dynamic>());
        if (e.savedAt == 0 || now - e.savedAt > _ttlMs) return;
        out[k.toString()] = e;
      });
      return out;
    } catch (_) {
      return {};
    }
  }

  void _writeAll(Map<String, PlaybackEntry> map) {
    var entries = map.entries.toList();
    if (entries.length > _maxEntries) {
      entries.sort((a, b) => b.value.savedAt.compareTo(a.value.savedAt));
      entries = entries.sublist(0, _maxEntries);
    }
    _kv.setString(
      _key,
      jsonEncode({for (final e in entries) e.key: e.value.toJson()}),
    );
  }

  /// The locked source for [season] (falling back to a series-wide lock), or
  /// null. Ports `readSeasonLock`.
  PlaybackEntry? read(String metaId, int? season) {
    final all = _readAll();
    if (season != null) {
      final perSeason = all['$metaId|s$season'];
      if (perSeason != null) return perSeason;
    }
    return all['$metaId|all'];
  }

  /// Locks the given source profile as the choice for [season]. Ports
  /// `saveSeasonLock` (per-season key; the series-wide `|all` slot is only ever
  /// read as a fallback).
  void save(
    String metaId, {
    String? infoHash,
    String? addonId,
    String? url,
    String? title,
    String? parsedTitle,
    String? bingeGroup,
    String? resolution,
    String? source,
    int? season,
  }) {
    final all = _readAll();
    all[_seasonKey(metaId, season)] = PlaybackEntry(
      infoHash: infoHash,
      addonId: addonId,
      url: url,
      title: title,
      parsedTitle: parsedTitle,
      bingeGroup: bingeGroup,
      resolution: resolution,
      source: source,
      savedAt: _nowMs(),
    );
    _writeAll(all);
  }

  /// Clears the lock for [season] and the series-wide slot. Ports
  /// `clearSeasonLock`.
  void clear(String metaId, int? season) {
    final all = _readAll();
    if (season != null) all.remove('$metaId|s$season');
    all.remove('$metaId|all');
    _writeAll(all);
  }
}
