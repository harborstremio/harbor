import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../domain/ai/ai_models.dart';
import '../../domain/ai/ai_search.dart';
import '../../domain/library/manual_watched.dart';
import '../../design/ai/ai_example_hint.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/tmdb.dart';
import '../../domain/catalog/tmdb_details.dart';
import '../../domain/catalog/tvdb.dart';
import '../../domain/i18n/translations.dart';
import 'anime_season_picker.dart' show UpcomingBadge;
import 'upcoming.dart';
import '../../domain/settings/settings.dart';
import '../../domain/spoilers/spoiler_mask.dart';
import 'episode_download_button.dart';
import '../../design/focus/tv_text_field.dart';

/// The TMDB still URL for an episode at the size chosen by `hdEpisodeImages`
/// (`original` when on, else `w300`), or null when there is no still — ported
/// from `series-episode-row.tsx` / `episode-strip.tsx`.
String? episodeStillUrl(String? stillPath, bool hd) =>
    stillPath == null ? null : '$tmdbImg/${hd ? 'original' : 'w300'}$stillPath';

/// The fixed height of the horizontal `strip` episode layout: a 244px-wide 16:9
/// still (~137) + the title/meta block below.
const double _kStripHeight = 200;

/// Enriches a TMDB episode with TVDB data, ported from `use-episode-enrich`: a
/// longer overview wins, and a missing runtime / name / air date is filled.
Episode _enrich(Episode e, TvdbEpisode? tv) {
  if (tv == null) return e;
  final overview =
      (tv.overview != null &&
          tv.overview!.trim().length > e.overview.trim().length)
      ? tv.overview!
      : e.overview;
  return e.copyWith(
    overview: overview,
    runtime: e.runtime ?? tv.runtime,
    name: e.name.isNotEmpty ? e.name : (tv.name ?? e.name),
    airDate: e.airDate ?? tv.aired,
  );
}

/// The keyed-series season/episode grid, ported from `episode-grid.tsx` +
/// `episode-grid-card.tsx`: a focusable season picker over `detail.seasons` and
/// a grid of episode cards (still, number, title, air date · runtime · rating,
/// overview) for the selected season, honoring the `episodeSort` setting. Each
/// card opens the play-picker for that episode.
class SeasonEpisodesGrid extends ConsumerStatefulWidget {
  const SeasonEpisodesGrid({
    super.key,
    required this.tvId,
    required this.metaId,
    required this.title,
    required this.seasons,
    required this.onPlay,
    required this.tokens,
    this.onOpenDetail,
    this.onDownload,
    this.onDownloadSeason,
    this.imdbId,
  });

  final int tvId;

  /// The nav meta id, keying the per-series last-viewed-season memory.
  final String metaId;

  /// The series title, grounding the AI episode finder.
  final String title;
  final List<Season> seasons;
  final void Function(int season, int episode) onPlay;

  /// Opens the episode-detail page for an episode (the primary card tap when
  /// provided); falls back to [onPlay] when null.
  final void Function(int season, int episode)? onOpenDetail;

  /// Opens the play-picker in download intent for an episode; when provided,
  /// each card shows a download control. Null hides it (e.g. tvOS).
  final void Function(int season, int episode)? onDownload;

  /// Opens the play-picker in download-season intent for the shown season; when
  /// provided, a "Download season" action sits in the episodes header.
  final void Function(int season)? onDownloadSeason;
  final HarborTokens tokens;

  /// The series' imdb id, for fresh per-episode IMDb ratings.
  final String? imdbId;

  @override
  ConsumerState<SeasonEpisodesGrid> createState() => _SeasonEpisodesGridState();
}

class _SeasonEpisodesGridState extends ConsumerState<SeasonEpisodesGrid> {
  late int _season;

  /// AI episode-finder mode: a natural-language query that identifies episodes
  /// across every season. Ported from `episode-ai-mode.tsx`.
  bool _aiMode = false;
  final _aiController = TextEditingController();
  final _aiFocus = FocusNode();

  /// 'idle' before a query runs, 'loading' while the model answers, 'done'
  /// once matches (or the keyword fallback) are ready.
  String _aiStatus = 'idle';
  List<Episode> _aiMatches = const [];
  bool _aiFellBack = false;
  String _aiRanQuery = '';

  /// Lazily-loaded cross-season episode catalog, fetched on the first AI query
  /// (every season's episodes flattened) and reused for later queries.
  List<Episode>? _allEpisodes;

  /// The active translator; `build` watches it so a language change repaints.
  Translations get _tr => ref.read(translationsProvider);

  @override
  void initState() {
    super.initState();
    // Restore the last-viewed season for this series when it is still present.
    final saved = ref
        .read(lastSeasonStoreProvider)
        .getLastSeason(widget.metaId);
    _season =
        (saved != null && widget.seasons.any((s) => s.seasonNumber == saved))
        ? saved
        : widget.seasons.first.seasonNumber;
  }

