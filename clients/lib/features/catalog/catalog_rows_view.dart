import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/stremboxd_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_row.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/catalog_row.dart';
import '../../domain/catalog/show_hero_copy.dart';
import '../../domain/home/home_customization.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';
import '../home/hero_carousel.dart';
import '../home/home_edit_controls.dart';
import 'catalog_customize_bar.dart';

/// The Movies / Shows tab, ported from `movies.tsx` / `shows.tsx`: a hero
/// carousel over the catalog's hero pool, then the curated rows (TMDB specs when
/// keyed, Cinemeta genre rows when keyless), a Letterboxd strip on Movies, and a
/// Customize mode that reorders / hides / renames the curated rows (persisted
/// per tab, `usePageRows("movies"|"shows")`).
class CatalogRowsView extends ConsumerStatefulWidget {
  const CatalogRowsView({super.key, required this.type});

  /// `movie` or `series`.
  final String type;

  @override
  ConsumerState<CatalogRowsView> createState() => _CatalogRowsViewState();
}

class _CatalogRowsViewState extends ConsumerState<CatalogRowsView> {
  bool _editMode = false;

  bool get _isSeries => widget.type == 'series';
  String get _customKey => _isSeries ? 'showsRows' : 'moviesRows';

  void _persist(HomeRowCustomization next) =>
      ref.read(settingsProvider.notifier).setValue(_customKey, next.toMap());

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final settings = ref.watch(settingsProvider);
    final custom = HomeRowCustomization.fromMap(settings.getMap(_customKey));
    final async = ref.watch(
      _isSeries ? showCatalogProvider : movieCatalogProvider,
    );
    final heroSource = _isSeries
        ? showCatalogHeroProvider
        : movieCatalogHeroProvider;

    return Scaffold(
      body: SafeArea(
        child: async.when(
          loading: () => Center(
            child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
          ),
          error: (_, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Could not load this catalog.',
                  style: TextStyle(color: t.inkMuted, fontSize: 16),
                ),
                const SizedBox(height: 16),
                Focusable(
                  tokens: t,
                  autofocus: true,
                  borderRadius: 999,
                  onPressed: () => ref.invalidate(
                    _isSeries ? showCatalogProvider : movieCatalogProvider,
                  ),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 22,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: t.raised,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('Retry', style: TextStyle(color: t.ink)),
                  ),
                ),
              ],
            ),
          ),
          data: (catalog) {
            // The curated rows with the user's reorder / hide / rename applied
            // (hidden kept but greyed in edit mode).
            final curated = applyHomeRowCustomization(
              catalog.rows,
              custom,
              includeHidden: _editMode,
            );
            // The user's Letterboxd-bridged catalogs (amber chip), Movies only.
            final lbRows = _isSeries
                ? const <CatalogRow>[]
                : [
                    for (final r
                        in ref.watch(letterboxdHomeRowsProvider).value ??
                            const <CatalogRow>[])
                      if (r.items.isNotEmpty) r,
                  ];
            final hasChanges =
                custom.order.isNotEmpty ||
                custom.hidden.isNotEmpty ||
                custom.renamed.isNotEmpty ||
                custom.numerals.isNotEmpty;
            if (curated.isEmpty && lbRows.isEmpty && !_editMode) {
              return Center(
                child: Text(
                  'Nothing here yet.',
                  style: TextStyle(color: t.inkMuted, fontSize: 16),
                ),
              );
            }
            final hasHero = catalog.hero.isNotEmpty;
            void open(item) => ref
                .read(navControllerProvider.notifier)
                .push(Frame(FrameKind.meta, {'type': item.type, 'id': item.id}));

            // [customize bar, hero?, ...letterboxd rows, ...curated rows].
            final preCount = 1 + (hasHero ? 1 : 0);
            return ListView.separated(
              padding: const EdgeInsets.only(bottom: 24),
              itemCount: preCount + lbRows.length + curated.length,
              separatorBuilder: (_, i) =>
                  SizedBox(height: i == 0 ? 20 : 28),
              itemBuilder: (context, i) {
                if (i == 0) {
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: CatalogCustomizeBar(
                        tokens: t,
                        tr: tr,
                        editMode: _editMode,
                        hasChanges: hasChanges,
                        onToggle: () => setState(() => _editMode = !_editMode),
                        onReset: () => _persist(resetHomeRows()),
                      ),
                    ),
                  );
                }
                if (hasHero && i == 1) {
                  // Shows uses the day-bucketed kicker (web PeekHero /
                  // bucketCopy); Movies a fixed "Featured tonight" (CinemaHero).
                  return HeroCarousel(
                    source: heroSource,
                    eyebrow: _isSeries
                        ? showHeroKicker()
                        : tr.t('Featured tonight'),
                  );
                }
                final bodyIndex = i - preCount;
                if (bodyIndex < lbRows.length) {
                  final row = lbRows[bodyIndex];
                  return TvRow(
                    title: row.title,
                    items: row.items,
                    tokens: t,
                    sourceBadge: 'Letterboxd',
                    autofocusFirst: !hasHero && !_editMode && bodyIndex == 0,
                    onSelect: open,
                  );
                }
                final ci = bodyIndex - lbRows.length;
                return _curatedRow(
                  curated[ci],
                  ci,
                  curated.length,
                  custom,
                  catalog.rows,
                  t,
                  tr,
                  open,
                  autofocus:
                      !hasHero && lbRows.isEmpty && !_editMode && ci == 0,
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _curatedRow(
    CatalogRow row,
    int index,
    int total,
    HomeRowCustomization custom,
    List<CatalogRow> allRows,
    HarborTokens t,
    Translations tr,
    void Function(dynamic) open, {
    required bool autofocus,
  }) {
    final key = row.key;
    final hidden = key != null && custom.hidden.contains(key);
    final rowWidget = TvRow(
      title: row.title,
      items: row.items,
      tokens: t,
      autofocusFirst: autofocus,
      onSelect: open,
    );
    if (!_editMode) return rowWidget;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: HomeRowControls(
            tokens: t,
            tr: tr,
            name: row.title,
            hidden: hidden,
            canMoveUp: index > 0,
            canMoveDown: index < total - 1,
            isRenamed: key != null && custom.renamed.containsKey(key),
            numeralsActive: false,
            canNumerals: false,
            heroActive: false,
            canHero: false,
            onMoveUp: key == null
                ? () {}
                : () => _persist(moveHomeRow(custom, allRows, key, -1)),
            onMoveDown: key == null
                ? () {}
                : () => _persist(moveHomeRow(custom, allRows, key, 1)),
            onToggleHidden: key == null
                ? () {}
                : () => _persist(toggleHomeRowHidden(custom, key)),
            onRename: key == null
                ? (_) {}
                : (label) => _persist(renameHomeRow(custom, key, label)),
            onResetName: key == null
                ? () {}
                : () => _persist(renameHomeRow(custom, key, '')),
            onToggleNumerals: () {},
            onToggleHero: () {},
          ),
        ),
        const SizedBox(height: 6),
        Opacity(
          opacity: hidden ? 0.4 : 1,
          child: IgnorePointer(ignoring: hidden, child: rowWidget),
        ),
      ],
    );
  }
}
