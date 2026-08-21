import 'dart:async';
import 'dart:convert';
import 'dart:math';

import '../../core/storage/kv_store.dart';
import 'feed_pool.dart';

/// The queue's skip/block memory, ported 1:1 from `feed/skipped.ts`. A skip
/// snoozes a title for two weeks; a "not interested" blocks it permanently. Both
/// hide the title from the discovery queue until they lapse. Persisted to
/// [KvStore] under `harbor.feed.skipped` (snoozes) and `harbor.feed.blocked`.
/// Inject [clock] for tests.
class FeedSkippedStore {
  FeedSkippedStore(this._kv, {DateTime Function() clock = DateTime.now})
    : _clock = clock;

  final KvStore _kv;
  final DateTime Function() _clock;

  static const _snoozeKey = 'harbor.feed.skipped';
  static const _blockKey = 'harbor.feed.blocked';
  static const _snoozeMs = 14 * 24 * 60 * 60 * 1000;

  static String _norm(String id) => id.trim().toLowerCase();

  int get _now => _clock().millisecondsSinceEpoch;

  Map<String, int> _readSnoozeMap() {
    final raw = _kv.getString(_snoozeKey);
    if (raw == null) return {};
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! Map) return {};
      final out = <String, int>{};
      for (final entry in parsed.entries) {
        final key = entry.key;
        final until = entry.value;
        if (key is String && until is num) out[key] = until.toInt();
      }
      return out;
    } catch (_) {
      return {};
    }
  }

  Future<void> _writeSnoozeMap(Map<String, int> map) =>
      _kv.setString(_snoozeKey, jsonEncode(map));

  Set<String> _readBlocked() {
    final raw = _kv.getString(_blockKey);
    if (raw == null) return {};
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! List) return {};
      return {
        for (final v in parsed)
          if (v is String) _norm(v),
      };
    } catch (_) {
      return {};
    }
  }

  Future<void> _writeBlocked(Set<String> set) =>
      _kv.setString(_blockKey, jsonEncode(set.toList()));

  /// Snoozes [id] out of the queue for two weeks.
  Future<void> snooze(String id) async {
    if (id.isEmpty) return;
    final map = _readSnoozeMap();
    map[_norm(id)] = _now + _snoozeMs;
    await _writeSnoozeMap(map);
  }

  /// Blocks [id] from the queue permanently.
  Future<void> block(String id) async {
    if (id.isEmpty) return;
    final set = _readBlocked();
    set.add(_norm(id));
    await _writeBlocked(set);
  }

  /// Whether [id] is currently hidden — blocked, or snoozed and not yet lapsed.
  /// A lapsed snooze is cleaned up as a side effect and reported as not hidden.
  bool isHidden(String id) {
    if (id.isEmpty) return false;
    final key = _norm(id);
    if (_readBlocked().contains(key)) return true;
    final map = _readSnoozeMap();
    final until = map[key];
    if (until == null) return false;
    if (until <= _now) {
      map.remove(key);
      unawaited(_writeSnoozeMap(map));
      return false;
    }
    return true;
  }

  /// Drops the hidden titles from [items].
  List<FeedItem> filterPool(List<FeedItem> items) => [
    for (final it in items)
      if (!isHidden(it.meta.id)) it,
  ];
}

/// A fresh random shuffle of [items] (Fisher–Yates), ported from
/// `shuffleQueuePool`. Pass a seeded [rng] for deterministic tests.
List<T> shuffleQueuePool<T>(List<T> items, {Random? rng}) {
  final r = rng ?? Random();
  final out = List<T>.of(items);
  for (var i = out.length - 1; i > 0; i--) {
    final j = r.nextInt(i + 1);
    final tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
