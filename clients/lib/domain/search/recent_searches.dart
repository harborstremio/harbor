import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// Persists the most recent search queries (newest first, case-insensitively
/// de-duplicated, capped), ported from the recent-search memory in
/// `src/lib/search-context.tsx` (`harbor.search.recent`, max 8).
class RecentSearchesStore {
  RecentSearchesStore(this._kv);

  static const _key = 'harbor.search.recent';
  static const max = 8;

  final KvStore _kv;

  List<String> load() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final p = jsonDecode(raw);
      if (p is! List) return const [];
      return [
        for (final e in p)
          if (e is String) e,
      ].take(max).toList();
    } catch (_) {
      return const [];
    }
  }

  Future<List<String>> _write(List<String> items) async {
    await _kv.setString(_key, jsonEncode(items));
    return items;
  }

  /// Prepends [query] (trimmed), removing any case-insensitive duplicate and
  /// capping at [max]. A blank query is ignored.
  Future<List<String>> record(String query) async {
    final q = query.trim();
    if (q.isEmpty) return load();
    final prev = load();
    final next = [
      q,
      ...prev.where((p) => p.toLowerCase() != q.toLowerCase()),
    ].take(max).toList();
    return _write(next);
  }

  Future<List<String>> remove(String query) async =>
      _write(load().where((p) => p != query).toList());

  Future<List<String>> clear() => _write(const []);
}
