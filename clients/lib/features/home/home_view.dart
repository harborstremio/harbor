import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anime_providers.dart';
import '../../app/arabic_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/pinned_catalogs_provider.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/simkl_providers.dart';
import '../../app/stremboxd_providers.dart';
import '../../app/theme_controller.dart';
import '../../app/trakt_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_row.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/catalog_row.dart';
import '../../domain/catalog/hero_slide.dart';
import '../../domain/catalog/home_display.dart';
import '../../domain/catalog/streaming.dart';
import '../../domain/home/addon_rows.dart';
import '../../domain/home/anime_row.dart';
import '../../domain/home/custom_sources.dart';
import '../../domain/home/home_customization.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';
import 'add_source_dialog.dart';
import 'collection_card.dart';
import 'continue_watching_section.dart';
import 'custom_sources_row.dart';
import 'hero_carousel.dart';
import 'home_edit_controls.dart';
import 'streaming_rail.dart';
import 'tmdb_nudge.dart';
import 'top_rank_card.dart';
import '../../design/back_to_top.dart';

/// Home: vertical list of catalog rows, remote-navigable. Item selection opens
/// the detail view. Rows below the fixed sections form the customizable body
/// (reorder / hide / rename / Top-10 numerals), ported from the web home
/// `CustomizableRows` + `home-customization`.
class HomeView extends ConsumerStatefulWidget {
  const HomeView({super.key});

