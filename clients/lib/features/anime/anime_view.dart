import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anilist_providers.dart';
import '../../app/anime_providers.dart';
import '../../app/cw_advance_provider.dart'
    show stremioLibraryProvider, simklCompletedIdsProvider;
import '../../app/feed_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/mal_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../home/continue_watching_section.dart';
import '../home/hero_carousel.dart' show HeroCarousel;
import 'anime_genre_picker.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/focus/tv_row.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/adult_filter.dart' show adultContentHidden;
import '../../domain/addons/models.dart';
import '../../domain/anime/anime_awards.dart' show parseAwardYear;
import '../../domain/anime/anime_country.dart';
import '../../domain/anime/anime_filter.dart';
import '../../domain/anime/anime_hero.dart';
import '../../domain/anime/anime_rows.dart';
import '../../domain/anime/anime_top_picks.dart';
import '../../domain/anime/watch_history_recs.dart';
import '../../domain/catalog/hero_slide.dart';
import '../../domain/feed/feed_seed.dart' show dayIndex;
import '../../domain/i18n/translations.dart';
import '../../domain/library/playback_history.dart' show WatchedSet;
import '../../domain/nav/frame.dart';

/// One loaded anime row's state. [failed] distinguishes a fetch error (e.g.
/// Jikan rate-limiting the many per-visit queries) from a genuinely empty row.
typedef _AnimeRow = ({List<MetaPreview> metas, bool ready, bool failed});

/// The Anime view — the browse rows (airing, top-on-MAL, era and genre) fed by
/// Jikan, batch-loaded so the page fills progressively. Ported from the row
/// backbone of `views/anime.tsx`; the hero, genre picker, award and tracker
/// rows layer on top.
class AnimeView extends ConsumerStatefulWidget {
  const AnimeView({super.key});

  @override
  ConsumerState<AnimeView> createState() => _AnimeViewState();
}

class _AnimeViewState extends ConsumerState<AnimeView> {
  final Map<String, _AnimeRow> _rows = {};
  bool _loading = true;

  /// The personalized "For You" picks (web `topPicks`). Assembled after the
  /// browse rows so it never delays them, and re-assembled when the genre-picker
  /// tunes `animeFavoriteGenres`.
  List<MetaPreview> _topPicks = const [];

