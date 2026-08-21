import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// Persists the pinned-channel order under `harbor.iptv.pins.v1`, matching the
/// web app's key/shape so state round-trips. Ports `iptv/pins.ts` (React
/// reactivity is provided by the Riverpod controller that wraps this store).
class ChannelPinsStore {
  ChannelPinsStore(this._kv);

  final KvStore _kv;
  static const String _key = 'harbor.iptv.pins.v1';
  List<String>? _cache;

  List<String> _load() {
    final cached = _cache;
    if (cached != null) return cached;
    var list = <String>[];
    final raw = _kv.getString(_key);
    if (raw != null) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          list = [
            for (final x in decoded)
              if (x is String) x,
          ];
        }
      } catch (_) {}
    }
    return _cache = list;
  }

  /// The pinned channel ids, in order. Ports the `load()`/`usePinnedOrder`
  /// result.
  List<String> pins() => List.unmodifiable(_load());

  /// Whether [channelId] is pinned. Ports `isPinned`.
  bool isPinned(String channelId) => _load().contains(channelId);

  /// Pins or unpins a channel. Ports `togglePin`.
  Future<void> toggle(String channelId) async {
    final cur = _load();
    if (cur.contains(channelId)) {
      await _persist([
        for (final id in cur)
          if (id != channelId) id,
      ]);
    } else {
      await _persist([...cur, channelId]);
    }
  }

  /// Removes every pin. Ports `clearPins`.
  Future<void> clear() => _persist(const []);

  /// Drops pins belonging to a source's channels. Ports `removePinsForSource`.
  Future<void> removeForSource(String sourceId) async {
    if (sourceId.isEmpty) return;
    final cur = _load();
    final prefix = '$sourceId::';
    final next = [
      for (final id in cur)
        if (!id.startsWith(prefix)) id,
    ];
    if (next.length != cur.length) await _persist(next);
  }

  Future<void> _persist(List<String> next) async {
    _cache = next;
    await _kv.setString(_key, jsonEncode(next));
  }
}
