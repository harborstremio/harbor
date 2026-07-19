import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/pinned_catalogs_provider.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_row.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/catalog_browse.dart';
import '../../domain/home/pinned_catalogs.dart';
import '../../domain/nav/frame.dart';

/// The Catalogs view — every browsable catalog declared by the installed
/// add-ons, one shelf per catalog, with a content-type filter. Ported from the
/// web `catalogs.tsx` browse surface (`10-pages.md`).
class CatalogsView extends ConsumerStatefulWidget {
  const CatalogsView({super.key});

  @override
  ConsumerState<CatalogsView> createState() => _CatalogsViewState();
}

class _CatalogsViewState extends ConsumerState<CatalogsView> {
  String _typeFilter = 'all';
  bool _customize = false;

  static const _typeLabels = {
    'movie': 'Movies',
    'series': 'Series',
    'anime': 'Anime',
    'tv': 'TV',
    'channel': 'Channels',
  };

  String _label(String type) => _typeLabels[type] ?? _cap(type);
  String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  List<String> get _pinned =>
      ref.watch(settingsProvider).getStringList('catalogsPinned');
  Set<String> get _hidden =>
      ref.watch(settingsProvider).getStringList('catalogsHidden').toSet();

  Future<void> _setPinned(List<String> next) =>
      ref.read(settingsProvider.notifier).setValue('catalogsPinned', next);
  Future<void> _setHidden(List<String> next) =>
      ref.read(settingsProvider.notifier).setValue('catalogsHidden', next);

  void _togglePin(String key) {
    final list = [..._pinned];
    list.contains(key) ? list.remove(key) : list.add(key);
    _setPinned(list);
  }

  void _toggleHide(String key) {
    final list = _hidden.toList();
    list.contains(key) ? list.remove(key) : list.add(key);
    _setHidden(list);
  }

  void _movePin(String key, int delta) {
    final list = [..._pinned];
    final i = list.indexOf(key);
    final j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    final tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    _setPinned(list);
  }

  /// Type-filtered catalogs ordered pinned-first (in pin order), hidden removed.
  List<BrowseCatalog> _forBrowse(List<BrowseCatalog> all) {
    final pinnedOrder = _pinned;
    final hidden = _hidden;
    final visible = [
      for (final c in all)
        if (!hidden.contains(c.key) &&
            (_typeFilter == 'all' || c.type == _typeFilter))
          c,
    ];
    int rank(BrowseCatalog c) {
      final i = pinnedOrder.indexOf(c.key);
      return i < 0 ? pinnedOrder.length : i;
    }

    final indexed = [for (var i = 0; i < visible.length; i++) (i, visible[i])];
    indexed.sort((a, b) {
      final r = rank(a.$2).compareTo(rank(b.$2));
      return r != 0 ? r : a.$1.compareTo(b.$1);
    });
    return [for (final e in indexed) e.$2];
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final all = ref.watch(browseCatalogsProvider);
    final types = <String>{for (final c in all) c.type}.toList()..sort();
    final g = pageGutter(Idiom.of(context));

    return Container(
      color: t.canvas,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _header(t, types, g),
            Expanded(
              child: all.isEmpty
                  ? _empty(t)
                  : _customize
                  ? _ManageList(
                      catalogs: all,
                      pinned: _pinned,
                      hidden: _hidden,
                      tokens: t,
                      gutter: g,
                      onTogglePin: _togglePin,
                      onToggleHide: _toggleHide,
                      onMovePin: _movePin,
                    )
                  : _browseList(t, _forBrowse(all)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _browseList(HarborTokens t, List<BrowseCatalog> catalogs) =>
      ListView.builder(
        padding: const EdgeInsets.only(bottom: 24),
        itemCount: catalogs.length,
        itemBuilder: (context, i) => _Shelf(catalog: catalogs[i], tokens: t),
      );

  Widget _header(HarborTokens t, List<String> types, double g) => Padding(
    padding: EdgeInsets.fromLTRB(g, 28, g, 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'BROWSE',
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 3,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Text(
                'Catalogs',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 34,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            _pill(
              t,
              _customize ? 'Done' : 'Customize',
              _customize,
              Icons.tune,
              () => setState(() => _customize = !_customize),
            ),
          ],
        ),
        if (!_customize && types.length > 1) ...[
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _typeChip(t, 'all', 'All'),
                for (final type in types) ...[
                  const SizedBox(width: 8),
                  _typeChip(t, type, _label(type)),
                ],
              ],
            ),
          ),
        ],
      ],
    ),
  );

  Widget _typeChip(HarborTokens t, String type, String label) {
    final active = _typeFilter == type;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      // Land the remote on the active type chip when Catalogs opens so a TV
      // session has a visible target (it has no hero to autofocus). First mount
      // only.
      autofocus: active,
      onPressed: () => setState(() => _typeFilter = type),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? t.ink : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? t.ink : t.edgeSoft),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? t.canvas : t.inkMuted,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _pill(
    HarborTokens t,
    String label,
    bool active,
    IconData icon,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: active ? t.ink : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: active ? t.ink : t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: active ? t.canvas : t.inkMuted),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: active ? t.canvas : t.inkMuted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _empty(HarborTokens t) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.grid_view_outlined, size: 52, color: t.inkSubtle),
          const SizedBox(height: 16),
          Text(
            'No catalogs yet — install add-ons to browse.',
            style: TextStyle(color: t.inkMuted, fontSize: 15),
          ),
        ],
      ),
    ),
  );
}

