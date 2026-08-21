import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/catalog/catalog_row.dart';
import '../domain/home/pinned_catalogs.dart';
import 'providers.dart';

/// The pinned-catalogs store (`harbor.pinnedcatalogs.v1`).
final pinnedCatalogsStoreProvider = Provider<PinnedCatalogsStore>(
  (ref) => PinnedCatalogsStore(ref.watch(kvStoreProvider)),
);

/// The reactive list of pinned catalogs, with pin/unpin/toggle actions.
class PinnedCatalogsController extends Notifier<List<PinnedCatalog>> {
  PinnedCatalogsStore get _store => ref.read(pinnedCatalogsStoreProvider);

  @override
  List<PinnedCatalog> build() => _store.read();

  bool isPinned(String id) => state.any((c) => c.id == id);

  Future<bool> toggle(PinnedCatalog desc) async {
    final now = await _store.toggle(desc);
    state = _store.read();
    return now;
  }

  Future<void> unpin(String id) async {
    await _store.unpin(id);
    state = _store.read();
  }
}

final pinnedCatalogsProvider =
    NotifierProvider<PinnedCatalogsController, List<PinnedCatalog>>(
      PinnedCatalogsController.new,
    );

/// Max posters kept per pinned catalog row (web `MAX_PER_ROW`).
const int _maxPerRow = 30;

/// The resolved Home rows for `catalog`-source pins — each descriptor's
/// `{base, type, id}` fetched as an addon catalog. Ports web
/// `buildPinnedCatalogRows`; a pin with no results is dropped. The anilist / mal
/// / simkl pin sources need the anime-rail infra and are not rendered yet.
final pinnedCatalogRowsProvider = FutureProvider<List<CatalogRow>>((ref) async {
  final pins = ref
      .watch(pinnedCatalogsProvider)
      .where((p) => p.source == 'catalog')
      .toList();
  if (pins.isEmpty) return const [];
  final addon = ref.watch(addonClientProvider);
  final rows = await Future.wait(
    pins.map((p) async {
      final base = p.params['base'];
      final type = p.params['type'];
      final id = p.params['id'];
      if (base == null || type == null || id == null) return null;
      final metas =
          (await addon.catalog(base, type, id)).valueOrNull ?? const [];
      if (metas.isEmpty) return null;
      return CatalogRow(
        key: pinnedRowKey(p.id),
        title: p.name,
        type: type == 'movie' ? 'movie' : 'series',
        id: pinnedRowKey(p.id),
        items: metas.take(_maxPerRow).toList(),
        noDedup: true,
      );
    }),
  );
  return [for (final r in rows) ?r];
});
