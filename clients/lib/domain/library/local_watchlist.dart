import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// A watchlist entry, ported from `LocalEntry` in `src/lib/watchlist.ts`.
class WatchlistEntry {
  const WatchlistEntry({
    required this.id,
    required this.type,
    required this.name,
    this.poster,
    required this.addedAt,
  });

  final String id;
  final String type; // movie | series
  final String name;
  final String? poster;
  final int addedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'name': name,
    if (poster != null) 'poster': poster,
    'addedAt': addedAt,
  };
}

/// A local media-list store, ported from the web `createMediaListStore`. Backs
/// both the watchlist (`harbor.watchlist.v1`, the default) and the Favorites
/// list (`harbor.favorites.v1`) — same shape, different [storageKey]. The
/// watchlist's remote fan-out (Trakt/Simkl/Stremio) layers on with those tracker
/// providers; Favorites is local-only.
class LocalWatchlist {
  LocalWatchlist(
    this._kv, {
    DateTime Function()? now,
    this.storageKey = 'harbor.watchlist.v1',
  }) : _now = now ?? DateTime.now;

  /// The kv key this list persists under.
  final String storageKey;
  String get _key => storageKey;

  final KvStore _kv;
  final DateTime Function() _now;

  String _inferType(String id) =>
      id.contains(':tv:') || id.contains(':series:') ? 'series' : 'movie';

  String _normalizeType(String? type, String id) {
    if (type == 'series' || type == 'tv') return 'series';
    if (type == 'movie') return 'movie';
    return _inferType(id);
  }

  Map<String, WatchlistEntry> _read() {
    final raw = _kv.getString(_key);
    final out = <String, WatchlistEntry>{};
    if (raw == null || raw.isEmpty) return out;
    try {
      final arr = jsonDecode(raw);
      if (arr is! List) return out;
      for (final el in arr) {
        if (el is String) {
          out[el] = WatchlistEntry(
            id: el,
            type: _inferType(el),
            name: '',
            addedAt: 0,
          );
        } else if (el is Map && el['id'] is String) {
          final id = el['id'] as String;
          out[id] = WatchlistEntry(
            id: id,
            type: el['type'] == 'series' ? 'series' : 'movie',
            name: el['name'] is String ? el['name'] as String : '',
            poster: el['poster'] is String ? el['poster'] as String : null,
            addedAt: (el['addedAt'] as num?)?.toInt() ?? 0,
          );
        }
      }
    } catch (_) {
      return {};
    }
    return out;
  }

  Future<void> _write(Map<String, WatchlistEntry> map) {
    final list = map.values.map((e) => e.toJson()).toList();
    return _kv.setString(_key, jsonEncode(list));
  }

  /// Entries, most-recently-added first.
  List<WatchlistEntry> list() {
    final entries = _read().values.toList()
      ..sort((a, b) => b.addedAt.compareTo(a.addedAt));
    return entries;
  }

  bool contains(String id) => _read().containsKey(id);

  /// Adds or removes; returns true if the item is now in the watchlist.
  Future<bool> toggle({
    required String id,
    String? type,
    String? name,
    String? poster,
  }) async {
    final map = _read();
    if (map.containsKey(id)) {
      map.remove(id);
      await _write(map);
      return false;
    }
    map[id] = WatchlistEntry(
      id: id,
      type: _normalizeType(type, id),
      name: name ?? '',
      poster: poster,
      addedAt: _now().millisecondsSinceEpoch,
    );
    await _write(map);
    return true;
  }
}
