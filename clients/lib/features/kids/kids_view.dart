import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/kids_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/back_to_top.dart';
import '../../design/focus/tv_row.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/catalog_row.dart';
import '../../domain/catalog/kids_catalog.dart' show kidsVisibleRows;
import '../../domain/home/home_customization.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';
import '../catalog/catalog_customize_bar.dart';
import '../home/home_edit_controls.dart';
import '../home/tmdb_nudge.dart';
import 'kids_doodles.dart';
import 'kids_franchise_rail.dart';
import 'kids_hero.dart';

/// The Kids tab — the native port of `kids.tsx`: the themed hero, the doodle
/// backdrop, the kid-safe catalog rows, the "Pick a World" franchise rail
/// injected after the second row (with a TMDB key), the add-a-key nudge and the
/// back-to-top affordance. Backed by [kidsCatalogProvider] (keyed TMDB → keyless
/// Cinemeta).
class KidsView extends ConsumerStatefulWidget {
  const KidsView({super.key});

  @override
  ConsumerState<KidsView> createState() => _KidsViewState();
}

class _KidsViewState extends ConsumerState<KidsView> {
  final ScrollController _scroll = ScrollController();
  bool _editMode = false;

  static const _customKey = 'kidsRows';

  HomeRowCustomization get _custom =>
      HomeRowCustomization.fromMap(ref.read(settingsProvider).getMap(_customKey));

  void _persist(HomeRowCustomization next) {
    ref.read(settingsProvider.notifier).setValue(_customKey, next.toMap());
    setState(() {});
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final hasKey = ref.watch(settingsProvider).tmdbKey.isNotEmpty;
    final catalog = ref.watch(kidsCatalogProvider);
    return Container(
      color: t.canvas,
      child: catalog.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
        ),
        error: (_, _) => _message(t, 'Could not load kids picks.'),
        data: (home) {
          final rows = kidsVisibleRows(home.hero, home.rows);
          if (home.hero.isEmpty && rows.isEmpty) {
            return _message(t, 'Nothing here yet!');
          }
          // Web shows the add-a-key nudge whenever there's no TMDB key; the
          // shared gate also respects a prior dismissal.
          final showNudge = shouldShowTmdbNudge(ref, suppress: false);
          return BackToTopOverlay(
            controller: _scroll,
            child: CustomScrollView(
              controller: _scroll,
              slivers: [
                if (home.hero.isNotEmpty)
                  SliverToBoxAdapter(
                    child: KidsHero(featured: home.hero, tokens: t),
                  ),
                if (showNudge)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(16, 4, 16, 0),
                      child: TmdbNudge(),
                    ),
                  ),
                SliverToBoxAdapter(
                  child: _rowsSection(
                    context,
                    ref,
                    rows,
                    t,
                    hasKey,
                    autofocusFirstRow: home.hero.isEmpty,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _rowsSection(
    BuildContext context,
    WidgetRef ref,
    List<CatalogRow> rows,
    HarborTokens t,
    bool hasKey, {
    bool autofocusFirstRow = false,
  }) {
    final tr = ref.watch(translationsProvider);
    final custom = _custom;
    // Reorder / rename / hide the kid-safe rows (web `applyPageRows`); hidden
    // rows are kept greyed in edit mode, dropped otherwise.
    final curated = applyHomeRowCustomization(
      rows,
      custom,
      includeHidden: _editMode,
    );
    final hasChanges =
        custom.order.isNotEmpty ||
        custom.hidden.isNotEmpty ||
        custom.renamed.isNotEmpty;

    final blocks = <Widget>[
      // The Customize / Done (+ Reset) bar (web CatalogCustomizeBar kids).
      Padding(
        padding: const EdgeInsets.only(left: 20, bottom: 2),
        child: CatalogCustomizeBar(
          editMode: _editMode,
          hasChanges: hasChanges,
          onToggle: () => setState(() => _editMode = !_editMode),
          onReset: () => _persist(resetHomeRows()),
          tokens: t,
          tr: tr,
        ),
      ),
    ];
    var railInjected = false;
    for (var i = 0; i < curated.length; i++) {
      blocks.add(
        _kidsRowBlock(
          curated[i],
          rows,
          custom,
          tr,
          t,
          i,
          curated.length,
          // When there's no hero to focus, land the remote on the first row
          // (but not while editing — the customize controls take focus then).
          autofocus: autofocusFirstRow && !_editMode && i == 0,
        ),
      );
      // The franchise rail rides after the second row, with a key (the web
      // injectAfter=2, injectNode gated on the TMDB key).
      if (i == 1 && hasKey) {
        blocks.add(const KidsFranchiseRail());
        railInjected = true;
      }
    }
    if (!railInjected && hasKey) blocks.add(const KidsFranchiseRail());

    return Stack(
      children: [
        Positioned.fill(child: const KidsDoodles()),
        Padding(
          padding: const EdgeInsets.only(top: 10, bottom: 56),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < blocks.length; i++) ...[
                if (i > 0) const SizedBox(height: 22),
                blocks[i],
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// One kid-safe row, wrapped with the reorder/hide/rename controls while in
  /// edit mode (mirrors `catalog_rows_view._row`; kids expose only move/hide/
  /// rename — no Top-10 numerals or hero-source, matching web's kids RowControls).
  Widget _kidsRowBlock(
    CatalogRow row,
    List<CatalogRow> allRows,
    HomeRowCustomization custom,
    Translations tr,
    HarborTokens t,
    int index,
    int total, {
    bool autofocus = false,
  }) {
    final key = row.key;
    final hidden = key != null && custom.hidden.contains(key);
    final rowWidget = TvRow(
      title: row.title,
      items: row.items,
      tokens: t,
      kids: true,
      autofocusFirst: autofocus,
      onSelect: (item) => ref
          .read(navControllerProvider.notifier)
          .push(Frame(FrameKind.meta, {'type': item.type, 'id': item.id})),
    );
    if (!_editMode) return rowWidget;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 20),
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

  Widget _message(HarborTokens t, String text) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset('assets/kids/doodles/lilpurpocto.png', height: 88),
          const SizedBox(height: 14),
          Text(
            text,
            style: TextStyle(
              color: t.ink,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