/// The customize mode — a flat list of every catalog with pin / hide / reorder
/// controls. Ported from `catalogs/catalog-manage-list.tsx`.
class _ManageList extends StatelessWidget {
  const _ManageList({
    required this.catalogs,
    required this.pinned,
    required this.hidden,
    required this.tokens,
    required this.gutter,
    required this.onTogglePin,
    required this.onToggleHide,
    required this.onMovePin,
  });

  final List<BrowseCatalog> catalogs;
  final List<String> pinned;
  final Set<String> hidden;
  final HarborTokens tokens;
  final double gutter;
  final void Function(String key) onTogglePin;
  final void Function(String key) onToggleHide;
  final void Function(String key, int delta) onMovePin;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    // Pinned (in order) first, then the rest in their natural order.
    final ordered = [
      for (final key in pinned) ...catalogs.where((c) => c.key == key),
      for (final c in catalogs)
        if (!pinned.contains(c.key)) c,
    ];
    return ListView.separated(
      padding: EdgeInsets.fromLTRB(gutter, 8, gutter, 24),
      itemCount: ordered.length,
      separatorBuilder: (_, _) => const SizedBox(height: 6),
      itemBuilder: (context, i) {
        final c = ordered[i];
        final isPinned = pinned.contains(c.key);
        final isHidden = hidden.contains(c.key);
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: t.elevated.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              Expanded(
                child: Opacity(
                  opacity: isHidden ? 0.5 : 1,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        c.addonName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: t.inkSubtle, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
              if (isPinned) ...[
                _iconBtn(t, Icons.keyboard_arrow_up, 'Move up', () {
                  onMovePin(c.key, -1);
                }),
                _iconBtn(t, Icons.keyboard_arrow_down, 'Move down', () {
                  onMovePin(c.key, 1);
                }),
              ],
              _iconBtn(
                t,
                isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                isPinned ? 'Unpin' : 'Pin',
                () => onTogglePin(c.key),
                accent: isPinned,
              ),
              _iconBtn(
                t,
                isHidden ? Icons.visibility_off : Icons.visibility_outlined,
                isHidden ? 'Show' : 'Hide',
                () => onToggleHide(c.key),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _iconBtn(
    HarborTokens t,
    IconData icon,
    String label,
    VoidCallback onTap, {
    bool accent = false,
  }) => Padding(
    padding: const EdgeInsets.only(left: 6),
    child: Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      onPressed: onTap,
      child: Container(
        width: 36,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: accent ? t.accent : t.edge),
        ),
        child: Icon(
          icon,
          size: 17,
          color: accent ? t.accent : t.inkMuted,
          semanticLabel: label,
        ),
      ),
    ),
  );
}

/// One catalog shelf — a horizontal rail that lazily fetches its items and
/// collapses to nothing while loading or when empty.
class _Shelf extends ConsumerWidget {
  const _Shelf({required this.catalog, required this.tokens});

  final BrowseCatalog catalog;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref
        .watch(
          browseCatalogItemsProvider((
            base: catalog.base,
            type: catalog.type,
            id: catalog.id,
          )),
        )
        .asData
        ?.value;
    if (items == null || items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: TvRow(
        title: '${catalog.name} · ${catalog.addonName}',
        items: items,
        tokens: tokens,
        trailing: _PinButton(
          desc: PinnedCatalog(
            id: '${catalog.base}::${catalog.type}::${catalog.id}',
            source: 'catalog',
            name: catalog.name,
            params: {
              'base': catalog.base,
              'type': catalog.type,
              'id': catalog.id,
            },
          ),
          tokens: tokens,
        ),
        onSelect: (item) => ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.meta, {'type': item.type, 'id': item.id})),
      ),
    );
  }
}

/// A Pin-to-Home toggle for a browse catalog shelf (web `PinHomeButton`) — adds
/// or removes the catalog from the pinned Home rails.
class _PinButton extends ConsumerWidget {
  const _PinButton({required this.desc, required this.tokens});

  final PinnedCatalog desc;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pinned = ref
        .watch(pinnedCatalogsProvider)
        .any((c) => c.id == desc.id);
    final tr = ref.watch(translationsProvider);
    return Focusable(
      tokens: tokens,
      scale: 1.0,
      borderRadius: 8,
      onPressed: () => ref.read(pinnedCatalogsProvider.notifier).toggle(desc),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              pinned ? Icons.home_filled : Icons.add_home_outlined,
              size: 14,
              color: pinned ? tokens.accent : tokens.inkMuted,
            ),
            const SizedBox(width: 4),
            Text(
              tr.t(pinned ? 'On Home' : 'Add to Home'),
              style: TextStyle(
                color: pinned ? tokens.accent : tokens.inkMuted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