  @override
  void dispose() {
    _aiController.dispose();
    _aiFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    ref.watch(translationsProvider); // repaint on a language change
    final settings = ref.watch(settingsProvider);
    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);
    final newest = settings.getString('episodeSort') == 'newest';
    final showRating = settings.getBool('showEpisodeRating');
    final showDescription = settings.getBool('showEpisodeDescription');
    final hdImages = settings.getBool('hdEpisodeImages');
    final watchedKeys = ref.watch(manualWatchedProvider);
    final resumeStore = ref.read(resumeStoreProvider);
    bool isWatched(Episode e) => watchedKeys.contains(
      ManualWatchedStore.episodeKey(
        widget.metaId,
        e.seasonNumber,
        e.episodeNumber,
      ),
    );
    final async = ref.watch(
      seasonEpisodesProvider((tvId: widget.tvId, season: _season)),
    );
    // Per-episode IMDb ratings, preferred over the TMDB vote average: fresh
    // Harbor IMDb (keyed "season:episode") first, then OMDB for this season.
    final harborRatings = widget.imdbId != null
        ? (ref.watch(harborImdbEpisodesProvider(widget.imdbId!)).value ??
              const <String, double>{})
        : const <String, double>{};
    final omdbRatings = widget.imdbId != null
        ? (ref
                  .watch(
                    omdbSeasonRatingsProvider((
                      imdbId: widget.imdbId!,
                      season: _season,
                    )),
                  )
                  .value ??
              const <int, double>{})
        : const <int, double>{};
    // TVDB episode enrichment (longer overview, missing runtime/name/air date).
    final tvdbEps = widget.imdbId != null
        ? (ref
                  .watch(
                    tvdbSeasonEpisodesProvider((
                      imdbId: widget.imdbId!,
                      season: _season,
                    )),
                  )
                  .value ??
              const <int, TvdbEpisode>{})
        : const <int, TvdbEpisode>{};

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Builder(
          builder: (context) {
            final title = Text(
              _tr.t('Episodes'),
              style: TextStyle(
                color: t.ink,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            );
            // Sort order (Oldest / Newest) writes the episodeSort setting the
            // grid reads.
            final chips = <Widget>[
              _aiChip(t),
              if (widget.onDownloadSeason != null) _downloadSeasonChip(t),
              _layoutToggle(t, settings),
              _sortChip(t, _tr.t('Oldest'), !newest, () {
                ref
                    .read(settingsProvider.notifier)
                    .setValue('episodeSort', 'oldest');
              }),
              _sortChip(t, _tr.t('Newest'), newest, () {
                ref
                    .read(settingsProvider.notifier)
                    .setValue('episodeSort', 'newest');
              }),
            ];
            return Padding(
              padding: EdgeInsets.fromLTRB(g, 0, g, 14),
              child: _aiMode
                  ? _aiSearchBar(t)
                  // Phone stacks the title over a wrapping chip row so the
                  // controls never overflow; wide keeps the single row.
                  : idiom.isPhone
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        title,
                        const SizedBox(height: 10),
                        Wrap(spacing: 8, runSpacing: 8, children: chips),
                      ],
                    )
                  // Right-align the controls, letting them wrap onto a second
                  // line rather than overflow when the season/AI/toggle/sort
                  // chips together exceed the content width.
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        title,
                        const SizedBox(width: 16),
                        Expanded(
                          child: Wrap(
                            alignment: WrapAlignment.end,
                            spacing: 8,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: chips,
                          ),
                        ),
                      ],
                    ),
            );
          },
        ),
        if (_aiMode) _aiPanel(t),
        // Season picker.
        if (!_aiMode && widget.seasons.length > 1)
          SizedBox(
            height: 40,
            child: FocusTraversalGroup(
              policy: ReadingOrderTraversalPolicy(),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: EdgeInsets.fromLTRB(g, 0, g, 0),
                itemCount: widget.seasons.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final s = widget.seasons[i];
                  final selected = s.seasonNumber == _season;
                  return Focusable(
                    tokens: t,
                    borderRadius: 999,
                    onPressed: () {
                      setState(() => _season = s.seasonNumber);
                      ref
                          .read(lastSeasonStoreProvider)
                          .setLastSeason(widget.metaId, s.seasonNumber);
                    },
                    child: Container(
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: selected
                            ? t.ink
                            : t.canvas.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(999),
                        border: selected ? null : Border.all(color: t.edgeSoft),
                      ),
                      child: Text(
                        s.name.isNotEmpty ? s.name : 'Season ${s.seasonNumber}',
                        style: TextStyle(
                          color: selected ? t.canvas : t.inkMuted,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        if (!_aiMode) const SizedBox(height: 16),
        if (!_aiMode)
          Padding(
            padding: EdgeInsets.symmetric(horizontal: g),
            child: async.when(
              loading: () => Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Center(
                  child: CircularProgressIndicator(
                    color: t.accent,
                    strokeWidth: 2,
                  ),
                ),
              ),
              error: (_, _) => const SizedBox.shrink(),
              data: (episodes) {
                if (episodes.isEmpty) return const SizedBox.shrink();
                final ordered = newest ? episodes.reversed.toList() : episodes;
                // The next-up episode is the first unwatched one in air order.
                final nextUp = episodes.cast<Episode?>().firstWhere(
                  (e) => !isWatched(e!),
                  orElse: () => null,
                );
                double? ratingFor(Episode e) =>
                    harborRatings['${e.seasonNumber}:${e.episodeNumber}'] ??
                    omdbRatings[e.episodeNumber] ??
                    e.voteAverage?.toDouble();
                SpoilerMask maskFor(Episode e) => spoilerMaskFor(
                  settings,
                  watched: isWatched(e),
                  isNextUp:
                      nextUp?.seasonNumber == e.seasonNumber &&
                      nextUp?.episodeNumber == e.episodeNumber,
                );
                VoidCallback? detailFor(Episode e) =>
                    widget.onOpenDetail == null
                    ? null
                    : () =>
                          widget.onOpenDetail!(e.seasonNumber, e.episodeNumber);
                VoidCallback? downloadFor(Episode e) =>
                    widget.onDownload == null
                    ? null
                    : () => widget.onDownload!(e.seasonNumber, e.episodeNumber);

                _EpisodeCard card(Episode e, {required bool strip}) =>
                    _EpisodeCard(
                      metaId: widget.metaId,
                      episode: _enrich(e, tvdbEps[e.episodeNumber]),
                      rating: ratingFor(e),
                      showRating: showRating,
                      showDescription: showDescription,
                      hdImages: hdImages,
                      watched: isWatched(e),
                      resumeMs: resumeStore.readResumeMs(
                        widget.metaId,
                        e.seasonNumber,
                        e.episodeNumber,
                      ),
                      mask: maskFor(e),
                      tokens: t,
                      stripCompact: strip,
                      onPlay: () =>
                          widget.onPlay(e.seasonNumber, e.episodeNumber),
                      onOpenDetail: detailFor(e),
                      onDownload: downloadFor(e),
                      onContextMenu: () => _openWatchedMenu(
                        context,
                        t,
                        e,
                        isWatched(e),
                        ordered,
                      ),
                    );

                // The `episodeLayout` setting (list | strip | grid) picks the
                // episode presentation, 1:1 with `series-episodes.tsx`.
                final layout = settings.getString('episodeLayout');
                if (layout == 'strip') {
                  return FocusTraversalGroup(
                    policy: ReadingOrderTraversalPolicy(),
                    child: SizedBox(
                      height: _kStripHeight,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        clipBehavior: Clip.none,
                        itemCount: ordered.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 16),
                        itemBuilder: (_, i) => SizedBox(
                          width: 244,
                          child: card(ordered[i], strip: true),
                        ),
                      ),
                    ),
                  );
                }
                if (layout == 'grid') {
                  return FocusTraversalGroup(
                    policy: ReadingOrderTraversalPolicy(),
                    child: Wrap(
                      spacing: 18,
                      runSpacing: 24,
                      children: [
                        for (final e in ordered) card(e, strip: false),
                      ],
                    ),
                  );
                }
                // Default: the list layout (a column of wide rows).
                return FocusTraversalGroup(
                  policy: ReadingOrderTraversalPolicy(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final e in ordered)
                        _EpisodeListRow(
                          metaId: widget.metaId,
                          episode: _enrich(e, tvdbEps[e.episodeNumber]),
                          rating: ratingFor(e),
                          showRating: showRating,
                          hdImages: hdImages,
                          watched: isWatched(e),
                          resumeMs: resumeStore.readResumeMs(
                            widget.metaId,
                            e.seasonNumber,
                            e.episodeNumber,
                          ),
                          mask: maskFor(e),
                          tokens: t,
                          onPlay: () =>
                              widget.onPlay(e.seasonNumber, e.episodeNumber),
                          onOpenDetail: detailFor(e),
                          onDownload: downloadFor(e),
                          onContextMenu: () => _openWatchedMenu(
                            context,
                            t,
                            e,
                            isWatched(e),
                            ordered,
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  /// The list / horizontal / grid layout toggle — three D-pad-focusable icon
  /// buttons in a pill, writing the `episodeLayout` setting. Ported 1:1 from
  /// `episode-layout-toggle.tsx` (List / GalleryHorizontal / LayoutGrid).
  Widget _layoutToggle(HarborTokens t, Settings settings) {
    final current = settings.getString('episodeLayout');
    const options = <(String, IconData, String)>[
      ('list', Icons.view_list_rounded, 'List view'),
      ('strip', Icons.view_carousel_rounded, 'Horizontal view'),
      ('grid', Icons.grid_view_rounded, 'Grid view'),
    ];
    return Container(
      height: 34,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final (key, icon, label) in options)
            Semantics(
              label: _tr.t(label),
              button: true,
              selected: current == key,
              child: Focusable(
                tokens: t,
                scale: 1.0,
                borderRadius: 999,
                onPressed: () => ref
                    .read(settingsProvider.notifier)
                    .setValue('episodeLayout', key),
                child: Container(
                  width: 30,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: current == key ? t.ink : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Icon(
                    icon,
                    size: 15,
                    color: current == key ? t.canvas : t.inkMuted,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// A compact Oldest/Newest sort chip; the active order is filled.
  Widget _sortChip(
    HarborTokens t,
    String label,
    bool active,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: active ? t.accentSoft : t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: active ? t.accent : t.edgeSoft),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: active ? t.accent : t.inkMuted,
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );

  /// The "Download season" action in the episodes header, opening the picker in
  /// download-season intent for the selected season (web hero `download-season`
  /// `EpisodeDownloadButton`).
  Widget _downloadSeasonChip(HarborTokens t) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: () => widget.onDownloadSeason!(_season),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.download_rounded, size: 15, color: t.inkMuted),
          const SizedBox(width: 6),
          Text(
            _tr.t('Download season'),
            style: TextStyle(
              color: t.inkMuted,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  /// The "Ask AI" chip that enters the episode AI-finder mode and focuses its
  /// query field (web `episode-grid` AI toggle).
  Widget _aiChip(HarborTokens t) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: () {
      setState(() => _aiMode = true);
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _aiFocus.requestFocus(),
      );
    },
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.auto_awesome, size: 15, color: t.inkMuted),
          const SizedBox(width: 6),
          Text(
            _tr.t('Ask AI'),
            style: TextStyle(
              color: t.inkMuted,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  /// The AI-mode query bar that replaces the episodes header: a text field, a
  /// "Find" action, and an exit control (web `episode-ai-mode` form).
  Widget _aiSearchBar(HarborTokens t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    decoration: BoxDecoration(
      color: t.accentSoft.withValues(alpha: 0.5),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: t.accent.withValues(alpha: 0.5)),
    ),
    child: Row(
      children: [
        Icon(Icons.auto_awesome, size: 18, color: t.accent),
        const SizedBox(width: 12),
        Expanded(
          child: Stack(
            children: [
              TvTextField(
                controller: _aiController,
                focusNode: _aiFocus,
                autofocus: true,
                style: TextStyle(color: t.ink, fontSize: 15),
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _submitAi(),
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  isCollapsed: true,
                  contentPadding: EdgeInsets.symmetric(vertical: 14),
                ),
              ),
              // The rotating example hint stands in for the placeholder.
              Positioned.fill(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _aiController,
                    builder: (context, value, _) => AiExampleHint(
                      hidden: value.text.trim().isNotEmpty,
                      examples: kEpisodeExamples,
                      tokens: t,
                      prefix: _tr.t('Describe the episode.'),
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 999,
          onPressed: _submitAi,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: t.accent,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              _tr.t('Find'),
              style: TextStyle(
                color: t.canvas,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        const SizedBox(width: 6),
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 999,
          onPressed: () => setState(() => _aiMode = false),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Icon(Icons.close_rounded, size: 18, color: t.inkMuted),
          ),
        ),
      ],
    ),
  );

  /// The AI-mode body: an idle prompt, a thinking spinner, the matched episode
  /// cards, or the keyword-match fallback (web `episode-ai-mode` states).
  Widget _aiPanel(HarborTokens t) {
    final settings = ref.watch(settingsProvider);
    Widget body;
    switch (_aiStatus) {
      case 'loading':
        body = Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  color: t.accent,
                  strokeWidth: 2,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Recalling the season · ${modelLabelFor(settings.getString('aiSearchModel'))}',
                style: TextStyle(color: t.inkMuted, fontSize: 13.5),
              ),
            ],
          ),
        );
      case 'done':
        if (!_aiFellBack && _aiMatches.isNotEmpty) {
          body = _aiEpisodeGrid(_aiMatches, t, settings);
        } else {
          final kw = _keywordMatches(_allEpisodes ?? const [], _aiRanQuery);
          body = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                kw.isEmpty
                    ? _tr.t('No episode matched that.')
                    : _tr.t('Showing keyword matches instead'),
                style: TextStyle(color: t.inkMuted, fontSize: 13.5),
              ),
              if (kw.isNotEmpty) ...[
                const SizedBox(height: 16),
                _aiEpisodeGrid(kw, t, settings),
              ],
            ],
          );
        }
      default:
        body = Text(
          _tr.t(
            'Ask AI to find an episode by vibe — a scene you remember, a '
            "quote, or a moment you can't place.",
          ),
          style: TextStyle(color: t.inkSubtle, fontSize: 13.5, height: 1.4),
        );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(48, 4, 48, 0),
      child: Align(alignment: Alignment.centerLeft, child: body),
    );
  }

  /// Renders episode cards for AI or keyword matches, tagged with their season
  /// (matches can span seasons).
  Widget _aiEpisodeGrid(List<Episode> eps, HarborTokens t, Settings settings) {
    final watchedKeys = ref.watch(manualWatchedProvider);
    final resumeStore = ref.read(resumeStoreProvider);
    final showRating = settings.getBool('showEpisodeRating');
    final showDescription = settings.getBool('showEpisodeDescription');
    final hdImages = settings.getBool('hdEpisodeImages');
    bool isWatched(Episode e) => watchedKeys.contains(
      ManualWatchedStore.episodeKey(
        widget.metaId,
        e.seasonNumber,
        e.episodeNumber,
      ),
    );
    return FocusTraversalGroup(
      policy: ReadingOrderTraversalPolicy(),
      child: Wrap(
        spacing: 18,
        runSpacing: 24,
        children: [
          for (final e in eps)
            _EpisodeCard(
              metaId: widget.metaId,
              episode: e,
              rating: e.voteAverage?.toDouble(),
              showRating: showRating,
              showDescription: showDescription,
              hdImages: hdImages,
              watched: isWatched(e),
              resumeMs: resumeStore.readResumeMs(
                widget.metaId,
                e.seasonNumber,
                e.episodeNumber,
              ),
              mask: spoilerMaskFor(
                settings,
                watched: isWatched(e),
                isNextUp: false,
              ),
              tokens: t,
              seasonInBadge: true,
              onPlay: () => widget.onPlay(e.seasonNumber, e.episodeNumber),
              onOpenDetail: widget.onOpenDetail == null
                  ? null
                  : () => widget.onOpenDetail!(e.seasonNumber, e.episodeNumber),
              onDownload: widget.onDownload == null
                  ? null
                  : () => widget.onDownload!(e.seasonNumber, e.episodeNumber),
              onContextMenu: () =>
                  _openWatchedMenu(context, t, e, isWatched(e), eps),
            ),
        ],
      ),
    );
  }

  /// Runs the AI episode finder over every season's episodes and shows the
  /// matches, falling back to keyword matches when the model finds nothing or
  /// no AI key is set (web `episode-ai-mode.submit`).
  Future<void> _submitAi() async {
    final q = _aiController.text.trim();
    if (q.isEmpty || _aiStatus == 'loading') return;
    setState(() {
      _aiStatus = 'loading';
      _aiFellBack = false;
      _aiRanQuery = q;
    });
    final settings = ref.read(settingsProvider);
    final configured = settings.getString('aiSearchModel').trim();
    final model = configured.isEmpty ? kDefaultAiModel : configured;
    final isGroq = providerForModel(model) == AiProvider.groq;
    final key =
        (isGroq
                ? settings.getString('aiGroqKey')
                : settings.getString('aiSearchKey'))
            .trim();
    final transport = ref.read(jsonTransportProvider);
    try {
      final all = await _loadAllEpisodes();
      if (!mounted) return;
      final candidates = <EpisodeCandidate>[
        for (final e in all)
          if (e.seasonNumber >= 1)
            (
              season: e.seasonNumber,
              episode: e.episodeNumber,
              name: e.name.isNotEmpty ? e.name : null,
              overview: e.overview.isNotEmpty ? e.overview : null,
            ),
      ];
      final picks = await aiFindEpisodes(
        transport: transport,
        key: key,
        model: model,
        showName: widget.title,
        episodes: candidates,
        query: q,
      );
      final found = <Episode>[];
      for (final r in picks) {
        for (final e in all) {
          if (e.seasonNumber == r.season && e.episodeNumber == r.episode) {
            found.add(e);
            break;
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _aiMatches = found;
        _aiFellBack = found.isEmpty;
        _aiStatus = 'done';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _aiMatches = const [];
        _aiFellBack = true;
        _aiStatus = 'done';
      });
    }
  }

  /// Fetches and caches every season's episodes, flattened, for the AI catalog
  /// and the keyword fallback.
  Future<List<Episode>> _loadAllEpisodes() async {
    final cached = _allEpisodes;
    if (cached != null) return cached;
    final client = ref.read(tmdbClientProvider);
    final all = <Episode>[];
    for (final s in widget.seasons) {
      try {
        all.addAll(
          await tmdbSeasonEpisodes(client, widget.tvId, s.seasonNumber),
        );
      } catch (_) {
        // A single season failing to load must not sink the whole catalog.
      }
    }
    _allEpisodes = all;
    return all;
  }

  /// The keyword fallback: episodes whose "sSeE · name · overview" contains the
  /// most query terms, best first, capped at 12 (web `CrossSeasonResults`).
  List<Episode> _keywordMatches(List<Episode> all, String query) {
    final terms = query
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((w) => w.length > 1)
        .toList();
    if (terms.isEmpty) return const [];
    final scored = <(Episode, int)>[];
    for (final e in all) {
      final hay =
          's${e.seasonNumber}e${e.episodeNumber} ${e.name} ${e.overview}'
              .toLowerCase();
      var score = 0;
      for (final term in terms) {
        if (hay.contains(term)) score++;
      }
      if (score > 0) scored.add((e, score));
    }
    scored.sort((a, b) => b.$2.compareTo(a.$2));
    return [for (final s in scored.take(12)) s.$1];
  }

  /// Opens the episode mark-watched menu (the native `EpisodeWatchedMenu`) and
  /// applies the chosen action to the manual-watched store. "Up to here" marks
  /// every loaded episode of this season up to and including the target,
  /// mirroring `setManualWatchedUpTo`.
  Future<void> _openWatchedMenu(
    BuildContext context,
    HarborTokens t,
    Episode e,
    bool watched,
    List<Episode> ordered,
  ) async {
    final notifier = ref.read(manualWatchedProvider.notifier);
    final id = widget.metaId;
    final result = await showContextMenu<String>(
      context: context,
      tokens: t,
      actions: watched
          ? [
              ContextMenuAction(
                value: 'unwatched',
                label: _tr.t('Mark as unwatched'),
                icon: Icons.visibility_off_outlined,
              ),
            ]
          : [
              ContextMenuAction(
                value: 'watched',
                label: _tr.t('Mark as watched'),
                icon: Icons.check,
              ),
              ContextMenuAction(
                value: 'upto',
                label: _tr.t('Mark watched up to here'),
                icon: Icons.visibility_outlined,
              ),
            ],
    );
    switch (result) {
      case 'watched':
        await notifier.setWatched(id, e.seasonNumber, e.episodeNumber, true);
      case 'unwatched':
        await notifier.setWatched(id, e.seasonNumber, e.episodeNumber, false);
      case 'upto':
        final eps = <(int, int)>[
          for (final x in ordered)
            if (x.seasonNumber == e.seasonNumber &&
                x.episodeNumber <= e.episodeNumber)
              (x.seasonNumber, x.episodeNumber),
        ];
        await notifier.markMany(id, eps, true);
    }
  }
}

/// The "New" episode badge (recently aired), ported from web `NewBadge` — a
/// solid accent pill (the web shimmer sweep is approximated with a flat fill).
class _NewBadge extends StatelessWidget {
  const _NewBadge({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: tokens.accent,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        'New',
        style: TextStyle(
          color: tokens.canvas,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _EpisodeCard extends StatefulWidget {
  const _EpisodeCard({
    required this.metaId,
    required this.episode,
    required this.rating,
    required this.showRating,
    required this.showDescription,
    required this.hdImages,
    required this.watched,
    required this.resumeMs,
    required this.mask,
    required this.tokens,
    required this.onPlay,
    required this.onContextMenu,
    this.onOpenDetail,
    this.onDownload,
    this.seasonInBadge = false,
    this.stripCompact = false,
  });

  /// In the horizontal `strip` layout the below-still description is dropped so
  /// every card keeps the fixed [_kStripHeight].
  final bool stripCompact;

  /// The nav meta id, for matching this episode to a live download.
  final String metaId;
  final Episode episode;

  /// Show the season in the corner badge (`S2·E5`) rather than just the episode
  /// number — used for cross-season AI/keyword match results.
  final bool seasonInBadge;

  /// Whether the episode is in the local watched set (a corner check shows).
  final bool watched;

  /// The saved resume position (ms); a progress bar shows for partial plays.
  final int resumeMs;

  /// Which parts of this card to blur for spoilers (revealed on focus).
  final SpoilerMask mask;

  /// The rating to show (fresh IMDb when available, else the TMDB vote).
  final double? rating;

  /// `showEpisodeRating` — gates the rating in the meta line.
  final bool showRating;

  /// `showEpisodeDescription` — gates the overview.
  final bool showDescription;

  /// `hdEpisodeImages` — full-resolution stills (`original`) vs `w300`.
  final bool hdImages;
  final HarborTokens tokens;
  final VoidCallback onPlay;

  /// Opens the episode-detail page; when set it is the primary card tap.
  final VoidCallback? onOpenDetail;

  /// Opens the play-picker in download intent for this episode; when set, the
  /// card overlays a download control on the still.
  final VoidCallback? onDownload;

  /// The secondary action — long-press or the remote context key — that opens
  /// the mark-watched menu for this episode.
  final VoidCallback onContextMenu;

  @override
  State<_EpisodeCard> createState() => _EpisodeCardState();
}

class _EpisodeCardState extends State<_EpisodeCard> {
  bool _focused = false;

  /// Blurs [child] to [sigma] when the mask is on and the card is unfocused,
  /// animating the reveal on focus — the native peek-on-hover of
  /// `SPOILER_THUMB_CLASS`/`SPOILER_TEXT_CLASS`.
  Widget _blur(bool on, double sigma, Widget child, {bool scale = false}) {
    final target = (on && !_focused) ? sigma : 0.0;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(end: target),
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      builder: (context, s, ch) => ImageFiltered(
        enabled: s > 0.05,
        imageFilter: ui.ImageFilter.blur(sigmaX: s, sigmaY: s),
        child: scale
            ? Transform.scale(scale: 1 + (s / sigma) * 0.04, child: ch)
            : ch,
      ),
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final episode = widget.episode;
    final watched = widget.watched;
    final mask = widget.mask;
    final still = episodeStillUrl(episode.stillPath, widget.hdImages);
    // Recency cue on the still: an unaired episode shows the Upcoming badge, one
    // aired within the last 3 days shows a New badge — 1:1 with web's episode
    // NewBadge / UpcomingBadge (isNewEpisode/isUpcomingEpisode).
    final epUpcoming = isFutureDate(episode.airDate);
    final epNew = airedWithinDays(episode.airDate, 3);
    // Resume progress for a partially-watched episode: ratio = position /
    // runtime, with the minutes left. Ported from getEpisodeProgress.
    final runtime = episode.runtime ?? 0;
    final durMs = runtime * 60000;
    final ratio = (!watched && durMs > 0 && widget.resumeMs > 0)
        ? (widget.resumeMs / durMs).clamp(0.0, 1.0)
        : 0.0;
    final showProgress = ratio > 0.01;
    final minsLeft = showProgress
        ? (runtime * (1 - ratio)).round().clamp(1, runtime)
        : 0;
    final meta = [
      if (episode.airDate != null && episode.airDate!.length >= 10)
        episode.airDate!.substring(0, 10),
      if (episode.runtime != null && episode.runtime! > 0)
        '${episode.runtime} min',
      if (widget.showRating && widget.rating != null && widget.rating! > 0)
        '★ ${widget.rating!.toStringAsFixed(1)}',
    ].join('  ·  ');

    return SizedBox(
      width: 260,
      child: Focusable(
        tokens: t,
        borderRadius: 12,
        onPressed: widget.onOpenDetail ?? widget.onPlay,
        onLongPress: widget.onContextMenu,
        onFocusChange: (f) => setState(() => _focused = f),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // The still is blurred for spoilers (revealed on focus);
                    // the number badge and watched check stay legible above it.
                    _blur(
                      mask.thumb,
                      7,
                      still != null
                          ? CachedNetworkImage(
                              imageUrl: still,
                              fit: BoxFit.cover,
                              placeholder: (_, _) =>
                                  ColoredBox(color: t.surface),
                              errorWidget: (_, _, _) => _fallback(),
                            )
                          : _fallback(),
                      scale: true,
                    ),
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: t.canvas.withValues(alpha: 0.95),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          widget.seasonInBadge
                              ? 'S${episode.seasonNumber} · E${episode.episodeNumber}'
                              : '${episode.episodeNumber}',
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    if (epUpcoming || epNew)
                      Positioned(
                        left: 8,
                        top: 34,
                        child: epUpcoming
                            ? UpcomingBadge(tokens: t)
                            : _NewBadge(tokens: t),
                      ),
                    if (watched)
                      Positioned(
                        right: 8,
                        top: 8,
                        child: Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: t.accent,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.check, size: 14, color: t.canvas),
                        ),
                      ),
                    // Resume progress bar + minutes-left tag (partial plays).
                    if (showProgress) ...[
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: ratio,
                          child: Container(height: 4, color: t.accent),
                        ),
                      ),
                      Positioned(
                        right: 8,
                        bottom: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: t.canvas.withValues(alpha: 0.9),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${minsLeft}m left',
                            style: TextStyle(
                              color: t.accent,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                    if (widget.onDownload != null)
                      Positioned(
                        left: 8,
                        bottom: showProgress ? 12 : 8,
                        child: EpisodeDownloadButton(
                          metaId: widget.metaId,
                          season: episode.seasonNumber,
                          episode: episode.episodeNumber,
                          onDownload: widget.onDownload!,
                          tokens: t,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: _blur(
                mask.title,
                5,
                Text(
                  episode.name.isNotEmpty
                      ? episode.name
                      : 'Episode ${episode.episodeNumber}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            if (meta.isNotEmpty) ...[
              const SizedBox(height: 3),
              Text(meta, style: TextStyle(color: t.inkSubtle, fontSize: 12)),
            ],
            if (!widget.stripCompact &&
                widget.showDescription &&
                episode.overview.isNotEmpty) ...[
              const SizedBox(height: 5),
              Align(
                alignment: Alignment.centerLeft,
                child: _blur(
                  mask.desc,
                  5,
                  Text(
                    episode.overview,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: t.inkMuted,
                      fontSize: 12.5,
                      height: 1.35,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _fallback() => ColoredBox(
    color: widget.tokens.surface,
    child: Center(
      child: Icon(Icons.tv_outlined, color: widget.tokens.inkSubtle, size: 28),
    ),
  );
}

/// One episode as a wide horizontal row — the `list` episode layout, ported from
/// `series-episode-row.tsx`: a 200px landscape still (number badge, watched
/// check, rating, resume bar) beside the title, meta line, and a two-line
/// overview, with the shared download control. Tap opens the episode detail (or
/// plays when there is none), long-press opens the watched menu — the same
/// interaction as the grid/strip card so only the presentation changes.
class _EpisodeListRow extends StatefulWidget {
  const _EpisodeListRow({
    required this.metaId,
    required this.episode,
    required this.rating,
    required this.showRating,
    required this.hdImages,
    required this.watched,
    required this.resumeMs,
    required this.mask,
    required this.tokens,
    required this.onPlay,
    required this.onContextMenu,
    this.onOpenDetail,
    this.onDownload,
  });

  final String metaId;
  final Episode episode;
  final double? rating;
  final bool showRating;
  final bool hdImages;
  final bool watched;
  final int resumeMs;
  final SpoilerMask mask;
  final HarborTokens tokens;
  final VoidCallback onPlay;
  final VoidCallback onContextMenu;
  final VoidCallback? onOpenDetail;
  final VoidCallback? onDownload;

  @override
  State<_EpisodeListRow> createState() => _EpisodeListRowState();
}

class _EpisodeListRowState extends State<_EpisodeListRow> {
  bool _focused = false;

  Widget _blur(bool on, double sigma, Widget child) {
    final target = (on && !_focused) ? sigma : 0.0;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(end: target),
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      builder: (context, s, ch) => ImageFiltered(
        enabled: s > 0.05,
        imageFilter: ui.ImageFilter.blur(sigmaX: s, sigmaY: s),
        child: ch,
      ),
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final e = widget.episode;
    final mask = widget.mask;
    final still = episodeStillUrl(e.stillPath, widget.hdImages);
    final runtime = e.runtime ?? 0;
    final durMs = runtime * 60000;
    final ratio = (!widget.watched && durMs > 0 && widget.resumeMs > 0)
        ? (widget.resumeMs / durMs).clamp(0.0, 1.0)
        : 0.0;
    final meta = [
      'S${e.seasonNumber} E${e.episodeNumber}',
      if (e.runtime != null && e.runtime! > 0) '${e.runtime} min',
      if (e.airDate != null && e.airDate!.length >= 10)
        e.airDate!.substring(0, 10),
    ].join('  ·  ');

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Focusable(
        tokens: t,
        borderRadius: 16,
        onPressed: widget.onOpenDetail ?? widget.onPlay,
        onLongPress: widget.onContextMenu,
        onFocusChange: (f) => setState(() => _focused = f),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 200,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        _blur(
                          mask.thumb,
                          7,
                          still != null
                              ? CachedNetworkImage(
                                  imageUrl: still,
                                  fit: BoxFit.cover,
                                  placeholder: (_, _) =>
                                      ColoredBox(color: t.surface),
                                  errorWidget: (_, _, _) => _fallback(t),
                                )
                              : _fallback(t),
                        ),
                        Positioned(
                          left: 8,
                          top: 8,
                          child: _pill(t, '${e.episodeNumber}'),
                        ),
                        if (widget.watched)
                          Positioned(
                            right: 8,
                            top: 8,
                            child: Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                color: t.accent,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.check,
                                size: 14,
                                color: t.canvas,
                              ),
                            ),
                          ),
                        if (widget.showRating &&
                            widget.rating != null &&
                            widget.rating! > 0)
                          Positioned(
                            left: 8,
                            bottom: 8,
                            child: _pill(
                              t,
                              '★ ${widget.rating!.toStringAsFixed(1)}',
                            ),
                          ),
                        if (ratio > 0.01)
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            child: FractionallySizedBox(
                              alignment: Alignment.centerLeft,
                              widthFactor: ratio,
                              child: Container(height: 3, color: t.accent),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _blur(
                      mask.title,
                      5,
                      Text(
                        e.name.isNotEmpty
                            ? e.name
                            : 'Episode ${e.episodeNumber}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      meta,
                      style: TextStyle(color: t.inkSubtle, fontSize: 12),
                    ),
                    if (e.overview.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      _blur(
                        mask.desc,
                        5,
                        Text(
                          e.overview,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t.inkMuted,
                            fontSize: 13.5,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (widget.onDownload != null) ...[
                const SizedBox(width: 12),
                EpisodeDownloadButton(
                  metaId: widget.metaId,
                  season: e.seasonNumber,
                  episode: e.episodeNumber,
                  onDownload: widget.onDownload!,
                  tokens: t,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _pill(HarborTokens t, String text) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.95),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      text,
      style: TextStyle(color: t.ink, fontSize: 11, fontWeight: FontWeight.w600),
    ),
  );

  Widget _fallback(HarborTokens t) => ColoredBox(
    color: t.surface,
    child: Center(child: Icon(Icons.tv_outlined, color: t.inkSubtle, size: 28)),
  );
}
