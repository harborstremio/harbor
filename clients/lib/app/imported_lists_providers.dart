import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/addons/models.dart';
import '../domain/lists/imported_lists.dart';
import '../domain/lists/list_types.dart';
import '../domain/lists/resolve.dart';
import '../domain/settings/settings.dart';
import 'iptv_providers.dart' show textTransportProvider;
import 'providers.dart';
import 'trakt_providers.dart' show traktClientProvider;

/// The imported-lists (add-by-URL) state: the saved [lists] and which one is
/// [activeId]. Mirrors the return of the web `useCustomLists` hook.
class ImportedListsState {
  const ImportedListsState({required this.lists, required this.activeId});

  final List<ImportedList> lists;
  final String? activeId;
}

/// Manages the user's imported (add-by-URL) lists, persisted in the
/// `customLists` settings field, with the selected list id kept in the
/// `harbor.lists.active` kv key. Ports `src/views/lists/use-custom-lists.ts`.
///
/// This is deliberately distinct from [CustomListsController] (the manually
/// curated item collections in `harbor.customlists.v1`) — different feature,
/// different storage.
class ImportedListsController extends Notifier<ImportedListsState> {
  static const _activeKey = 'harbor.lists.active';

  @override
  ImportedListsState build() {
    final lists = _readLists(ref.watch(settingsProvider));
    final stored = ref.read(kvStoreProvider).getString(_activeKey);
    return ImportedListsState(
      lists: lists,
      activeId: _effectiveActive(lists, stored),
    );
  }

  List<ImportedList> _readLists(Settings settings) {
    final raw = settings['customLists'];
    if (raw is! List) return const [];
    return [for (final e in raw) ?ImportedList.fromJson(e)];
  }

  /// The stored active id if it still points at a present list; otherwise the
  /// first list (or null when there are none). Mirrors the web fallback effect.
  String? _effectiveActive(List<ImportedList> lists, String? stored) {
    if (lists.isEmpty) return null;
    if (stored != null && lists.any((l) => l.id == stored)) return stored;
    return lists.first.id;
  }

  Future<void> _persist(List<ImportedList> lists) => ref
      .read(settingsProvider.notifier)
      .setValue('customLists', [for (final l in lists) l.toJson()]);

  Future<void> _writeActive(String? id) {
    final kv = ref.read(kvStoreProvider);
    return id == null ? kv.remove(_activeKey) : kv.setString(_activeKey, id);
  }

  /// Selects [id] as the active list.
  Future<void> selectId(String id) async {
    await _writeActive(id);
    state = ImportedListsState(lists: state.lists, activeId: id);
  }

  /// Imports a list from raw [input] (URL/handle). Returns false without
  /// changing anything when the input isn't a recognized list source. The new
  /// list becomes active.
  Future<bool> addList(String input, {String? name}) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final id = 'cl-$now-${Random().nextInt(1000)}';
    final entry = buildImportedList(input, name: name, id: id, addedAt: now);
    if (entry == null) return false;
    await _writeActive(id);
    await _persist([...state.lists, entry]);
    return true;
  }

  /// Re-points the list [id] at [input]. Returns false (no change) when the
  /// input isn't a recognized list source.
  Future<bool> editList(String id, String input, {String? name}) async {
    final next = editImportedList(state.lists, id, input, name: name);
    if (next == null) return false;
    await _persist(next);
    return true;
  }

  /// Removes the list [id], falling the active selection back to the first
  /// remaining list (or none) when the removed list was active.
  Future<void> removeList(String id) async {
    final next = [
      for (final l in state.lists)
        if (l.id != id) l,
    ];
    if (state.activeId == id) {
      await _writeActive(next.isEmpty ? null : next.first.id);
    }
    await _persist(next);
  }
}

final importedListsProvider =
    NotifierProvider<ImportedListsController, ImportedListsState>(
      ImportedListsController.new,
    );

/// The [ListResolver] wired to the app's transports, TMDB/Trakt clients, and
/// the MDBList API key from settings. Recreated when those change so a newly
/// entered key takes effect on the next resolve.
final listResolverProvider = Provider<ListResolver>(
  (ref) => ListResolver(
    jsonTransport: ref.watch(jsonTransportProvider),
    textTransport: ref.watch(textTransportProvider),
    tmdbClient: ref.watch(tmdbClientProvider),
    traktClient: ref.watch(traktClientProvider),
    mdblistKey: ref.watch(settingsProvider).getString('mdblistKey'),
  ),
);

/// Resolves an imported list to its items. A [ListResolveError] surfaces as the
/// provider's error state (the UI switches on its `reason`); a successful
/// resolve yields the deduped, capped items. Mirrors the web `useListItems`
/// (loading / data / error), with Riverpod handling the stale-response guard —
/// it re-resolves whenever the wired [listResolverProvider] changes (a new
/// MDBList/TMDB key, matching the web effect deps).
///
/// Auto-retry is disabled so a failed resolve settles to a stable error state
/// the UI can render immediately (matching the web, which resolves once and
/// exposes a manual refresh) rather than silently retrying with backoff.
final importedListItemsProvider =
    FutureProvider.family<List<MetaPreview>, ImportedList>((ref, list) async {
      final result = await ref.watch(listResolverProvider).resolve(list);
      return result.items;
    }, retry: (_, _) => null);
