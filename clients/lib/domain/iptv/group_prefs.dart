import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// Per-source group preferences (pinned to the top, or hidden). Ports the
/// `GroupPrefs` type of `iptv/group-order.ts`.
class GroupPrefs {
  const GroupPrefs({this.pinned = const [], this.hidden = const []});
  final List<String> pinned;
  final List<String> hidden;
}

/// Persists per-source group preferences under `harbor.iptv.groupPrefs.v1`,
/// matching the web app's key/shape so state round-trips. Ports the store side
/// of `iptv/group-order.ts` (React reactivity is provided by the Riverpod
/// controller that wraps this store).
class GroupPrefsStore {
  GroupPrefsStore(this._kv);

  final KvStore _kv;
  static const String _key = 'harbor.iptv.groupPrefs.v1';
  Map<String, GroupPrefs>? _cache;

  Map<String, GroupPrefs> _load() {
    final cached = _cache;
    if (cached != null) return cached;
    var map = <String, GroupPrefs>{};
    final raw = _kv.getString(_key);
    if (raw != null) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          map = {
            for (final e in decoded.entries)
              e.key.toString(): _parsePrefs(e.value),
          };
        }
      } catch (_) {}
    }
    return _cache = map;
  }

  static GroupPrefs _parsePrefs(Object? v) {
    if (v is! Map) return const GroupPrefs();
    List<String> arr(Object? x) => x is List
        ? [
            for (final e in x)
              if (e is String) e,
          ]
        : const [];
    return GroupPrefs(pinned: arr(v['pinned']), hidden: arr(v['hidden']));
  }

  /// A snapshot of every source's group preferences.
  Map<String, GroupPrefs> all() => Map.unmodifiable(_load());

  /// The preferences for [sourceId] (empty if none). Ports `useGroupPrefs`.
  GroupPrefs prefsFor(String sourceId) =>
      _load()[sourceId] ?? const GroupPrefs();

  Future<void> _update(
    String sourceId,
    GroupPrefs Function(GroupPrefs) fn,
  ) async {
    if (sourceId.isEmpty) return;
    final map = {..._load()};
    map[sourceId] = fn(map[sourceId] ?? const GroupPrefs());
    await _persist(map);
  }

  /// Pins/unpins a group (and clears its hidden flag). Ports `toggleGroupPin`.
  Future<void> togglePin(String sourceId, String group) => _update(
    sourceId,
    (p) => GroupPrefs(
      pinned: p.pinned.contains(group)
          ? [
              for (final g in p.pinned)
                if (g != group) g,
            ]
          : [...p.pinned, group],
      hidden: [
        for (final g in p.hidden)
          if (g != group) g,
      ],
    ),
  );

  /// Hides/unhides a group (and clears its pinned flag). Ports
  /// `toggleGroupHidden`.
  Future<void> toggleHidden(String sourceId, String group) => _update(
    sourceId,
    (p) => GroupPrefs(
      pinned: [
        for (final g in p.pinned)
          if (g != group) g,
      ],
      hidden: p.hidden.contains(group)
          ? [
              for (final g in p.hidden)
                if (g != group) g,
            ]
          : [...p.hidden, group],
    ),
  );

  /// Clears both lists for a source. Ports `clearGroupPrefs`.
  Future<void> clear(String sourceId) =>
      _update(sourceId, (_) => const GroupPrefs());

  /// Drops a source's entry entirely. Ports `removeGroupPrefs`.
  Future<void> removeForSource(String sourceId) async {
    if (sourceId.isEmpty) return;
    final map = _load();
    if (!map.containsKey(sourceId)) return;
    await _persist({...map}..remove(sourceId));
  }

  Future<void> _persist(Map<String, GroupPrefs> next) async {
    _cache = next;
    await _kv.setString(
      _key,
      jsonEncode({
        for (final e in next.entries)
          e.key: {'pinned': e.value.pinned, 'hidden': e.value.hidden},
      }),
    );
  }
}
