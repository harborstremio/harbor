import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// Per-source selected-country filter. Ports the `CountryPrefs` type of
/// `iptv/country-prefs.ts`.
class CountryPrefs {
  const CountryPrefs({this.selected = const []});
  final List<String> selected;
}

/// Persists per-source country filters under `harbor.iptv.countryPrefs.v1`,
/// matching the web app's key/shape so state round-trips. Ports the store side
/// of `iptv/country-prefs.ts` (React reactivity is provided by the Riverpod
/// controller that wraps this store).
class CountryPrefsStore {
  CountryPrefsStore(this._kv);

  final KvStore _kv;
  static const String _key = 'harbor.iptv.countryPrefs.v1';
  Map<String, CountryPrefs>? _cache;

  Map<String, CountryPrefs> _load() {
    final cached = _cache;
    if (cached != null) return cached;
    var map = <String, CountryPrefs>{};
    final raw = _kv.getString(_key);
    if (raw != null) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          map = {
            for (final e in decoded.entries) e.key.toString(): _parse(e.value),
          };
        }
      } catch (_) {}
    }
    return _cache = map;
  }

  static CountryPrefs _parse(Object? v) {
    if (v is! Map) return const CountryPrefs();
    final sel = v['selected'];
    return CountryPrefs(
      selected: sel is List
          ? [
              for (final e in sel)
                if (e is String) e,
            ]
          : const [],
    );
  }

  /// A snapshot of every source's country filters.
  Map<String, CountryPrefs> all() => Map.unmodifiable(_load());

  /// The country filter for [sourceId] (empty if none). Ports `useCountryPrefs`.
  CountryPrefs prefsFor(String sourceId) =>
      _load()[sourceId] ?? const CountryPrefs();

  Future<void> _update(
    String sourceId,
    CountryPrefs Function(CountryPrefs) fn,
  ) async {
    if (sourceId.isEmpty) return;
    final map = {..._load()};
    map[sourceId] = fn(map[sourceId] ?? const CountryPrefs());
    await _persist(map);
  }

  /// Selects/deselects a country code for a source. Ports `toggleCountry`.
  Future<void> toggle(String sourceId, String code) => _update(
    sourceId,
    (p) => CountryPrefs(
      selected: p.selected.contains(code)
          ? [
              for (final c in p.selected)
                if (c != code) c,
            ]
          : [...p.selected, code],
    ),
  );

  /// Clears the selection for a source. Ports `clearCountries`.
  Future<void> clear(String sourceId) =>
      _update(sourceId, (_) => const CountryPrefs());

  /// Drops a source's entry entirely. Ports `removeCountryPrefs`.
  Future<void> removeForSource(String sourceId) async {
    if (sourceId.isEmpty) return;
    final map = _load();
    if (!map.containsKey(sourceId)) return;
    await _persist({...map}..remove(sourceId));
  }

  Future<void> _persist(Map<String, CountryPrefs> next) async {
    _cache = next;
    await _kv.setString(
      _key,
      jsonEncode({
        for (final e in next.entries) e.key: {'selected': e.value.selected},
      }),
    );
  }
}
