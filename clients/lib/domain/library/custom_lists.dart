import 'dart:convert';

import '../../core/storage/kv_store.dart';

const int kMaxLists = 24;
const int kMaxListItems = 100;

/// A title saved into a custom list, ported from `ListItem`.
class ListItem {
  const ListItem({
    required this.id,
    required this.type,
    required this.name,
    required this.addedAt,
    this.poster,
  });
  final String id;
  final String type; // movie | series
  final String name;
  final int addedAt;
  final String? poster;

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'name': name,
    'addedAt': addedAt,
    if (poster != null) 'poster': poster,
  };
}

/// A user-created list of titles, ported from `CustomList`.
class CustomList {
  const CustomList({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.updatedAt,
    required this.items,
  });
  final String id;
  final String name;
  final int createdAt;
  final int updatedAt;
  final List<ListItem> items;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'createdAt': createdAt,
    'updatedAt': updatedAt,
    'items': [for (final i in items) i.toJson()],
  };
}

String _inferType(String id) =>
    (id.contains(':tv:') || id.contains(':series:')) ? 'series' : 'movie';

String _normalizeType(String? type, String id) {
  if (type == 'series' || type == 'tv') return 'series';
  if (type == 'movie') return 'movie';
  return _inferType(id);
}

/// The local custom-lists store, ported 1:1 from `src/lib/custom-lists.ts`
/// (`harbor.customlists.v1`, ≤24 lists of ≤100 items). Pure local persistence —
/// create / rename / delete lists and add / remove / toggle titles.
class CustomListsStore {
  CustomListsStore(
    this._kv, {
    DateTime Function()? clock,
    String Function()? idGen,
  }) : _clock = clock ?? DateTime.now,
       _idGen = idGen;

  static const _key = 'harbor.customlists.v1';

  final KvStore _kv;
  final DateTime Function() _clock;
  final String Function()? _idGen;
  int _seq = 0;

  int get _now => _clock().millisecondsSinceEpoch;
  String _newId() =>
      _idGen?.call() ?? '${_clock().microsecondsSinceEpoch}-${_seq++}';

  List<CustomList> _read() {
    final raw = _kv.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final arr = jsonDecode(raw);
      if (arr is! List) return [];
      final out = <CustomList>[];
      for (final el in arr) {
        if (el is! Map) continue;
        final id = el['id'];
        final name = el['name'];
        if (id is! String || name is! String) continue;
        final items = <ListItem>[];
        if (el['items'] is List) {
          for (final ri in el['items'] as List) {
            if (ri is! Map || ri['id'] is! String) continue;
            items.add(
              ListItem(
                id: ri['id'] as String,
                type: ri['type'] == 'series' ? 'series' : 'movie',
                name: ri['name'] is String ? ri['name'] as String : '',
                poster: ri['poster'] is String ? ri['poster'] as String : null,
                addedAt: (ri['addedAt'] as num?)?.toInt() ?? 0,
              ),
            );
          }
        }
        out.add(
          CustomList(
            id: id,
            name: name,
            createdAt: (el['createdAt'] as num?)?.toInt() ?? 0,
            updatedAt: (el['updatedAt'] as num?)?.toInt() ?? 0,
            items: items,
          ),
        );
      }
      return out;
    } catch (_) {
      return [];
    }
  }

  Future<void> _write(List<CustomList> lists) =>
      _kv.setString(_key, jsonEncode([for (final l in lists) l.toJson()]));

  /// Lists most-recently-updated first, ported from `readLists`.
  List<CustomList> readLists() =>
      _read()..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

  /// Creates a list, returning its id, or null when the name is empty or the
  /// cap is reached. Ported from `createList`.
  Future<String?> createList(String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return null;
    final lists = _read();
    if (lists.length >= kMaxLists) return null;
    final id = _newId();
    final now = _now;
    lists.add(
      CustomList(
        id: id,
        name: trimmed,
        createdAt: now,
        updatedAt: now,
        items: const [],
      ),
    );
    await _write(lists);
    return id;
  }

  Future<void> renameList(String id, String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    final lists = _read();
    final i = lists.indexWhere((l) => l.id == id);
    if (i < 0) return;
    lists[i] = CustomList(
      id: lists[i].id,
      name: trimmed,
      createdAt: lists[i].createdAt,
      updatedAt: _now,
      items: lists[i].items,
    );
    await _write(lists);
  }

  Future<void> deleteList(String id) async {
    final lists = _read();
    final next = lists.where((l) => l.id != id).toList();
    if (next.length == lists.length) return;
    await _write(next);
  }

  ListItem _toItem(String id, {String? type, String? name, String? poster}) =>
      ListItem(
        id: id,
        type: _normalizeType(type, id),
        name: name ?? '',
        poster: poster,
        addedAt: _now,
      );

  CustomList _withItems(CustomList l, List<ListItem> items) => CustomList(
    id: l.id,
    name: l.name,
    createdAt: l.createdAt,
    updatedAt: _now,
    items: items,
  );

  Future<void> addToList(
    String listId,
    String itemId, {
    String? type,
    String? name,
    String? poster,
  }) async {
    final lists = _read();
    final i = lists.indexWhere((l) => l.id == listId);
    if (i < 0 || lists[i].items.length >= kMaxListItems) return;
    if (lists[i].items.any((it) => it.id == itemId)) return;
    lists[i] = _withItems(lists[i], [
      ...lists[i].items,
      _toItem(itemId, type: type, name: name, poster: poster),
    ]);
    await _write(lists);
  }

  Future<void> removeFromList(String listId, String itemId) async {
    final lists = _read();
    final i = lists.indexWhere((l) => l.id == listId);
    if (i < 0) return;
    final next = lists[i].items.where((it) => it.id != itemId).toList();
    if (next.length == lists[i].items.length) return;
    lists[i] = _withItems(lists[i], next);
    await _write(lists);
  }

  /// Toggles a title in a list, returning whether it is now a member. Ported
  /// from `toggleInList`.
  Future<bool> toggleInList(
    String listId,
    String itemId, {
    String? type,
    String? name,
    String? poster,
  }) async {
    final lists = _read();
    final i = lists.indexWhere((l) => l.id == listId);
    if (i < 0) return false;
    final has = lists[i].items.any((it) => it.id == itemId);
    if (has) {
      lists[i] = _withItems(
        lists[i],
        lists[i].items.where((it) => it.id != itemId).toList(),
      );
      await _write(lists);
      return false;
    }
    if (lists[i].items.length >= kMaxListItems) return false;
    lists[i] = _withItems(lists[i], [
      ...lists[i].items,
      _toItem(itemId, type: type, name: name, poster: poster),
    ]);
    await _write(lists);
    return true;
  }

  /// The ids of the lists containing [itemId], ported from `useListsContaining`.
  Set<String> listsContaining(String? itemId) {
    if (itemId == null) return const {};
    return {
      for (final l in _read())
        if (l.items.any((it) => it.id == itemId)) l.id,
    };
  }
}
