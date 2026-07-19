import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/feed_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/stremboxd_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_row.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/addons/models.dart';
import '../../domain/feed/daily_rows.dart';
import '../../domain/nav/frame.dart';
import '../catalog/catalog_customize_bar.dart';
import '../home/hero_carousel.dart';
import 'award_tiles.dart';
import 'critics_pick.dart';
import 'discovery_queue_cta.dart';
import 'genre_tiles.dart';
import 'language_tiles.dart';
import 'surprise_me.dart';
import '../../design/back_to_top.dart';

/// The Discover view — the featured hero over the day's taste-driven rails.
/// Ported from `discover.tsx`; the interleaved tile and inline sections land on
/// top of this rail body.
class DiscoverView extends ConsumerStatefulWidget {
  const DiscoverView({super.key});

  @override
  ConsumerState<DiscoverView> createState() => _DiscoverViewState();
}

class _DiscoverViewState extends ConsumerState<DiscoverView> {
  final ScrollController _scrollController = ScrollController();
  bool _editMode = false;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final rails = ref.watch(dailyRailsProvider);
    final pool = ref.watch(feedPoolProvider).value;
    final hidden = ref.watch(discoverHiddenSectionsProvider);
    final g = pageGutter(Idiom.of(context));
    // The user's Letterboxd-bridged catalogs (when Letterboxd is active), with
    // the amber source chip — 1:1 with `letterboxdRows` on web Discover, and
    // the same rows Home surfaces. Sit between the surprise section and the
    // taste rails.
    final lbRows = ref.watch(letterboxdHomeRowsProvider).value ?? const [];
    return Container(
      color: t.canvas,
      child: BackToTopOverlay(
        controller: _scrollController,
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            // The customize bar (Customize / Done + Reset), ported from the web
            // Discover CatalogCustomizeBar.
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(g, 12, g, 0),
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: CatalogCustomizeBar(
                    tokens: t,
                    tr: tr,
                    editMode: _editMode,
                    hasChanges: hidden.isNotEmpty,
                    onToggle: () => setState(() => _editMode = !_editMode),
                    onReset: () => ref
                        .read(discoverHiddenSectionsProvider.notifier)
                        .reset(),
                  ),
                ),
              ),
            ),
            _section(
              key: 'section-featured',
              name: tr.t('Featured & Recommended'),
              hidden: hidden.contains('section-featured'),
              t: t,
              tr: tr,
              child: HeroCarousel(source: featuredHeroSlidesProvider),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
            if (pool != null && pool.isNotEmpty)
              _section(
                key: 'section-surprise',
                name: tr.t("Can't decide?"),
                hidden: hidden.contains('section-surprise'),
                t: t,
                tr: tr,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(g, 0, g, 28),
                  child: SurpriseMe(
                    pool: [for (final f in pool) f.meta],
                    tokens: t,
                  ),
                ),
              ),
            if (lbRows.isNotEmpty)
              SliverList.list(
                children: [
                  for (final row in lbRows)
                    if (row.items.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: TvRow(
                          title: row.title,
                          items: row.items,
                          tokens: t,
                          sourceBadge: 'Letterboxd',
                          onSelect: (m) => ref
                              .read(navControllerProvider.notifier)
                              .push(
                                Frame(FrameKind.meta, {
                                  'type': m.type,
                                  'id': m.id,
                                }),
                              ),
                        ),
                      ),
                ],
              ),
            ...rails.when(
              loading: () => [
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 80),
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
              ],
              error: (_, _) => [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 80),
                    child: Center(
                      child: Text(
                        "Couldn't load Discover. Check your connection and try "
                        'again.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13.5, color: t.inkMuted),
                      ),
                    ),
                  ),
                ),
              ],
              data: (list) => [
                SliverList.list(children: _interleaved(list, t)),
                const SliverToBoxAdapter(child: SizedBox(height: 40)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Wraps a Discover section (the featured hero, the surprise panel) as a
  /// sliver that is: shown normally; omitted when hidden and not editing; or
  /// prefixed with a [_DiscoverSectionEditBar] (dimmed + inert when hidden) in
  /// edit mode. Ports the web `SectionEditBar` gating.
  Widget _section({
    required String key,
    required String name,
    required bool hidden,
    required HarborTokens t,
    required Translations tr,
    required Widget child,
  }) {
    if (!_editMode) {
      if (hidden) return const SliverToBoxAdapter(child: SizedBox.shrink());
      return SliverToBoxAdapter(child: child);
    }
    final g = pageGutter(Idiom.of(context));
    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(g, 12, g, 0),
            child: _DiscoverSectionEditBar(
              name: name,
              hidden: hidden,
              tokens: t,
              tr: tr,
              onToggle: () => ref
                  .read(discoverHiddenSectionsProvider.notifier)
                  .toggle(key),
            ),
          ),
          Opacity(
            opacity: hidden ? 0.4 : 1,
            child: IgnorePointer(ignoring: hidden, child: child),
          ),
        ],
      ),
    );
  }

  /// The daily rails with the browse-tile sections woven in at the web's
  /// positions: genres after the first rail, the queue CTA after the second,
  /// languages after the third, awards after the fifth.
  List<Widget> _interleaved(List<RailDef> rails, HarborTokens tokens) {
    final out = <Widget>[];
    for (var i = 0; i < rails.length; i++) {
      out.add(DailyRail(rail: rails[i], tokens: tokens));
      final tile = switch (i) {
        0 => const GenreTiles(),
        1 => const DiscoveryQueueCta(),
        2 => const LanguageTiles(),
        3 => _CriticsPickSlot(tokens: tokens),
        4 => const AwardTiles(),
        _ => null,
      };
      if (tile != null) {
        out.add(
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 28),
            child: tile,
          ),
        );
      }
    }
    return out;
  }
}

