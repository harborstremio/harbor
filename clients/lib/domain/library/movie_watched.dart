import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// The set of movie ids the viewer has marked watched from the detail view.
///
/// Ported from `movie-watched.ts` (`harbor.moviewatched.v1`): a flat list of
/// meta ids, toggled one movie at a time. This is a movie-only signal — series
/// episodes track their watched state through [ManualWatchedStore] instead.
class MovieWatchedStore {
  MovieWatchedStore(this._kv);

  static const _key = 'harbor.moviewatched.v1';

  final KvStore _kv;

  Set<String> load() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return {};
    try {
      final p = jsonDecode(raw);
      return p is List
          ? {
              for (final e in p)
                if (e is String) e,
            }
          : {};
    } catch (_) {
      return {};
    }
  }

  bool isWatched(String metaId) => load().contains(metaId);

  /// Adds or removes [metaId] and persists, returning the new set. A no-op when
  /// the state already matches (mirrors `setMovieWatchedLocal`'s early return).
  Future<Set<String>> set(String metaId, bool watched) async {
    final cur = load();
    if (cur.contains(metaId) == watched) return cur;
    final next = Set<String>.from(cur);
    if (watched) {
      next.add(metaId);
    } else {
      next.remove(metaId);
    }
    await _kv.setString(_key, jsonEncode(next.toList()));
    return next;
  }
}