  /// The anime hero carousel slides (web AnimeHero big slides) + the metas behind
  /// them, so the top-picks assembly can exclude what the hero already surfaces.
  List<HeroSlide> _heroSlides = const [];
  List<MetaPreview> _heroMetas = const [];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _load();
    // The top-picks gather adds a handful of Jikan queries; run it only once the
    // browse rows have finished so it never competes with them for the throttle.
    if (mounted) await _loadTopPicks();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _rows.clear();
        _loading = true;
      });
    }
    final specs = ref.read(animeRowSpecsProvider);
    const batch = 6;
    for (var i = 0; i < specs.length; i += batch) {
      if (!mounted) return;
      final slice = specs.sublist(i, (i + batch).clamp(0, specs.length));
      await Future.wait(
        slice.map((s) async {
          try {
            // Cap each row so one stalled Jikan query can't leave the row
            // skeleton (or the finished-loading state) hanging indefinitely.
            final metas = await s
                .fetcher(1)
                .timeout(
                  const Duration(seconds: 45),
                  onTimeout: () => const <MetaPreview>[],
                );
            // Fill in country of origin (via AniList) so the origin filter can
            // act — non-fatal + capped at 4s (web `enrichAnimeCountry`).
            final enriched = metas.isEmpty
                ? metas
                : await enrichAnimeCountry(
                    ref.read(anilistClientProvider),
                    metas,
                  ).timeout(const Duration(seconds: 4), onTimeout: () => metas);
            if (mounted) {
              setState(
                () =>
                    _rows[s.key] = (metas: enriched, ready: true, failed: false),
              );
            }
          } catch (_) {
            if (mounted) {
              setState(
                () =>
                    _rows[s.key] = (metas: const [], ready: true, failed: true),
              );
            }
          }
        }),
      );
      // Rebuild the hero as each batch lands so it fills in progressively (web
      // builds it once ~2 rows are ready).
      _rebuildHero();
      // Stagger the batches to respect the Jikan rate limit.
      if (i + batch < specs.length && mounted) {
        await Future<void>.delayed(const Duration(milliseconds: 350));
      }
    }
    _rebuildHero();
    if (mounted) setState(() => _loading = false);
  }

  /// Rebuilds the hero slide selection from the currently-loaded rows (web
  /// `buildHeroSelection`). Seeded by the day so slides stay stable within a day.
  void _rebuildHero() {
    final settings = ref.read(settingsProvider);
    final excludeOrigins = settings.getStringList('animeExcludeOrigins');
    final hideWatched = settings.getBool('animeHideWatchedPicks');
    final watched = _effectiveWatched();
    final awards = ref.read(animeAwardsProvider).value;
    final anilistTrending =
        ref.read(anilistTrendingAnimeProvider).value ?? const [];
    bool keep(MetaPreview m) => !animeFiltered(
      m,
      excludeOrigins: excludeOrigins,
      hideWatched: hideWatched,
      isWatched: (x) => watched.contains(x.id, x.name),
    );
    bool isWinner(MetaPreview m) =>
        awards?.findTopAward(
          m.name,
          releaseYear: parseAwardYear(m.releaseInfo),
        ) !=
        null;
    final metas = buildAnimeHeroSelection(
      rowMetas: (k) {
        final r = _rows[k];
        return (r != null && r.ready) ? r.metas : const [];
      },
      allKeys: _rows.keys,
      seed: dayIndex(DateTime.now()),
      keep: keep,
      isWinner: isWinner,
      anilistTrending: anilistTrending,
    );
    if (!mounted) return;
    setState(() {
      _heroMetas = metas;
      _heroSlides = [
        for (var i = 0; i < metas.length; i++)
          HeroSlide(
            meta: Meta(metas[i].json),
            rankLabel: 'Anime',
            rankPosition: i + 1,
          ),
      ];
    });
  }

  /// A monotonically-increasing per-launch counter, persisted like the web
  /// `nextVisit()` — folded into the daily seed so the picks rotate visit to
  /// visit within a day.
  int _nextVisit() {
    const key = 'harbor.anime.toppicks.visit.v1';
    final kv = ref.read(kvStoreProvider);
    final cur = int.tryParse(kv.getString(key) ?? '0') ?? 0;
    final next = cur + 1;
    kv.setString(key, '$next');
    return next;
  }

  /// The watched set the anime room hides against — local playback history plus
  /// the ids Simkl marks `completed` (web folds `simklWatchedMap` into the same
  /// hide-watched filter). So a title finished on Simkl is hidden from the rows,
  /// hero and picks even if it was never played on this device.
  WatchedSet _effectiveWatched() {
    final watched = ref.read(recentlyPlayedProvider);
    final simklCompleted =
        ref.read(simklCompletedIdsProvider).value ?? const <String>{};
    if (simklCompleted.isEmpty) return watched;
    return WatchedSet({...watched.ids, ...simklCompleted}, watched.titles);
  }

  /// Assembles the "For You" picks — watch-history recs → the affinity/genre/
  /// sequel gather → country enrichment — and stores the result. 1:1 with the
  /// web `useAnimeTopPicks` + `useWatchHistoryRecommendations` composition; a
  /// failure just leaves the rail hidden (never blocks the page).
  Future<void> _loadTopPicks() async {
    final jikan = ref.read(jikanClientProvider);
    final kitsu = ref.read(kitsuClientProvider);
    final kv = ref.read(kvStoreProvider);
    final settings = ref.read(settingsProvider);
    final cw = ref.read(continueWatchingProvider);
    final libItems = ref.read(stremioLibraryProvider).value ?? const [];
    final affinity = ref.read(affinityStoreProvider).affinity();
    final watched = _effectiveWatched();
    final prefs = ref.read(feedPreferencesStoreProvider);
    final voted = {...prefs.downvotedIds(), ...prefs.upvotedIds()};
    final hideAdult = adultContentHidden({'hideContent': settings['hideContent']});
    final favoriteGenres = settings.getIntList('animeFavoriteGenres');
    final cwNames = [for (final e in cw) e.name];
    final cwSeeds = [for (final e in cw) (id: e.id, name: e.name)];

    try {
      final recs = await watchHistoryRecommendations(jikan, kv, cwSeeds);
      if (!mounted) return;
      final today = dayIndex(DateTime.now());
      final picks = await assembleAnimeTopPicks(
        jikan: jikan,
        kitsu: kitsu,
        kv: kv,
        libItems: libItems,
        continueWatchingNames: cwNames,
        heroMetas: _heroMetas,
        watchHistoryRecs: recs,
        favoriteGenres: favoriteGenres,
        affinity: affinity,
        watched: watched,
        voted: voted,
        hideAdult: hideAdult,
        seed: today * 1000 + _nextVisit(),
        pageSeed: today,
      );
      if (!mounted) return;
      // Fill country of origin so the origin filter can act on the picks too
      // (non-fatal, 4s cap — matches the row enrichment).
      final enriched = picks.isEmpty
          ? picks
          : await enrichAnimeCountry(
              ref.read(anilistClientProvider),
              picks,
            ).timeout(const Duration(seconds: 4), onTimeout: () => picks);
      if (mounted) setState(() => _topPicks = enriched);
    } catch (_) {
      // The rail simply stays hidden — the browse rows carry the page.
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final specs = ref.watch(animeRowSpecsProvider);
    final g = pageGutter(Idiom.of(context));

    // AniList-trending and the award list resolve independently of the Jikan
    // rows — fold them into the hero the moment they land (web rebuilds the hero
    // when `anilistTrending` / winners change).
    ref.listen(anilistTrendingAnimeProvider, (_, next) {
      if (next.hasValue) _rebuildHero();
    });
    ref.listen(animeAwardsProvider, (_, next) {
      if (next.hasValue) _rebuildHero();
    });

    // The user's anime filters — exclude origins (default Chinese donghua) +
    // hide already-watched picks. Ported from `animeFiltered`.
    final settings = ref.watch(settingsProvider);
    final excludeOrigins = settings.getStringList('animeExcludeOrigins');
    final hideWatched = settings.getBool('animeHideWatchedPicks');
    // Watch both sources so the rows re-filter when either the local history or
    // the Simkl-completed set updates.
    ref.watch(recentlyPlayedProvider);
    ref.watch(simklCompletedIdsProvider);
    final watched = _effectiveWatched();
    List<MetaPreview> filteredMetas(String key) {
      final r = _rows[key];
      if (r == null || r.metas.isEmpty) return const [];
      return animeFilterRow(
        r.metas,
        excludeOrigins: excludeOrigins,
        hideWatched: hideWatched,
        isWatched: (m) => watched.contains(m.id, m.name),
      );
    }

    // A fetch actually returned something for at least one row (the retry state
    // gates on fetch success, not on the filtered result).
    final hasContent = _rows.values.any((r) => r.metas.isNotEmpty);
    // The first row (in spec order) with content that survives the filter — its
    // poster takes the remote's focus on a TV so the page has a target.
    String? firstContentKey;
    for (final spec in specs) {
      if (filteredMetas(spec.key).isNotEmpty) {
        firstContentKey = spec.key;
        break;
      }
    }

    return Container(
      color: t.canvas,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(g, 56, g, 16),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome, color: t.accent, size: 22),
                  const SizedBox(width: 10),
                  Text(
                    'Anime',
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 30,
                      fontWeight: FontWeight.w500,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const Spacer(),
                  _tuneButton(t, tr),
                ],
              ),
            ),
          ),
          // The anime hero — big rotating backdrop slides (web AnimeHero), fed
          // from the loaded rows' background-bearing metas. Needs ≥3 slides to
          // be a carousel (web threshold); otherwise the room leads with the
          // header alone.
          if (_heroSlides.length >= 3)
            SliverToBoxAdapter(
              child: HeroCarousel(
                overrideSlides: _heroSlides,
                eyebrow: tr.t('Featured anime'),
              ),
            ),
          // The personalized "For You" rail — the affinity / watch-history /
          // finished-franchise picks (web AnimeHero's topPicks Row). Sits at the
          // top of the room; hides until it has filter-surviving picks.
          SliverToBoxAdapter(
            child: _forYouRow(
              t,
              tr.t('For You'),
              excludeOrigins: excludeOrigins,
              hideWatched: hideWatched,
              watched: watched,
            ),
          ),
          // The anime room's own Continue-Watching shelf (anime titles only);
          // self-hides when empty.
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: ContinueWatchingSection(audience: CwAudience.anime),
            ),
          ),
          // The public AniList browse rails (Trending + Top 100), 1:1 with web
          // AnilistTrendingRow / AnilistTopRow — filtered like the other rows.
          SliverList.list(
            children: [
              _anilistRail(
                tr.t('Trending on AniList'),
                ref.watch(anilistTrendingAnimeProvider).value ?? const [],
                excludeOrigins: excludeOrigins,
                hideWatched: hideWatched,
                watched: watched,
                tokens: t,
              ),
              _anilistRail(
                tr.t('Top 100 on AniList'),
                ref.watch(anilistTopAnimeProvider).value ?? const [],
                excludeOrigins: excludeOrigins,
                hideWatched: hideWatched,
                watched: watched,
                tokens: t,
              ),
            ],
          ),
          // The user's MAL list rails (Watching / Plan / …) when connected —
          // shown as-is (their own list is never watched-filtered).
          SliverList.list(
            children: [
              for (final rail
                  in ref.watch(malAnimeRailsProvider).value ?? const [])
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: TvRow(
                    title: tr.t(rail.title),
                    items: rail.metas,
                    tokens: t,
                    viewAll: false,
                    onSelect: (m) => ref
                        .read(navControllerProvider.notifier)
                        .push(
                          Frame(FrameKind.meta, {'type': m.type, 'id': m.id}),
                        ),
                  ),
                ),
            ],
          ),
          // The page opens immediately and each row fills in independently — a
          // skeleton until it resolves, its posters when ready, hidden once it
          // comes back empty (web `anime.tsx` progressive rows). A full-page
          // spinner would keep the whole view dark while Jikan rate-limits the
          // many per-visit queries — the reason the tab appeared to never open.
          SliverList.list(
            children: [
              for (final spec in specs)
                _row(
                  spec,
                  t,
                  filteredMetas(spec.key),
                  autofocus: spec.key == firstContentKey,
                ),
            ],
          ),
          // Only once every row has finished with nothing (Jikan fully
          // rate-limited or offline) do we surface an actionable retry.
          if (!_loading && !hasContent)
            SliverFillRemaining(hasScrollBody: false, child: _errorState(t)),
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }

  /// A placeholder rail shown while a row's Jikan query is still in flight — the
  /// real title over greyed poster cells (web `RowSkeleton`), so the page shows
  /// its structure immediately instead of a blank spinner.
  Widget _skeletonRow(AnimeRowSpec spec, HarborTokens tokens) {
    final settings = ref.watch(settingsProvider);
    final scale = settings.getDouble('posterScale');
    final hideTitles = settings.getBool('hidePosterTitles');
    final width = scaledPosterCell(150, scale);
    final g = pageGutter(Idiom.of(context));
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(g, 4, g, 10),
            child: Text(
              spec.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: tokens.ink,
                fontSize: scaledRowTitle(
                  20,
                  settings.getDouble('rowTitleScale'),
                ),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          SizedBox(
            height: scaledRailHeight(scale, hideTitles: hideTitles),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: 6,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) =>
                  _skeletonCard(width, hideTitles, tokens),
            ),
          ),
        ],
      ),
    );
  }

  Widget _skeletonCard(double width, bool hideTitles, HarborTokens tokens) =>
      SizedBox(
        width: width,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: width,
              height: width * 1.5,
              decoration: BoxDecoration(
                color: tokens.raised,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            if (!hideTitles) ...[
              const SizedBox(height: 8),
              Container(
                width: width * 0.7,
                height: 10,
                decoration: BoxDecoration(
                  color: tokens.raised,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ],
        ),
      );

  Widget _errorState(HarborTokens t) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off_rounded, color: t.inkSubtle, size: 40),
          const SizedBox(height: 16),
          Text(
            "Couldn't load anime right now",
            style: TextStyle(
              color: t.ink,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Text(
              'The MyAnimeList catalog is busy or rate-limiting. Give it a '
              'moment and try again.',
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 13.5, height: 1.5),
            ),
          ),
          const SizedBox(height: 20),
          Focusable(
            tokens: t,
            autofocus: true,
            borderRadius: 999,
            onPressed: _bootstrap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: t.raised,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: t.edgeSoft),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.refresh, size: 16, color: t.ink),
                  const SizedBox(width: 8),
                  Text(
                    'Retry',
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );

  /// A public AniList browse rail (Trending / Top 100) — filtered like the spec
  /// rows, self-hiding when the filter empties it.
  /// The header "Tune" action — opens the genre/origin/hide-watched picker (web
  /// AnimeGenrePicker) and re-assembles the picks on save. Shows a count badge
  /// when the viewer has chosen favorite genres.
  Widget _tuneButton(HarborTokens tokens, Translations tr) {
    final count = ref.watch(settingsProvider).getIntList('animeFavoriteGenres').length;
    return Focusable(
      borderRadius: 20,
      onPressed: () => showAnimeGenrePicker(context, onSaved: _loadTopPicks),
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: tokens.canvas.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: tokens.edgeSoft.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.tune_rounded, size: 16, color: tokens.inkMuted),
            const SizedBox(width: 7),
            Text(
              tr.t('Tune'),
              style: TextStyle(
                color: tokens.inkMuted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 7),
              Container(
                width: 18,
                height: 18,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: tokens.accent.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: tokens.accent,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// The "For You" top-picks rail — the assembled picks, run through the same
  /// origin / hide-watched filter as every other row. Self-hides while empty or
  /// once nothing survives the filter (web renders the Row only when non-empty).
  Widget _forYouRow(
    HarborTokens tokens,
    String title, {
    required List<String> excludeOrigins,
    required bool hideWatched,
    required WatchedSet watched,
  }) {
    if (_topPicks.isEmpty) return const SizedBox.shrink();
    final items = animeFilterRow(
      _topPicks,
      excludeOrigins: excludeOrigins,
      hideWatched: hideWatched,
      isWatched: (m) => watched.contains(m.id, m.name),
    );
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TvRow(
        title: title,
        items: items,
        tokens: tokens,
        viewAll: false,
        onSelect: (m) => ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id})),
      ),
    );
  }

  Widget _anilistRail(
    String title,
    List<MetaPreview> metas, {
    required List<String> excludeOrigins,
    required bool hideWatched,
    required WatchedSet watched,
    required HarborTokens tokens,
  }) {
    final items = animeFilterRow(
      metas,
      excludeOrigins: excludeOrigins,
      hideWatched: hideWatched,
      isWatched: (m) => watched.contains(m.id, m.name),
    );
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TvRow(
        title: title,
        items: items,
        tokens: tokens,
        viewAll: false,
        onSelect: (m) => ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id})),
      ),
    );
  }

  Widget _row(
    AnimeRowSpec spec,
    HarborTokens tokens,
    List<MetaPreview> items, {
    bool autofocus = false,
  }) {
    final row = _rows[spec.key];
    // Not fetched yet → a skeleton placeholder (web `RowSkeleton`).
    if (row == null || !row.ready) return _skeletonRow(spec, tokens);
    // Resolved but empty / all-filtered → hide the row (web returns null).
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TvRow(
        title: spec.title,
        items: items,
        tokens: tokens,
        viewAll: false,
        autofocusFirst: autofocus,
        onSelect: (m) => ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id})),
      ),
    );
  }
}
