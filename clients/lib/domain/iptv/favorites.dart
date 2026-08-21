import 'dart:convert';

import '../../core/storage/kv_store.dart';
import 'm3u.dart';

String _sourceOf(String id) => id.split('::').first;

/// A favorited channel with enough metadata to render it without its playlist
/// being loaded. Ports the `StoredFavorite` type of `iptv/favorites.tsx`.
class StoredFavorite {
  const StoredFavorite({
    required this.id,
    required this.name,
    this.logo,
    this.group,
    required this.url,
    this.tvgId,
    required this.sourceId,
  });

  factory StoredFavorite.fromChannel(IptvChannel ch) => StoredFavorite(
    id: ch.id,
    name: ch.name,
    logo: ch.logo,
    group: ch.group,
    url: ch.url,
    tvgId: ch.tvgId,
    sourceId: _sourceOf(ch.id),
  );

  final String id;
  final String name;
  final String? logo;
  final String? group;
  final String url;
  final String? tvgId;
  final String sourceId;
}

/// Persists favorited channels under `harbor.iptv.favorites.v2` (migrating the
/// legacy v1 id-array), matching the web app's keys/shape so state round-trips.
/// Ports the store side of `iptv/favorites.tsx` (React reactivity is provided by
/// the Riverpod controller that wraps this store).
class FavoritesStore {
  FavoritesStore(this._kv);

  final KvStore _kv;
  static const String _key = 'harbor.iptv.favorites.v2';
  static const String _legacyKey = 'harbor.iptv.favorites.v1';
  Map<String, StoredFavorite>? _cache;

  Map<String, StoredFavorite> _load() {
    final cached = _cache;
    if (cached != null) return cached;
    final map = <String, StoredFavorite>{};
    _readV2(map);
    _readLegacy(map);
    return _cache = map;
  }

  void _readV2(Map<String, StoredFavorite> map) {
    final raw = _kv.getString(_key);
    if (raw == null) return;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return;
      for (final e in decoded) {
        if (e is! Map || e['id'] is! String) continue;
        final id = e['id'] as String;
        String? str(Object? v) => v is String ? v : null;
        map[id] = StoredFavorite(
          id: id,
          name: str(e['name']) ?? '',
          logo: str(e['logo']),
          group: str(e['group']),
          url: str(e['url']) ?? '',
          tvgId: str(e['tvgId']),
          sourceId: str(e['sourceId']) ?? _sourceOf(id),
        );
      }
    } catch (_) {}
  }

  // Legacy v1 stored a bare array of channel ids; import those not already in
  // v2 as minimal favorites (hydrated later from their playlists).
  void _readLegacy(Map<String, StoredFavorite> map) {
    final raw = _kv.getString(_legacyKey);
    if (raw == null) return;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return;
      for (final id in decoded) {
        if (id is String && !map.containsKey(id)) {
          map[id] = StoredFavorite(
            id: id,
            name: '',
            url: '',
            sourceId: _sourceOf(id),
          );
        }
      }
    } catch (_) {}
  }

  /// A snapshot of every favorite. Ports the `items` map.
  Map<String, StoredFavorite> items() => Map.unmodifiable(_load());

  /// The favorited channel ids. Ports `ids`.
  Set<String> ids() => _load().keys.toSet();

  /// Whether a channel id is favorited. Ports `has`.
  bool has(String channelId) => _load().containsKey(channelId);

  /// The number of favorites. Ports `count`.
  int get count => _load().length;

  /// Adds or removes a channel from favorites. Ports `toggle`.
  Future<void> toggle(IptvChannel channel) async {
    final next = {..._load()};
    if (next.containsKey(channel.id)) {
      next.remove(channel.id);
    } else {
      next[channel.id] = StoredFavorite.fromChannel(channel);
    }
    await _persist(next);
  }

  /// Fills in metadata (url/logo/…) for favorites that were stored without it
  /// (e.g. migrated legacy ids), from freshly loaded channels. Returns whether
  /// anything changed. Ports `hydrate`.
  Future<bool> hydrate(List<IptvChannel> channels) async {
    final next = {..._load()};
    var changed = false;
    for (final ch in channels) {
      final ex = next[ch.id];
      if (ex != null && ex.url.isEmpty && ch.url.isNotEmpty) {
        next[ch.id] = StoredFavorite.fromChannel(ch);
        changed = true;
      }
    }
    if (changed) await _persist(next);
    return changed;
  }

  /// Drops favorites belonging to a source. Ports `removeForSource`.
  Future<void> removeForSource(String sourceId) async {
    if (sourceId.isEmpty) return;
    final cur = _load();
    final prefix = '$sourceId::';
    var changed = false;
    final next = <String, StoredFavorite>{};
    cur.forEach((id, fav) {
      if (fav.sourceId == sourceId || id.startsWith(prefix)) {
        changed = true;
      } else {
        next[id] = fav;
      }
    });
    if (changed) await _persist(next);
  }

  Future<void> _persist(Map<String, StoredFavorite> next) async {
    _cache = next;
    await _kv.setString(
      _key,
      jsonEncode([for (final f in next.values) _toJson(f)]),
    );
  }

  static Map<String, Object?> _toJson(StoredFavorite f) => {
    'id': f.id,
    'name': f.name,
    'logo': f.logo,
    'group': f.group,
    'url': f.url,
    'tvgId': f.tvgId,
    'sourceId': f.sourceId,
  };
}
