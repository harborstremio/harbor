import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anilist_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/mal_providers.dart';
import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/anilist/anilist_watched.dart';
import '../../domain/anime/kitsu_client.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/mal/mal_watched.dart';
import '../../domain/settings/settings.dart';
import 'anime_season_picker.dart' show UpcomingBadge;
import '../../design/focus/tv_text_field.dart';

const _monthAbbr = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// The fixed height of the horizontal `strip` anime-episode layout: a 244px 16:9
/// still (~137) + the title/meta block below.
const double _kAnimeStripHeight = 200;

/// Formats an episode air date as `Mon D, YYYY` in UTC. Ported from
/// `formatAirDate`.
String formatAnimeAirDate(String? iso, [Translations? tr]) {
  if (iso == null || iso.isEmpty) return '';
  final d = DateTime.tryParse(iso.length == 10 ? '${iso}T00:00:00Z' : iso);
  if (d == null) return '';
  final u = d.toUtc();
  final month = _monthAbbr[u.month - 1];
  return '${tr?.t(month) ?? month} ${u.day}, ${u.year}';
}

/// The anime episode list on the detail page — the enriched Kitsu episodes with
/// thumbnails (falling back to the metahub still then the show backdrop), the
/// episode number, an optional IMDb-preferred rating, filler and upcoming
/// badges, and the air line. Ported from the list layout of `AnimeEpisodes`.
class AnimeEpisodesList extends ConsumerStatefulWidget {
  const AnimeEpisodesList({
    super.key,
    required this.type,
    required this.id,
    required this.background,
    required this.tokens,
    required this.onPlay,
  });

  final String type;
  final String id;
  final String? background;
  final HarborTokens tokens;
  final void Function(KitsuEpisode) onPlay;

  @override
  ConsumerState<AnimeEpisodesList> createState() => _AnimeEpisodesListState();
}

class _AnimeEpisodesListState extends ConsumerState<AnimeEpisodesList> {
  final _searchController = TextEditingController();
  String _query = '';
  bool _searchOpen = false;