/// One Discover section's edit-mode bar — an eye toggle, the section name, and
/// a "Hidden" chip when hidden. Ported 1:1 from `SectionEditBar`.
class _DiscoverSectionEditBar extends StatelessWidget {
  const _DiscoverSectionEditBar({
    required this.name,
    required this.hidden,
    required this.tokens,
    required this.tr,
    required this.onToggle,
  });

  final String name;
  final bool hidden;
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: tokens.canvas.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.edgeSoft),
      ),
      child: Row(
        children: [
          Focusable(
            tokens: tokens,
            borderRadius: 8,
            onPressed: onToggle,
            child: Container(
              width: 30,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: hidden
                    ? tokens.danger.withValues(alpha: 0.15)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                hidden ? Icons.visibility_off : Icons.visibility,
                size: 15,
                color: hidden ? tokens.danger : tokens.inkMuted,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: tokens.ink,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          if (hidden)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: tokens.danger.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                tr.t('Hidden').toUpperCase(),
                style: TextStyle(
                  color: tokens.danger,
                  fontSize: 10.5,
                  letterSpacing: 1.4,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The Discover critics-pick spotlight, woven in after the fourth daily rail
/// (web interleave i===3). Renders nothing until a pick resolves.
class _CriticsPickSlot extends ConsumerWidget {
  const _CriticsPickSlot({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pick = ref.watch(criticsPickSelectionProvider).value;
    if (pick == null) return const SizedBox.shrink();
    return CriticsPickSpotlight(meta: pick, tokens: tokens);
  }
}

/// One daily rail — fetches its first page and renders it as a poster row,
/// hiding itself while loading or when the row resolves empty.
class DailyRail extends ConsumerStatefulWidget {
  const DailyRail({super.key, required this.rail, required this.tokens});

  final RailDef rail;
  final HarborTokens tokens;

  @override
  ConsumerState<DailyRail> createState() => _DailyRailState();
}

class _DailyRailState extends ConsumerState<DailyRail> {
  List<MetaPreview>? _items;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(DailyRail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.rail.id != widget.rail.id) {
      _items = null;
      _load();
    }
  }

  Future<void> _load() async {
    final railId = widget.rail.id;
    final items = await widget.rail.fetch(1);
    if (mounted && widget.rail.id == railId) {
      setState(() => _items = items);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    if (items == null || items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TvRow(
        title: widget.rail.title,
        kicker: widget.rail.kicker,
        items: items,
        tokens: widget.tokens,
        viewAll: false,
        onSelect: (m) => ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id})),
      ),
    );
  }
}
