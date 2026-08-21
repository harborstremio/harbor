import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// A pinned-catalog descriptor, ported from the web `PinnedCatalog`. [source] is
/// one of `catalog` | `anilist` | `simkl` | `mal`; a `catalog` pin resolves its
/// row from [params] `{base, type, id}` (an addon catalog). The other sources
/// need the anime-rail infrastructure and are stored but not yet rendered.
class PinnedCatalog {
  const PinnedCatalog({
    required this.id,
    required this.source,
    required this.name,
    this.params = const {},
  });

  final String id;
  final String source;
  final String name;
  final Map<String, String> params;

  static const sources = {'catalog', 'anilist', 'simkl', 'mal'};

  Map<String, dynamic> toJson() => {
    'id': id,
    'source': source,
    'name': name,
    'params': params,
  };

  static PinnedCatalog? fromJson(Object? j) {
    if (j is! Map) return null;
    final id = j['id'];
    final name = j['name'];
    final source = j['source'];
    if (id is! String || name is! String) return null;
    if (source is! String || !sources.contains(source)) return null;
    final p = j['params'];
    return PinnedCatalog(
      id: id,
      source: source,
      name: name,
      params: p is Map
          ? {
              for (final e in p.entries)
                if (e.value != null) e.key.toString(): e.value.toString(),
            }
          : const {},
    );
  }
}

/// The pinned-catalogs store — ported 1:1 from web `pinned-catalogs.ts`
/// (`harbor.pinnedcatalogs.v1`, cap 12, id-deduped, first-wins).
class PinnedCatalogsStore {
  PinnedCatalogsStore(this._kv);

  static const _key = 'harbor.pinnedcatalogs.v1';
  static const cap = 12;

  final KvStore _kv;

  List<PinnedCatalog> read() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final p = jsonDecode(raw);
      if (p is! List) return const [];
      final out = [for (final e in p) ?PinnedCatalog.fromJson(e)];
      return out.length > cap ? out.sublist(0, cap) : out;
    } catch (_) {
      return const [];
    }
  }

  bool isPinned(String id) => read().any((c) => c.id == id);

  int count() => read().length;

  Future<void> _commit(List<PinnedCatalog> next) async {
    final capped = next.length > cap ? next.sublist(0, cap) : next;
    await _kv.setString(_key, jsonEncode([for (final c in capped) c.toJson()]));
  }

  /// Adds [desc]; a no-op returning true if already pinned, false if the cap is
  /// reached (web `pinCatalog`).
  Future<bool> pin(PinnedCatalog desc) async {
    final cur = read();
    if (cur.any((c) => c.id == desc.id)) return true;
    if (cur.length >= cap) return false;
    await _commit([...cur, desc]);
    return true;
  }

  Future<void> unpin(String id) async {
    final cur = read();
    if (!cur.any((c) => c.id == id)) return;
    await _commit([
      for (final c in cur)
        if (c.id != id) c,
    ]);
  }

  /// Flips [desc]'s pinned state — returns the new pinned state (web `toggle`).
  Future<bool> toggle(PinnedCatalog desc) async {
    if (isPinned(desc.id)) {
      await unpin(desc.id);
      return false;
    }
    return pin(desc);
  }
}

/// The Home row key for a pinned catalog (web `pinnedRowKey`).
String pinnedRowKey(String id) => 'pinned:$id';
