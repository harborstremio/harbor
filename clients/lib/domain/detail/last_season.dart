import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// Persists the last-viewed season per series so reopening a series lands on the
/// season you were browsing rather than resetting to the first. Ported 1:1 from
/// `src/lib/last-season.ts` (`harbor.lastseason.v1` → `{ "<metaId>": season }`).
class LastSeasonStore {
  LastSeasonStore(this._kv);

  static const _key = 'harbor.lastseason.v1';

  final KvStore _kv;

  Map<String, dynamic> _load() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return {};
    try {
      final p = jsonDecode(raw);
      return p is Map ? p.cast<String, dynamic>() : {};
    } catch (_) {
      return {};
    }
  }

  /// The saved season number for [metaId], or null when none is stored.
  int? getLastSeason(String metaId) {
    final v = _load()[metaId];
    return v is num ? v.toInt() : null;
  }

  Future<void> setLastSeason(String metaId, int season) async {
    final map = _load();
    map[metaId] = season;
    await _kv.setString(_key, jsonEncode(map));
  }
}
