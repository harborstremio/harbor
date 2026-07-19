import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// Persists manual EPG overrides (channelId → tvg-id) under
/// `harbor.iptv.epgmap.v1`, matching the web app's key/shape so state
/// round-trips. Ports `iptv/epg-map.ts` (React reactivity is provided by the
/// Riverpod controller that wraps this store).
class EpgOverrideStore {
  EpgOverrideStore(this._kv);

  final KvStore _kv;
  static const String _key = 'harbor.iptv.epgmap.v1';
  Map<String, String>? _cache;

  Map<String, String> _load() {
    final cached = _cache;
    if (cached != null) return cached;
    var map = <String, String>{};
    final raw = _kv.getString(_key);
    if (raw != null) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          map = {
            for (final e in decoded.entries)
              if (e.value is String) e.key.toString(): e.value as String,
          };
        }
      } catch (_) {}
    }
    return _cache = map;
  }

  /// A snapshot of every override. Ports the `load()` result.
  Map<String, String> all() => Map.unmodifiable(_load());

  /// The override tvg-id for [channelId], or null. Ports `getEpgOverride`.
  String? getOverride(String channelId) => _load()[channelId];

  /// Sets (or, for a null/empty [tvgId], clears) a channel's override. Ports
  /// `setEpgOverride`.
  Future<void> setOverride(String channelId, String? tvgId) async {
    final next = {..._load()};
    if (tvgId != null && tvgId.isNotEmpty) {
      next[channelId] = tvgId;
    } else {
      next.remove(channelId);
    }
    await _persist(next);
  }

  /// Drops every override for a source's channels. Ports
  /// `removeEpgOverridesForSource`.
  Future<void> removeForSource(String sourceId) async {
    if (sourceId.isEmpty) return;
    final map = _load();
    final prefix = '$sourceId::';
    var changed = false;
    final next = <String, String>{};
    map.forEach((id, tvgId) {
      if (id.startsWith(prefix)) {
        changed = true;
      } else {
        next[id] = tvgId;
      }
    });
    if (changed) await _persist(next);
  }

  Future<void> _persist(Map<String, String> next) async {
    _cache = next;
    await _kv.setString(_key, jsonEncode(next));
  }
}
