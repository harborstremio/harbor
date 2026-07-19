import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anilist_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/mal_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/simkl_providers.dart';
import '../../app/stremboxd_providers.dart';
import '../../app/theme_controller.dart';
import '../../app/trakt_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/focus/tv_text_field.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/catalog_row.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/library/local_watchlist.dart' show WatchlistEntry;
import '../../domain/nav/frame.dart';
import 'anilist_tab.dart';
import 'history_tab.dart';
import 'my_lists_tab.dart';
import 'service_tab.dart';

/// The Library view — the viewer's saved collection (`10-pages.md`). A tab bar
/// switches between the Watchlist (a poster grid of everything saved), My Lists
/// (hand-curated collections), and — when AniList is connected — the AniList
/// anime lists. Ported from the web Library tabs.
class LibraryView extends ConsumerStatefulWidget {
  const LibraryView({super.key});

  @override
  ConsumerState<LibraryView> createState() => _LibraryViewState();
}

class _LibraryViewState extends ConsumerState<LibraryView> {
  String _tab = 'watchlist';
  String _wlType = 'all'; // all | movie | series
  String _wlSort = 'recent'; // recent | title
  String _wlQuery = '';
  final ScrollController _wlScroll = ScrollController();

  @override
  void dispose() {
    _wlScroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final metas = ref.watch(watchlistMetasProvider);
    final anilistConnected =
        ref.watch(anilistConnectProvider) is AnilistConnectDone;
    final traktConnected = ref.watch(traktConnectedProvider);
    final simklConnected = ref.watch(simklConnectedProvider);
    final letterboxdConnected = ref.watch(letterboxdConnectProvider) != null;
    final malConnected =
        (ref.watch(malAccessTokenProvider).asData?.value ?? '').isNotEmpty;
    // Fall back to the Watchlist if the active service tab disconnects (web
    // does the same for each conditional tab).
    if ((_tab == 'anilist' && !anilistConnected) ||
        (_tab == 'trakt' && !traktConnected) ||
        (_tab == 'simkl' && !simklConnected) ||
        (_tab == 'letterboxd' && !letterboxdConnected) ||
        (_tab == 'mal' && !malConnected)) {
      _tab = 'watchlist';
    }

    final g = pageGutter(Idiom.of(context));

    return Container(
      color: t.canvas,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            g,
            pageTopGutter(Idiom.of(context)),
            g,
            0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title block + the "Stats" (Wrapped) button, laid out in a row so
              // the button sits at the trailing edge across from the title (web
              // library header's `justify-between` + `settings.wrappedButton`).
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tr.t('MY LIBRARY'),
                          style: TextStyle(
                            color: t.inkSubtle,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 3,
                          ),
                        ),
                        const SizedBox(height: 6),
                        // Title + one-liner (web "Your collection." +
                        // description). The "Local files" sentence is dropped —
                        // there is no Local tab on the mobile / TV clients.
                        Text(
                          tr.t('Your collection.'),
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 34,
                            fontWeight: FontWeight.w500,
                            letterSpacing: -0.5,
                            height: 1.05,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          tr.t(
                            'Watchlist is what you’ve saved for later. History is everything you’ve watched.',
                          ),
                          style: TextStyle(
                            color: t.inkMuted,
                            fontSize: 14,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (ref.watch(settingsProvider).getBool('wrappedButton'))
                    Padding(
                      padding: const EdgeInsets.only(left: 12, top: 6),
                      child: _statsButton(t, tr),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              // The tabs scroll horizontally so the row never overflows a narrow
              // phone; on a wide screen it simply fits without scrolling.
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    _tabButton(t, tr.t('Watchlist'), 'watchlist'),
                    const SizedBox(width: 24),
                    _tabButton(t, tr.t('History'), 'history'),
                    const SizedBox(width: 24),
                    _tabButton(t, tr.t('My Lists'), 'lists'),
                    if (traktConnected) ...[
                      const SizedBox(width: 24),
                      _tabButton(t, tr.t('Trakt'), 'trakt'),
                    ],
                    if (simklConnected) ...[
                      const SizedBox(width: 24),
                      _tabButton(t, tr.t('Simkl'), 'simkl'),
                    ],
                    if (anilistConnected) ...[
                      const SizedBox(width: 24),
                      _tabButton(t, tr.t('AniList'), 'anilist'),
                    ],
                    if (malConnected) ...[
                      const SizedBox(width: 24),
                      _tabButton(t, tr.t('MyAnimeList'), 'mal'),
                    ],
                    if (letterboxdConnected) ...[
                      const SizedBox(width: 24),
                      _tabButton(t, tr.t('Letterboxd'), 'letterboxd'),
                    ],
                    if (_tab == 'watchlist' && metas.isNotEmpty) ...[
                      const SizedBox(width: 12),
                      Text(
                        '${metas.length}',
                        style: TextStyle(
                          color: t.inkMuted,
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 22),
              Expanded(
                child: switch (_tab) {
                  'history' => const HistoryTab(),
                  'lists' => const MyListsTab(),
                  'anilist' => const AnilistTab(),
                  'trakt' => _serviceTab(
                    t,
                    tr,
                    ref.watch(traktHomeRowsProvider),
                    tr.t('Your Trakt library is empty.'),
                  ),
                  'simkl' => _serviceTab(
                    t,
                    tr,
                    ref.watch(simklHomeRowsProvider),
                    tr.t('Your Simkl library is empty.'),
                  ),
                  'letterboxd' => _serviceTab(
                    t,
                    tr,
                    ref.watch(letterboxdHomeRowsProvider),
                    tr.t('Your Letterboxd library is empty.'),
                  ),
                  'mal' => _serviceTab(
                    t,
                    tr,
                    ref
                        .watch(malAnimeRailsProvider)
                        .whenData(
                          (rails) => [
                            for (final r in rails)
                              CatalogRow(
                                key: r.key,
                                title: r.title,
                                type: 'series',
                                id: 'mal',
                                items: r.metas,
                              ),
                          ],
                        ),
                    tr.t('Your MyAnimeList library is empty.'),
                  ),
                  _ => _watchlistTab(t, tr),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The Watchlist tab — filter-by-type + search + Recent/Title sort over the
  /// saved-title grid, with the Recent sort grouped into date buckets (web
  /// watchlist-tab's FilterBar + SortControl + GroupedGrid). Year sort is omitted
  /// — the local watchlist entry stores no release year.
  Widget _watchlistTab(HarborTokens t, Translations tr) {
    ref.watch(watchlistProvider); // rebuild when the saved set changes
    final entries = ref.read(localWatchlistProvider).list();
    if (entries.isEmpty) return _emptyWatchlist(t, tr);

    final movies = entries.where((e) => e.type == 'movie').length;
    final series = entries.where((e) => e.type == 'series').length;
    final q = _wlQuery.trim().toLowerCase();
    final filtered = entries.where((e) {
      if (_wlType != 'all' && e.type != _wlType) return false;
      if (q.isNotEmpty && !e.name.toLowerCase().contains(q)) return false;
      return true;
    }).toList();
    final groups = _wlGroups(filtered, tr);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _wlControls(t, tr, all: entries.length, movies: movies, series: series),
        const SizedBox(height: 14),
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Text(
                    tr.t('Nothing here.'),
                    style: TextStyle(color: t.inkMuted, fontSize: 15),
                  ),
                )
              : _watchlistGrid(t, groups),
        ),
      ],
    );
  }

  /// Groups the filtered entries: Title sort → one flat A-Z group; Recent →
  /// date buckets (Today / This week / This month / year). Ports `sortedGroups`.
  List<({String? label, List<MetaPreview> metas})> _wlGroups(
    List<WatchlistEntry> filtered,
    Translations tr,
  ) {
    MetaPreview meta(WatchlistEntry e) => MetaPreview.fromJson({
      'id': e.id,
      'type': e.type,
      'name': e.name,
      if (e.poster != null) 'poster': e.poster,
    });
    if (_wlSort == 'title') {
      final sorted = [...filtered]
        ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      return [(label: null, metas: [for (final e in sorted) meta(e)])];
    }
    final sorted = [...filtered]
      ..sort((a, b) => b.addedAt.compareTo(a.addedAt));
    final now = DateTime.now().millisecondsSinceEpoch;
    final byRank = <int, List<MetaPreview>>{};
    final labelByRank = <int, String>{};
    for (final e in sorted) {
      final b = _bucket(e.addedAt, now, tr);
      (byRank[b.rank] ??= []).add(meta(e));
      labelByRank[b.rank] = b.label;
    }
    final ranks = byRank.keys.toList()..sort();
    return [for (final r in ranks) (label: labelByRank[r], metas: byRank[r]!)];
  }

  ({int rank, String label}) _bucket(int ms, int now, Translations tr) {
    final days = (now - ms) / 86400000;
    if (days < 1) return (rank: 0, label: tr.t('Today'));
    if (days < 7) return (rank: 1, label: tr.t('This week'));
    if (days < 30) return (rank: 2, label: tr.t('This month'));
    final year = DateTime.fromMillisecondsSinceEpoch(ms).year;
    final thisYear = DateTime.fromMillisecondsSinceEpoch(now).year;
    return (rank: 10 + (thisYear - year), label: '$year');
  }

  /// Renders the grouped watchlist — a single flat grid when there is one
  /// unlabeled group, else a header + grid per date bucket. Reuses the catalog
  /// grid delegate + [FocusablePoster] so it matches every other poster grid.
  Widget _watchlistGrid(
    HarborTokens t,
    List<({String? label, List<MetaPreview> metas})> groups,
  ) {
    final idiom = Idiom.of(context);
    final hideTitles = ref.watch(settingsProvider).getBool('hidePosterTitles');
    final overscan = overscanInset(idiom);
    final delegate = SliverGridDelegateWithMaxCrossAxisExtent(
      maxCrossAxisExtent: idiom.isTv ? 220 : 168,
      childAspectRatio: posterGridAspect(0.58, hideTitles),
      crossAxisSpacing: 16,
      mainAxisSpacing: 20,
    );
    void play(MetaPreview m) => ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id}));

    var first = true;
    final slivers = <Widget>[];
    for (final group in groups) {
      if (group.label != null) {
        slivers.add(
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 10),
              child: Text(
                '${group.label!.toUpperCase()}  ${group.metas.length}',
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2,
                ),
              ),
            ),
          ),
        );
      }
      slivers.add(
        SliverGrid(
          gridDelegate: delegate,
          delegate: SliverChildBuilderDelegate((context, i) {
            final af = first && i == 0;
            return FocusablePoster(
              item: group.metas[i],
              tokens: t,
              autofocus: af,
              onPressed: () => play(group.metas[i]),
            );
          }, childCount: group.metas.length),
        ),
      );
      first = false;
    }

    return CustomScrollView(
      controller: _wlScroll,
      slivers: [
        SliverPadding(padding: EdgeInsets.only(top: overscan.top)),
        ...slivers,
        SliverPadding(padding: EdgeInsets.only(bottom: 40 + overscan.bottom)),
      ],
    );
  }

  Widget _wlControls(
    HarborTokens t,
    Translations tr, {
    required int all,
    required int movies,
    required int series,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _filterPill(t, tr.t('All'), all, 'all'),
            if (movies > 0) ...[
              const SizedBox(width: 8),
              _filterPill(t, tr.t('Movies'), movies, 'movie'),
            ],
            if (series > 0) ...[
              const SizedBox(width: 8),
              _filterPill(t, tr.t('Series'), series, 'series'),
            ],
            const SizedBox(width: 22),
            _sortPill(t, tr.t('Recent'), 'recent'),
            const SizedBox(width: 8),
            _sortPill(t, tr.t('Title'), 'title'),
          ],
        ),
      ),
      const SizedBox(height: 10),
      // Filter the watchlist by title (web FilterBar's search field).
      SizedBox(
        width: 320,
        child: TvTextField(
          onChanged: (v) => setState(() => _wlQuery = v),
          style: TextStyle(color: t.ink, fontSize: 14),
          decoration: InputDecoration(
            isDense: true,
            hintText: tr.t('Filter your watchlist'),
            hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
            prefixIcon: Icon(Icons.search, color: t.inkSubtle, size: 18),
            filled: true,
            fillColor: t.raised,
            contentPadding: const EdgeInsets.symmetric(vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ),
    ],
  );

  Widget _filterPill(HarborTokens t, String label, int count, String value) {
    final active = _wlType == value;
    return Focusable(
      tokens: t,
      borderRadius: 18,
      scale: 1.04,
      onPressed: () => setState(() => _wlType = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: active ? t.accent : t.raised,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Text(
          '$label  $count',
          style: TextStyle(
            color: active ? t.canvas : t.ink,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _sortPill(HarborTokens t, String label, String value) {
    final active = _wlSort == value;
    return Focusable(
      tokens: t,
      borderRadius: 18,
      scale: 1.04,
      onPressed: () => setState(() => _wlSort = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: active ? t.ink : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: active ? t.ink : t.edge),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? t.canvas : t.inkMuted,
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  /// A connected-service Library tab (Trakt / Simkl / MAL / Letterboxd) — the
  /// service's own rows, click → the shared detail/play path.
  Widget _serviceTab(
    HarborTokens t,
    Translations tr,
    AsyncValue<List<CatalogRow>> rows,
    String emptyText,
  ) => ServiceRowsTab(
    tokens: t,
    tr: tr,
    rows: rows,
    emptyText: emptyText,
    onSelect: (m) => ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id})),
  );

  Widget _tabButton(HarborTokens t, String label, String key) {
    final active = _tab == key;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 8,
      // Land the remote on the active tab on entry so Library always has a
      // visible focus target — even when the current tab's list is empty.
      autofocus: active,
      onPressed: () => setState(() => _tab = key),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: active ? t.ink : t.inkMuted,
                fontSize: 28,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Container(
              height: 3,
              width: 28,
              decoration: BoxDecoration(
                color: active ? t.accent : Colors.transparent,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The "Stats" (Wrapped) button in the header — opens the year-in-review.
  /// Gated on `wrappedButton`; a [Focusable] so the TV remote can reach it.
  Widget _statsButton(HarborTokens t, Translations tr) => Focusable(
    tokens: t,
    borderRadius: 8,
    onPressed: () => ref
        .read(navControllerProvider.notifier)
        .push(const Frame(FrameKind.wrapped)),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.bar_chart_rounded, size: 16, color: t.inkMuted),
          const SizedBox(width: 6),
          Text(
            tr.t('Stats'),
            style: TextStyle(
              color: t.inkMuted,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _emptyWatchlist(HarborTokens t, Translations tr) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.bookmark_border, size: 56, color: t.inkSubtle),
        const SizedBox(height: 16),
        Text(
          tr.t('Your watchlist is empty'),
          style: TextStyle(
            color: t.ink,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          tr.t('Add titles to your watchlist and they will show up here.'),
          style: TextStyle(color: t.inkMuted, fontSize: 14),
        ),
      ],
    ),
  );
}