  @override
  ConsumerState<HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends ConsumerState<HomeView> {
  final ScrollController _scrollController = ScrollController();
  bool _editMode = false;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  HomeRowCustomization get _custom => HomeRowCustomization.fromMap(
    ref.read(settingsProvider).getMap('homeRows'),
  );

  void _persist(HomeRowCustomization next) =>
      ref.read(settingsProvider.notifier).setValue('homeRows', next.toMap());

  void _openMeta(MetaPreview m) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id}));

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final rows = ref.watch(homeContentProvider);

    return Scaffold(
      body: SafeArea(
        child: BackToTopOverlay(
          controller: _scrollController,
          child: rows.when(
            loading: () => Center(
              child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
            ),
            error: (_, _) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    tr.t('Could not load catalogs.'),
                    style: TextStyle(color: t.inkMuted, fontSize: 16),
                  ),
                  const SizedBox(height: 16),
                  Focusable(
                    tokens: t,
                    autofocus: true,
                    borderRadius: 999,
                    onPressed: () => ref.invalidate(homeContentProvider),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 22,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: t.raised,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        tr.t('Retry'),
                        style: TextStyle(color: t.ink),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            data: (home) => _buildData(context, t, tr, home),
          ),
        ),
      ),
    );
  }

  Widget _buildData(
    BuildContext context,
    dynamic t,
    Translations tr,
    dynamic home,
  ) {
    final settings = ref.watch(settingsProvider);
    final classic = settings.getString('homeMode') == 'classic';
    final custom = HomeRowCustomization.fromMap(settings.getMap('homeRows'));

    // Addon catalog rows: classic Home shows only these; curated Home appends
    // them (minus streaming-service rows, which get the rail).
    final addonAsync = ref.watch(addonHomeRowsProvider);
    var addonRows = addonAsync.value ?? const <CatalogRow>[];
    if (!classic) {
      // Curated Home drops streaming-service rows (they get the dedicated rail)
      // AND anime rows (they belong in the anime room) — web home.tsx:201
      // `addons.filter((a) => !isAnimeRow(a) && !isStreamingServiceRow(a.name))`.
      addonRows = addonRows
          .where(
            (r) => !isStreamingServiceRowTitle(r.title) && !isAnimeAddonRow(r),
          )
          .toList();
    }
    // The tmdb/cinemeta rows + addon rows form the de-duplicated "rest" source
    // (matching the web `rows` state); letterboxd / arabic / personal are
    // separate no-dedup body sources, added around it. Add-on rows are name-
    // de-duplicated against the curated rows + each other and renamed on a
    // same-name multi-type collision (web `mergeRows`), the first of web's two
    // dedup stages; the poster-level second stage is `computeHomeDisplay`.
    final mergedAddonRows = mergeAddonRows(
      home.rows,
      addonRows,
      dedup: !settings.getBool('homeShowAllAddonRows'),
    );
    final restSource = <CatalogRow>[...home.rows, ...mergedAddonRows];
    // The empty state must account for EVERY body row source, not just the
    // tmdb/addon "rest" — otherwise a user whose only content is Trakt/Simkl/
    // anime/custom-source/pinned-list rows would see "No catalogs yet" wrongly
    // replace their whole Home. (Web keeps hero/CW/streaming and only skeletons
    // the rows region; here we at least never false-empty when content exists.)
    final arabicAsync = ref.watch(arabicHomeRowsProvider);
    final lbAsync = ref.watch(letterboxdHomeRowsProvider);
    final traktAsync = ref.watch(traktHomeRowsProvider);
    final simklAsync = ref.watch(simklHomeRowsProvider);
    final animeAsync = ref.watch(animeHomeRowsProvider);
    // Pinned addon catalogs the user added to Home (web usePinnedRows).
    final pinnedRows =
        ref.watch(pinnedCatalogRowsProvider).value ?? const <CatalogRow>[];
    if (restSource.isEmpty &&
        (arabicAsync.value ?? const []).isEmpty &&
        (lbAsync.value ?? const []).isEmpty &&
        (traktAsync.value ?? const []).isEmpty &&
        (simklAsync.value ?? const []).isEmpty &&
        (animeAsync.value ?? const []).isEmpty &&
        pinnedRows.isEmpty &&
        ref.watch(watchlistMetasProvider).isEmpty &&
        ref.watch(favoritesMetasProvider).isEmpty &&
        custom.listRows.isEmpty &&
        parseCustomSourceRows(custom.customSources).isEmpty) {
      // Show the spinner while ANY row source is still resolving — otherwise a
      // slow trakt/simkl/anime provider that hasn't loaded yet counts as empty
      // and briefly flashes "No catalogs yet" before self-healing.
      final anyLoading =
          addonAsync.isLoading ||
          arabicAsync.isLoading ||
          lbAsync.isLoading ||
          traktAsync.isLoading ||
          simklAsync.isLoading ||
          animeAsync.isLoading;
      return Center(
        child: anyLoading
            ? CircularProgressIndicator(color: t.accent, strokeWidth: 2)
            : Text(
                tr.t('No catalogs yet.'),
                style: TextStyle(color: t.inkMuted, fontSize: 16),
              ),
      );
    }

    // The hero slides seed cross-row de-duplication (the first ≤4 unique pool
    // ids), exactly as `heroSlides` does in the web home.
    final heroIds = <String>{};
    for (final m in home.hero) {
      if (heroIds.length >= 4) break;
      heroIds.add(m.id);
    }
    // Poster-level dedup runs unconditionally (web `displayed` memo deps are
    // only [rows, heroSlides, homeMode]); `homeShowAllAddonRows` gates just the
    // row-name merge above, never this second stage. Classic mode opts out via
    // `classic`, matching the web memo's isClassic early-return.
    final display = computeHomeDisplay(
      rows: restSource,
      heroIds: heroIds,
      classic: classic,
      dedup: true,
    );

    // Row filters, applied in the same order as customizable-rows: language
    // (keep in-language / language-less titles), hideWatched, hideUnreleased.
    final langs = settings.getStringList('homeLanguages');
    final hideWatched = settings.getBool('hideWatchedInCatalogs');
    final hideUnreleased = settings.getBool('hideUnreleased');
    final now = DateTime.now();
    final watched = ref.watch(recentlyPlayedProvider);

    // Web renders the Top-10 rail from the UNFILTERED dedup result and gates it
    // on the unfiltered count — language / hideWatched / hideUnreleased apply
    // only to the body rows, never to Top-10 (applying them here can wrongly
    // shrink the rail below 10 and hide it).
    final top10 = display.top10;
    final hasTop10 = top10.length >= 10;

    // The unified customizable body, in web natural order: arabic, personal
    // (My Watchlist), trakt, letterboxd, the de-duplicated tmdb/addon rest, then
    // the anime rails at the tail.
    final arabicRows =
        ref.watch(arabicHomeRowsProvider).value ?? const <CatalogRow>[];
    final traktRows =
        ref.watch(traktHomeRowsProvider).value ?? const <CatalogRow>[];
    final simklRows =
        ref.watch(simklHomeRowsProvider).value ?? const <CatalogRow>[];
    final lbRows =
        ref.watch(letterboxdHomeRowsProvider).value ?? const <CatalogRow>[];
    final animeRows =
        ref.watch(animeHomeRowsProvider).value ?? const <CatalogRow>[];
    final favoritesMetas = ref.watch(favoritesMetasProvider);
    final watchlistMetas = ref.watch(watchlistMetasProvider);
    // Custom lists the user pinned to Home (homeRows.listRows), in the pinned
    // order, skipping empty or deleted lists — ported from the web `listHomeRows`.
    final customLists = ref.watch(customListsProvider);
    final listById = {for (final l in customLists) l.id: l};
    final listHomeRows = <CatalogRow>[
      for (final id in custom.listRows)
        if (listById[id] case final l? when l.items.isNotEmpty)
          CatalogRow(
            key: 'list-${l.id}',
            title: l.name,
            type: 'movie',
            id: 'list-${l.id}',
            items: [
              for (final it in l.items)
                MetaPreview({
                  'id': it.id,
                  'type': it.type,
                  'name': it.name,
                  if (it.poster != null) 'poster': it.poster,
                }),
            ],
            noDedup: true,
          ),
    ];
    // Non-empty lists not already pinned — the "Add from lists" menu options.
    final availableListRows = <({String id, String name})>[
      for (final l in customLists)
        if (l.items.isNotEmpty && !custom.listRows.contains(l.id))
          (id: l.id, name: l.name),
    ];
    final leadingRows = <CatalogRow>[
      ...listHomeRows,
      ...pinnedRows,
      ...arabicRows,
      // Personal rows in web order: Favorites, then My Watchlist.
      if (favoritesMetas.isNotEmpty)
        CatalogRow(
          key: 'harbor-favorites',
          title: 'Favorites',
          type: 'movie',
          id: 'harbor-favorites',
          items: favoritesMetas,
          noDedup: true,
        ),
      if (watchlistMetas.isNotEmpty)
        CatalogRow(
          key: 'harbor-watchlist',
          title: 'My Watchlist',
          type: 'movie',
          id: 'harbor-watchlist',
          items: watchlistMetas,
          noDedup: true,
        ),
      ...traktRows,
      ...simklRows,
      ...lbRows,
    ];
    final bodyNatural = <CatalogRow>[
      ...leadingRows,
      ...display.rest,
      ...animeRows,
    ];

    // A user-chosen "feature in hero" row (homeRows.heroSource) feeds the hero
    // from its own artwork-rich titles, replacing the default trending pool —
    // ported from the web `heroSourceRow` / `heroSlides`. It searches the raw
    // pre-dedup rows (like the web `rows` state) so a heavily-deduplicated
    // catalog can still be chosen as the hero source.
    final heroOverride = _heroSourceSlides(custom.heroSource, [
      ...leadingRows,
      ...restSource,
      ...animeRows,
    ]);

    // Apply order / hide / rename / numerals. In edit mode hidden rows are kept
    // (rendered as their control only) so they can be un-hidden.
    final customized = applyHomeRowCustomization(
      bodyNatural,
      custom,
      includeHidden: _editMode,
    );
    // Per-row language / watched / unreleased filter; an emptied row is dropped
    // unless we are editing (matching the web `customizable-rows`). [rawCount]
    // is the pre-filter item count — the web gates the Top-10 numerals toggle on
    // `row.metas.length` (unfiltered), not on the filtered list.
    final body = <({CatalogRow row, int rawCount})>[];
    for (final r in customized) {
      var items = filterMetasByLanguage(r.items, langs);
      if (hideWatched) items = filterMetasWatched(items, watched);
      if (hideUnreleased) items = filterMetasUnreleased(items, now);
      if (items.isEmpty && !_editMode) continue;
      body.add((row: r.copyWith(items: items), rawCount: r.items.length));
    }
    final orderKeys = [
      for (final r in customized)
        if (r.key != null) r.key!,
    ];

    // On a TV the hero's Play button is the only autofocus target; in classic
    // mode there is no hero, and even in curated mode the hero can be empty
    // while loading — land the remote on Continue-Watching (top of the list).
    final wantsFallbackAutofocus = classic || home.hero.isEmpty;
    final heroHidden = custom.hidden.contains('hero');
    final top10Hidden = custom.hidden.contains('top10');
    final collectionsHidden = custom.hidden.contains('collections');

    // Each fixed section carries a semantic key so hiding one in edit mode (which
    // adds/removes list children) never re-homes a neighbour's element state.
    // The Customize bar lives at the top of the list rather than the web's
    // floating overlay: on a D-pad the top of the list is always reachable
    // (press Up), whereas a Stack overlay would sit outside the focus path.
    final prefix = <Widget>[
      // The "add a TMDB key" nudge, gated so a hidden nudge leaves no empty gap
      // (self-hides when a key/provider add-on exists, it is dismissed, or
      // classic mode). Suppressed in classic like the web.
      if (shouldShowTmdbNudge(ref, suppress: classic))
        KeyedSubtree(
          key: const ValueKey('home:tmdbnudge'),
          child: _pad(context, const TmdbNudge()),
        ),
      // Classic Home has no customize bar (web gates every CustomizeBar on
      // `homeMode !== "classic"`).
      if (!classic)
        KeyedSubtree(
          key: const ValueKey('home:customizebar'),
          child: _customizeBarRow(context, t, tr, custom, availableListRows),
        ),
      if (!classic && (!heroHidden || _editMode))
        KeyedSubtree(
          key: const ValueKey('home:hero'),
          // Not wrapped in a Column outside edit mode: the hero's full-bleed
          // (`heroFull`) layout must remain a direct list child.
          child: !_editMode
              ? HeroCarousel(overrideSlides: heroOverride)
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _pad(
                      context,
                      HomePinnedRowControls(
                        tokens: t,
                        tr: tr,
                        label: tr.t('Featured hero'),
                        hidden: heroHidden,
                        onToggleHidden: () =>
                            _persist(toggleHomeRowHidden(custom, 'hero')),
                      ),
                    ),
                    if (!heroHidden) HeroCarousel(overrideSlides: heroOverride),
                  ],
                ),
        ),
      // "Keep anime in the anime room" moves anime out of the Home shelf.
      KeyedSubtree(
        key: const ValueKey('home:cw'),
        child: ContinueWatchingSection(
          autofocusFirst: wantsFallbackAutofocus,
          audience: settings.getBool('animeOnlyInAnimeRoom')
              ? CwAudience.general
              : CwAudience.all,
        ),
      ),
      if (!classic)
        const KeyedSubtree(
          key: ValueKey('home:streaming'),
          child: StreamingRail(),
        ),
      if (!classic && hasTop10 && (!top10Hidden || _editMode))
        KeyedSubtree(
          key: const ValueKey('home:top10'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_editMode)
                _pad(
                  context,
                  HomePinnedRowControls(
                    tokens: t,
                    tr: tr,
                    label: tr.t('Top 10 Trending This Week'),
                    hidden: top10Hidden,
                    onToggleHidden: () =>
                        _persist(toggleHomeRowHidden(custom, 'top10')),
                  ),
                ),
              if (!top10Hidden)
                TopRankRail(title: tr.t(display.top10Title), items: top10),
            ],
          ),
        ),
      // Collections needs a TMDB key (the row self-hides without one); gate the
      // edit-mode control on it too so no control shows for an absent section.
      if (!classic &&
          settings.tmdbKey.isNotEmpty &&
          (!collectionsHidden || _editMode))
        KeyedSubtree(
          key: const ValueKey('home:collections'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_editMode)
                _pad(
                  context,
                  HomePinnedRowControls(
                    tokens: t,
                    tr: tr,
                    label: tr.t('Collections'),
                    hidden: collectionsHidden,
                    onToggleHidden: () =>
                        _persist(toggleHomeRowHidden(custom, 'collections')),
                  ),
                ),
              if (!collectionsHidden) const CollectionsRow(),
            ],
          ),
        ),
      // User-defined custom-source shelves (homeRows.customSources) — folder-card
      // rails that lead the customizable body, matching the web `sourceRows`
      // position (before list/arabic/personal rows). Ported from the web
      // `CustomSourcesRow`. In edit mode each row gets a Delete control.
      for (final sr in parseCustomSourceRows(custom.customSources))
        KeyedSubtree(
          key: ValueKey('home:source:${sr.id}'),
          child: _editMode
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _pad(
                      context,
                      HomeSourceRowControls(
                        tokens: t,
                        tr: tr,
                        label: sr.title,
                        onDelete: () => _deleteSource(sr.id),
                      ),
                    ),
                    CustomSourcesRow(row: sr),
                  ],
                )
              : CustomSourcesRow(row: sr),
        ),
    ];

    // While the addon catalog rows are still loading and none have arrived yet,
    // show shimmer placeholders in the rows region (web keeps the hero/CW/
    // streaming and skeletons only the rows) instead of a blank gap.
    final skeletonCount =
        (!classic && addonAsync.isLoading && display.rest.isEmpty) ? 6 : 0;

    return ListView.separated(
      controller: _scrollController,
      padding: EdgeInsets.only(
        top: 24 + overscanInset(Idiom.of(context)).top,
        bottom: 24 + overscanInset(Idiom.of(context)).bottom,
      ),
      itemCount: prefix.length + body.length + skeletonCount,
      separatorBuilder: (_, _) => const SizedBox(height: 28),
      itemBuilder: (context, i) {
        if (i < prefix.length) return prefix[i];
        final bodyIndex = i - prefix.length;
        if (bodyIndex >= body.length) {
          return _pad(context, _RowSkeleton(tokens: t));
        }
        final entry = body[bodyIndex];
        // A stable per-row key so a reorder/hide never re-homes a row's element
        // state (e.g. an open inline-rename editor) onto a different row.
        return KeyedSubtree(
          key: ValueKey('home:body:${entry.row.key ?? entry.row.title}'),
          child: _bodyRow(
            context,
            t,
            tr,
            entry.row,
            entry.rawCount,
            custom,
            orderKeys,
          ),
        );
      },
    );
  }

  /// The right-aligned Customize-home bar shown at the top of the scroll body.
  Widget _customizeBarRow(
    BuildContext context,
    dynamic t,
    Translations tr,
    HomeRowCustomization custom,
    List<({String id, String name})> availableListRows,
  ) {
    // Matches the web `CustomizeBar` `hasChanges`: order / hidden / renamed only
    // (a lone numerals toggle does not surface Reset).
    final hasChanges =
        custom.order.isNotEmpty ||
        custom.hidden.isNotEmpty ||
        custom.renamed.isNotEmpty;
    final g = pageGutter(Idiom.of(context));
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 0, g, 0),
      child: Align(
        alignment: AlignmentDirectional.centerEnd,
        child: HomeCustomizeBar(
          tokens: t,
          tr: tr,
          editMode: _editMode,
          hasChanges: hasChanges,
          availableListRows: availableListRows,
          onToggleEdit: () => setState(() => _editMode = !_editMode),
          onReset: () => _persist(resetHomeRows()),
          onAddListRow: (id) => _persist(addHomeListRow(_custom, id)),
          onAddSource: () => _openAddSource(context, t, tr),
        ),
      ),
    );
  }

  /// Opens the Add-Custom-Source modal and upserts the imported source-row maps
  /// into `homeRows.customSources`. Ports the web `handleSaveCustomSources`.
  Future<void> _openAddSource(
    BuildContext context,
    dynamic t,
    Translations tr,
  ) async {
    final rows = await showAddSourceDialog(
      context: context,
      tokens: t as HarborTokens,
      tr: tr,
    );
    if (rows == null || rows.isEmpty) return;
    final current = _custom;
    _persist(
      current.copyWith(
        customSources: upsertCustomSourceMaps(current.customSources, rows),
      ),
    );
  }

  /// Removes a custom-source row (edit-mode delete). Ports web
  /// `handleDeleteCustomSource`.
  void _deleteSource(String id) {
    final current = _custom;
    _persist(
      current.copyWith(
        customSources: removeCustomSourceMap(current.customSources, id),
      ),
    );
  }

  Widget _pad(BuildContext context, Widget child) {
    final g = pageGutter(Idiom.of(context));
    return Padding(padding: EdgeInsets.fromLTRB(g, 0, g, 0), child: child);
  }

  /// A customizable body row: the rail itself, with its edit controls above it
  /// in edit mode. A numerals row (≥10 items) renders as a Top-10 rank rail.
  Widget _bodyRow(
    BuildContext context,
    dynamic t,
    Translations tr,
    CatalogRow row,
    int rawCount,
    HomeRowCustomization custom,
    List<String> orderKeys,
  ) {
    final key = row.key;
    final hidden = key != null && custom.hidden.contains(key);
    final ranked = row.numerals && row.items.length >= 10;
    // The rail shows the localized title; the edit control edits the raw catalog
    // name (web passes `row.name`, translating only at the display site), so a
    // rename never persists a localized string into `renamed`.
    final title = tr.t(row.title);
    final rawName = row.title;

    Widget rail;
    if (ranked) {
      rail = TopRankRail(title: title, items: row.items.take(10).toList());
    } else {
      rail = TvRow(
        title: title,
        items: row.items,
        tokens: t,
        autofocusFirst: false,
        onSelect: _openMeta,
        // The Letterboxd-bridged rows carry the amber source chip, 1:1 with web.
        sourceBadge: (key != null && key.startsWith('letterboxd-'))
            ? 'Letterboxd'
            : null,
      );
    }

    if (!_editMode) return rail;

    final idx = key == null ? -1 : orderKeys.indexOf(key);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _pad(
          context,
          HomeRowControls(
            tokens: t,
            tr: tr,
            name: rawName,
            hidden: hidden,
            canMoveUp: idx > 0,
            canMoveDown: idx >= 0 && idx < orderKeys.length - 1,
            isRenamed: key != null && custom.renamed.containsKey(key),
            numeralsActive: key != null && custom.numerals.contains(key),
            canNumerals: rawCount >= 10,
            heroActive: key != null && custom.heroSource == key,
            canHero: row.items.any(
              (m) =>
                  (m.background?.isNotEmpty ?? false) ||
                  (m.poster?.isNotEmpty ?? false),
            ),
            onMoveUp: key == null
                ? () {}
                : () => _persist(
                    moveHomeRow(_custom, _orderedRows(orderKeys), key, -1),
                  ),
            onMoveDown: key == null
                ? () {}
                : () => _persist(
                    moveHomeRow(_custom, _orderedRows(orderKeys), key, 1),
                  ),
            onToggleHidden: key == null
                ? () {}
                : () => _persist(toggleHomeRowHidden(_custom, key)),
            onRename: key == null
                ? (_) {}
                : (label) => _persist(renameHomeRow(_custom, key, label)),
            onResetName: key == null
                ? () {}
                : () => _persist(renameHomeRow(_custom, key, '')),
            onToggleNumerals: key == null
                ? () {}
                : () => _persist(toggleHomeRowNumerals(_custom, key)),
            onToggleHero: key == null
                ? () {}
                : () => _persist(toggleHomeHeroSource(_custom, key)),
          ),
        ),
        if (!hidden) rail,
      ],
    );
  }

  /// The hero slides fed from the user's chosen "feature in hero" row, or null
  /// to fall back to the default trending pool. Ported from the web
  /// `heroSourceRow` + `heroSlides`: background-artwork titles first, then
  /// poster-only, de-duplicated and capped at four.
  List<HeroSlide>? _heroSourceSlides(String? key, List<CatalogRow> rows) {
    if (key == null) return null;
    bool hasArt(MetaPreview m) =>
        (m.background?.isNotEmpty ?? false) || (m.poster?.isNotEmpty ?? false);
    CatalogRow? row;
    for (final r in rows) {
      if (r.key == key && r.items.any(hasArt)) {
        row = r;
        break;
      }
    }
    if (row == null) return null;
    final pool = <MetaPreview>[
      ...row.items.where((m) => m.background?.isNotEmpty ?? false),
      ...row.items.where(
        (m) =>
            !(m.background?.isNotEmpty ?? false) &&
            (m.poster?.isNotEmpty ?? false),
      ),
    ];
    final seen = <String>{};
    final out = <HeroSlide>[];
    for (final m in pool) {
      if (!seen.add(m.id)) continue;
      out.add(
        HeroSlide(
          meta: Meta(m.json),
          rankLabel: m.type == 'series' ? 'TV' : 'Movies',
          rankPosition: out.length + 1,
        ),
      );
      if (out.length >= 4) break;
    }
    return out.isEmpty ? null : out;
  }

  /// A lightweight key-only row list so [moveHomeRow]'s `effectiveHomeOrder` sees
  /// the exact live ordering the edit UI is showing.
  List<CatalogRow> _orderedRows(List<String> orderKeys) => [
    for (final k in orderKeys)
      CatalogRow(key: k, title: k, type: 'movie', id: k, items: const []),
  ];
}

/// A placeholder catalog row (title bar + a strip of poster blocks) shown while
/// the Home rows load — the web `RowSkeleton`. A slow gentle pulse hints that it
/// is loading, not empty.
class _RowSkeleton extends StatefulWidget {
  const _RowSkeleton({required this.tokens});
  final HarborTokens tokens;

  @override
  State<_RowSkeleton> createState() => _RowSkeletonState();
}

class _RowSkeletonState extends State<_RowSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.tokens.elevated;
    return FadeTransition(
      opacity: Tween<double>(begin: 0.35, end: 0.7).animate(_c),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 170,
            height: 18,
            decoration: BoxDecoration(
              color: base,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 210,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 6,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, _) => Container(
                width: 140,
                decoration: BoxDecoration(
                  color: base,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