  /// The active translator; `build` watches it so a language change repaints.
  Translations get _tr => ref.read(translationsProvider);

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _matches(KitsuEpisode e, String q) =>
      '${e.number}'.contains(q) || e.title.toLowerCase().contains(q);

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    ref.watch(translationsProvider); // repaint on a language change
    final async = ref.watch(
      animeEnrichedEpisodesProvider((type: widget.type, id: widget.id)),
    );
    final episodes = async.value ?? const <KitsuEpisode>[];
    final settings = ref.watch(settingsProvider);
    final showRating = settings.getBool('showEpisodeRating');
    final newest = settings.getString('episodeSort') == 'newest';
    if (episodes.isEmpty) {
      return async.isLoading
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 48),
              child: Center(
                child: CircularProgressIndicator(
                  color: t.accent,
                  strokeWidth: 2,
                ),
              ),
            )
          : const SizedBox.shrink();
    }
    final isOneOff = widget.type == 'movie' || episodes.length <= 1;

    // The AniList and MyAnimeList list entries each mark the leading episodes as
    // watched; the union covers a title tracked on either service.
    final anilistEntry = ref
        .watch(anilistWatchedEntryProvider(widget.id))
        .value;
    final malEntry = ref.watch(malWatchedEntryProvider(widget.id)).value;
    final watchedKeys = <String>{
      if (anilistEntry != null)
        ...anilistWatchedKeys(anilistEntry, episodes).watchedKeys,
      if (malEntry != null) ...malWatchedKeys(malEntry, episodes).watchedKeys,
    };

    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? episodes
        : [
            for (final e in episodes)
              if (_matches(e, q)) e,
          ];
    final ordered = newest ? filtered.reversed.toList() : filtered;

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: pageGutter(Idiom.of(context))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                isOneOff ? _tr.t('Movie') : _tr.t('Episodes'),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 22,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (!isOneOff) ...[
                const SizedBox(width: 12),
                Text(
                  episodes.length == 1
                      ? '1 episode'
                      : '${episodes.length} episodes',
                  style: TextStyle(color: t.inkSubtle, fontSize: 13),
                ),
                const SizedBox(width: 16),
                // Right-align the controls, wrapping onto a second line rather
                // than overflowing when the search/toggle/sort chips together
                // exceed the content width.
                Expanded(
                  child: Wrap(
                    alignment: WrapAlignment.end,
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _iconChip(t, Icons.search, _searchOpen, () {
                        setState(() {
                          _searchOpen = !_searchOpen;
                          if (!_searchOpen) {
                            _query = '';
                            _searchController.clear();
                          }
                        });
                      }),
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
                    ],
                  ),
                ),
              ],
            ],
          ),
          if (_searchOpen && !isOneOff) ...[
            const SizedBox(height: 14),
            _searchField(t),
          ],
          const SizedBox(height: 16),
          _episodeBody(
            t,
            ordered,
            filtered.isEmpty,
            isOneOff,
            showRating,
            watchedKeys,
            settings.getString('episodeLayout'),
          ),
        ],
      ),
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

  /// The episode body for the active `episodeLayout`, 1:1 with `anime-episodes
  /// .tsx`: a single-item movie or the `list` setting renders the wide rows; a
  /// `strip` renders a horizontal rail of cards; `grid` a wrapping card grid.
  Widget _episodeBody(
    HarborTokens t,
    List<KitsuEpisode> ordered,
    bool empty,
    bool isOneOff,
    bool showRating,
    Set<String> watchedKeys,
    String layout,
  ) {
    if (empty) return _noMatch(t);
    bool isW(KitsuEpisode ep) => watchedKeys.contains(
      '${ep.seasonNumber == 0 ? 1 : ep.seasonNumber}:${ep.number}',
    );
    _AnimeEpisodeRow row(KitsuEpisode ep) => _AnimeEpisodeRow(
      ep: ep,
      background: widget.background,
      showRating: showRating,
      watched: isW(ep),
      tokens: t,
      tr: _tr,
      onPlay: widget.onPlay,
    );

    if (isOneOff || layout == 'list') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [for (final ep in ordered) row(ep)],
      );
    }

    _AnimeEpisodeCard card(KitsuEpisode ep, {required bool strip}) =>
        _AnimeEpisodeCard(
          ep: ep,
          background: widget.background,
          showRating: showRating,
          watched: isW(ep),
          tokens: t,
          tr: _tr,
          onPlay: widget.onPlay,
          stripCompact: strip,
        );

    if (layout == 'strip') {
      return FocusTraversalGroup(
        policy: ReadingOrderTraversalPolicy(),
        child: SizedBox(
          height: _kAnimeStripHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            itemCount: ordered.length,
            separatorBuilder: (_, _) => const SizedBox(width: 16),
            itemBuilder: (_, i) =>
                SizedBox(width: 244, child: card(ordered[i], strip: true)),
          ),
        ),
      );
    }

    // Grid.
    return FocusTraversalGroup(
      policy: ReadingOrderTraversalPolicy(),
      child: Wrap(
        spacing: 18,
        runSpacing: 24,
        children: [
          for (final ep in ordered)
            SizedBox(width: 260, child: card(ep, strip: false)),
        ],
      ),
    );
  }

  Widget _searchField(HarborTokens t) => Container(
    height: 44,
    padding: const EdgeInsets.symmetric(horizontal: 14),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Row(
      children: [
        Icon(Icons.search, size: 18, color: t.inkSubtle),
        const SizedBox(width: 10),
        Expanded(
          child: TvTextField(
            controller: _searchController,
            autofocus: true,
            onChanged: (v) => setState(() => _query = v),
            style: TextStyle(color: t.ink, fontSize: 14),
            cursorColor: t.accent,
            decoration: InputDecoration(
              isCollapsed: true,
              border: InputBorder.none,
              hintText: _tr.t('Search episodes'),
              hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _noMatch(HarborTokens t) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 48),
    child: Center(
      child: Column(
        children: [
          Text(
            _tr.t('No episodes match your search'),
            style: TextStyle(color: t.inkMuted, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Focusable(
            tokens: t,
            borderRadius: 8,
            onPressed: () {
              setState(() {
                _query = '';
                _searchController.clear();
              });
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                _tr.t('Clear search'),
                style: TextStyle(
                  color: t.accent,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _iconChip(
    HarborTokens t,
    IconData icon,
    bool active,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: active ? t.accentSoft : t.canvas.withValues(alpha: 0.4),
        shape: BoxShape.circle,
        border: Border.all(color: active ? t.accent : t.edgeSoft),
      ),
      child: Icon(icon, size: 16, color: active ? t.accent : t.inkMuted),
    ),
  );

  Widget _sortChip(
    HarborTokens t,
    String label,
    bool active,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
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
}

class _AnimeEpisodeRow extends StatelessWidget {
  const _AnimeEpisodeRow({
    required this.ep,
    required this.background,
    required this.showRating,
    required this.watched,
    required this.tokens,
    required this.tr,
    required this.onPlay,
  });

  final KitsuEpisode ep;
  final String? background;
  final bool showRating;
  final bool watched;
  final HarborTokens tokens;
  final Translations tr;
  final void Function(KitsuEpisode) onPlay;

  String? get _thumb {
    final t = ep.thumbnail;
    if (t != null && t.isNotEmpty) return t;
    final fb = ep.thumbnailFallback;
    if (fb != null && fb.isNotEmpty) return fb;
    return (background != null && background!.isNotEmpty) ? background : null;
  }

  String get _metaLine {
    final abs = ep.absoluteNumber;
    return [
      'E${ep.number}',
      if (abs != null && abs != ep.number) 'Abs E$abs',
      if (ep.length != null) '${ep.length} min',
      formatAnimeAirDate(ep.airdate, tr),
    ].where((s) => s.isNotEmpty).join('  ·  ');
  }

  bool get _upcoming {
    final iso = ep.airdate;
    if (iso == null || iso.isEmpty) return false;
    final d = DateTime.tryParse(iso.length == 10 ? '${iso}T00:00:00Z' : iso);
    return d != null && d.isAfter(DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final title = ep.title.isNotEmpty
        ? ep.title
        : tr.t('Episode {n}', {'n': ep.number});
    final thumb = _thumb;
    return Focusable(
      tokens: t,
      borderRadius: 16,
      onPressed: () => onPlay(ep),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 200,
                height: 112,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (thumb != null)
                      CachedNetworkImage(
                        imageUrl: thumb,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) => _fallback(t),
                        placeholder: (_, _) => ColoredBox(color: t.surface),
                      )
                    else
                      _fallback(t),
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
                          '${ep.number}',
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    if (showRating && ep.rating != null && ep.rating! > 0)
                      Positioned(
                        left: 8,
                        bottom: 8,
                        child: _RatingBadge(
                          value: ep.rating!,
                          isImdb: ep.ratingIsImdb ?? false,
                          tokens: t,
                        ),
                      ),
                    if (watched)
                      Positioned(
                        right: 8,
                        top: 8,
                        child: Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: t.success.withValues(alpha: 0.22),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: t.success.withValues(alpha: 0.4),
                            ),
                          ),
                          child: Icon(Icons.check, size: 13, color: t.success),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (ep.filler == true) ...[
                        const SizedBox(width: 8),
                        _FillerBadge(tokens: t, tr: tr),
                      ],
                      if (_upcoming) ...[
                        const SizedBox(width: 8),
                        UpcomingBadge(tokens: t),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _metaLine,
                    style: TextStyle(color: t.inkSubtle, fontSize: 12),
                  ),
                  if (ep.synopsis.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      ep.synopsis,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: t.inkMuted,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fallback(HarborTokens t) => ColoredBox(
    color: t.surface,
    child: Center(
      child: Icon(Icons.movie_outlined, color: t.inkSubtle, size: 26),
    ),
  );
}

/// One anime episode as a 16:9 card — the `grid` and `strip` layouts, ported
/// from `anime-episode-strip.tsx`: the still (number, rating, watched, dimmed
/// when upcoming) above the title (with filler / upcoming badges) and the
/// `E{n} · {min}` meta. `stripCompact` drops the synopsis for a fixed height.
class _AnimeEpisodeCard extends StatelessWidget {
  const _AnimeEpisodeCard({
    required this.ep,
    required this.background,
    required this.showRating,
    required this.watched,
    required this.tokens,
    required this.tr,
    required this.onPlay,
    this.stripCompact = false,
  });

  final KitsuEpisode ep;
  final String? background;
  final bool showRating;
  final bool watched;
  final HarborTokens tokens;
  final Translations tr;
  final void Function(KitsuEpisode) onPlay;
  final bool stripCompact;

  String? get _thumb {
    final th = ep.thumbnail;
    if (th != null && th.isNotEmpty) return th;
    final fb = ep.thumbnailFallback;
    if (fb != null && fb.isNotEmpty) return fb;
    return (background != null && background!.isNotEmpty) ? background : null;
  }

  bool get _upcoming {
    final iso = ep.airdate;
    if (iso == null || iso.isEmpty) return false;
    final d = DateTime.tryParse(iso.length == 10 ? '${iso}T00:00:00Z' : iso);
    return d != null && d.isAfter(DateTime.now());
  }

  String get _metaLine => [
    'E${ep.number}',
    if (ep.length != null) '${ep.length} min',
    if (_upcoming) formatAnimeAirDate(ep.airdate, tr),
  ].where((s) => s.isNotEmpty).join('  ·  ');

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final title = ep.title.isNotEmpty
        ? ep.title
        : tr.t('Episode {n}', {'n': ep.number});
    final thumb = _thumb;
    final upcoming = _upcoming;
    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: () => onPlay(ep),
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
                  Opacity(
                    opacity: upcoming ? 0.55 : 1,
                    child: thumb != null
                        ? CachedNetworkImage(
                            imageUrl: thumb,
                            fit: BoxFit.cover,
                            errorWidget: (_, _, _) => _fallback(t),
                            placeholder: (_, _) => ColoredBox(color: t.surface),
                          )
                        : _fallback(t),
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
                        '${ep.number}',
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  if (watched)
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: t.success.withValues(alpha: 0.22),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: t.success.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Icon(Icons.check, size: 13, color: t.success),
                      ),
                    ),
                  if (showRating && ep.rating != null && ep.rating! > 0)
                    Positioned(
                      left: 8,
                      bottom: 8,
                      child: _RatingBadge(
                        value: ep.rating!,
                        isImdb: ep.ratingIsImdb ?? false,
                        tokens: t,
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Flexible(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (ep.filler == true) ...[
                const SizedBox(width: 6),
                _FillerBadge(tokens: t, tr: tr),
              ],
              if (upcoming) ...[
                const SizedBox(width: 6),
                UpcomingBadge(tokens: t),
              ],
            ],
          ),
          const SizedBox(height: 3),
          Text(
            _metaLine,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: t.inkSubtle, fontSize: 12),
          ),
          if (!stripCompact && ep.synopsis.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              ep.synopsis,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: t.inkMuted, fontSize: 12.5, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }

  Widget _fallback(HarborTokens t) => ColoredBox(
    color: t.surface,
    child: Center(
      child: Icon(Icons.movie_outlined, color: t.inkSubtle, size: 26),
    ),
  );
}

/// The filler-episode chip.
class _FillerBadge extends StatelessWidget {
  const _FillerBadge({required this.tokens, required this.tr});

  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: tokens.accentSoft,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        tr.t('FILLER'),
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.3,
          color: tokens.accent,
        ),
      ),
    );
  }
}

/// The episode rating chip — a star and the score, tinted amber for a fresh
/// IMDb rating. Ported from `EpisodeRatingBadge`.
class _RatingBadge extends StatelessWidget {
  const _RatingBadge({
    required this.value,
    required this.isImdb,
    required this.tokens,
  });

  final num value;
  final bool isImdb;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final amber = const Color(0xFFF5C518);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: tokens.canvas.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star, size: 11, color: isImdb ? amber : tokens.inkMuted),
          const SizedBox(width: 3),
          Text(
            value.toStringAsFixed(1),
            style: TextStyle(
              color: tokens.ink,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
