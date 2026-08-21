import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/library/manual_watched.dart';
import '../../domain/player/adjacent_episodes.dart';
import '../../domain/settings/settings.dart';
import '../../domain/spoilers/spoiler_mask.dart';

/// The in-player episode panel — a native, remote-navigable port of the web
/// `EpisodePanel` (`components/player/episode-panel`). A right-side drawer that
/// lists the current series' episodes for a chosen season: each row shows the
/// still, the season/episode label, the title, a watched check, and a
/// Play/Restart action, expanding to reveal the air date and overview. The
/// episode currently playing is highlighted "Now Playing"; picking any other
/// episode jumps to it through the play-picker (the shared `goToEpisode` flow).
/// Spoiler masking blurs unwatched stills, titles, and descriptions per the
/// spoiler settings, revealing them on focus. The whole panel is a focus-trapped
/// group so a TV remote fully drives it; the dimmed backdrop or Back dismisses.
class EpisodesPanel extends ConsumerStatefulWidget {
  const EpisodesPanel({
    super.key,
    required this.tokens,
    required this.metaId,
    required this.seriesName,
    required this.videos,
    required this.currentSeason,
    required this.currentEpisode,
    required this.onPlay,
    required this.onRestart,
    required this.onClose,
  });

  final HarborTokens tokens;

  /// The nav meta id — keys the manual-watched store for this series.
  final String metaId;
  final String seriesName;

  /// The full ordered episode list from the series' meta.
  final List<VideoRef> videos;

  /// The episode currently playing (highlighted, and the initial season).
  final int? currentSeason;
  final int? currentEpisode;

  /// Jumps to [ep] (a different episode) via the play-picker.
  final void Function(EpisodeRef ep) onPlay;

  /// Restarts the current episode from the beginning.
  final VoidCallback onRestart;
  final VoidCallback onClose;

  @override
  ConsumerState<EpisodesPanel> createState() => _EpisodesPanelState();
}

class _EpisodesPanelState extends ConsumerState<EpisodesPanel> {
  late int _season;
  String? _expanded;

  /// The panel owns a focus scope; the player root keeps primary focus until we
  /// pull it in here, so without this the D-pad can't reach the panel at all.
  final FocusScopeNode _scope = FocusScopeNode(debugLabel: 'episodes-panel');

  @override
  void initState() {
    super.initState();
    final seasons = _seasons();
    _season =
        (widget.currentSeason != null && seasons.contains(widget.currentSeason))
        ? widget.currentSeason!
        : (seasons.isNotEmpty ? seasons.first : 1);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scope.requestFocus();
    });
  }

  @override
  void dispose() {
    _scope.dispose();
    super.dispose();
  }

  HarborTokens get t => widget.tokens;

  /// The distinct seasons present in the episode list, ascending. Only videos
  /// carrying both a season and an episode count (specials without numbering are
  /// skipped, matching `adjacentEpisodes`).
  List<int> _seasons() {
    final set = <int>{};
    for (final v in widget.videos) {
      if (v.season != null && v.episode != null) set.add(v.season!);
    }
    final list = set.toList()..sort();
    return list;
  }

  /// The episodes of [_season], ordered by episode number.
  List<VideoRef> _episodesOf(int season) {
    final eps = [
      for (final v in widget.videos)
        if (v.season == season && v.episode != null) v,
    ];
    eps.sort((a, b) => a.episode!.compareTo(b.episode!));
    return eps;
  }

  bool _isCurrent(VideoRef v) =>
      v.season == widget.currentSeason && v.episode == widget.currentEpisode;

  @override
  Widget build(BuildContext context) {
    ref.watch(translationsProvider); // repaint on a language change
    final tr = ref.read(translationsProvider);
    final settings = ref.watch(settingsProvider);
    final watchedKeys = ref.watch(manualWatchedProvider);
    final idiom = Idiom.of(context);
    final wide = !idiom.isPhone;
    final seasons = _seasons();
    final episodes = _episodesOf(_season);

    bool isWatched(VideoRef v) => watchedKeys.contains(
      ManualWatchedStore.episodeKey(widget.metaId, v.season!, v.episode!),
    );

    // The next-up episode is the first unwatched one in air order — kept visible
    // when spoilers are on and "skip next" is set.
    final nextUp = episodes.cast<VideoRef?>().firstWhere(
      (v) => !isWatched(v!),
      orElse: () => null,
    );

    final nextSeason = seasons.where((n) => n > _season).firstOrNull;

    final width = wide
        ? 460.0
        : MediaQuery.sizeOf(context).width.clamp(0.0, 460.0);

    final panel = Container(
      width: width,
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(left: BorderSide(color: t.edgeSoft)),
      ),
      child: SafeArea(
        left: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _header(tr),
            _nowPlayingRow(tr),
            if (seasons.length > 1) _seasonStrip(seasons),
            const SizedBox(height: 6),
            Expanded(
              child: episodes.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          tr.t('No episodes found for this season.'),
                          textAlign: TextAlign.center,
                          style: TextStyle(color: t.inkMuted, fontSize: 13.5),
                        ),
                      ),
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(14, 2, 14, 24),
                      children: [
                        for (final v in episodes)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _PanelEpisodeRow(
                              tokens: t,
                              tr: tr,
                              episode: v,
                              isCurrent: _isCurrent(v),
                              watched: isWatched(v),
                              expanded: _expanded == _keyOf(v),
                              mask: spoilerMaskFor(
                                settings,
                                watched: _isCurrent(v) || isWatched(v),
                                isNextUp:
                                    nextUp != null &&
                                    nextUp.season == v.season &&
                                    nextUp.episode == v.episode,
                              ),
                              onToggle: () => setState(
                                () => _expanded = _expanded == _keyOf(v)
                                    ? null
                                    : _keyOf(v),
                              ),
                              onPlay: () {
                                if (_isCurrent(v)) {
                                  widget.onRestart();
                                } else {
                                  widget.onPlay((
                                    season: v.season!,
                                    episode: v.episode!,
                                  ));
                                }
                              },
                            ),
                          ),
                        if (nextSeason != null)
                          _nextSeasonButton(tr, nextSeason),
                      ],
                    ),
            ),
            _footer(tr, settings),
          ],
        ),
      ),
    );

    return FocusScope(
      node: _scope,
      child: FocusTraversalGroup(
        child: Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: widget.onClose,
                child: ColoredBox(color: Colors.black.withValues(alpha: 0.4)),
              ),
            ),
            Align(alignment: AlignmentDirectional.centerEnd, child: panel),
          ],
        ),
      ),
    );
  }

  String _keyOf(VideoRef v) => '${v.season}:${v.episode}';

  Widget _header(Translations tr) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 18, 10, 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr.t('Up Next').toUpperCase(),
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 3.2,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.seriesName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  height: 1.1,
                ),
              ),
            ],
          ),
        ),
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 999,
          onPressed: widget.onClose,
          child: Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: t.elevated,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.close_rounded, size: 18, color: t.inkMuted),
          ),
        ),
      ],
    ),
  );

  Widget _nowPlayingRow(Translations tr) {
    if (widget.currentSeason == null || widget.currentEpisode == null) {
      return const SizedBox.shrink();
    }
    final cur = _currentVideo();
    final name = cur?.title?.trim();
    final label =
        'S${widget.currentSeason} · E${widget.currentEpisode}${(name != null && name.isNotEmpty) ? ' · $name' : ''}';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      child: Text(
        tr.t('Now playing: {label}', {'label': label}),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
      ),
    );
  }

  VideoRef? _currentVideo() {
    for (final v in widget.videos) {
      if (_isCurrent(v)) return v;
    }
    return null;
  }

  Widget _seasonStrip(List<int> seasons) => SizedBox(
    height: 38,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 18),
      itemCount: seasons.length,
      separatorBuilder: (_, _) => const SizedBox(width: 8),
      itemBuilder: (context, i) {
        final n = seasons[i];
        final selected = n == _season;
        final tr = ref.read(translationsProvider);
        return Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 999,
          onPressed: () => setState(() {
            _season = n;
            _expanded = null;
          }),
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: selected ? t.ink : t.canvas.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(999),
              border: selected ? null : Border.all(color: t.edgeSoft),
            ),
            child: Text(
              tr.t('Season {n}', {'n': n}),
              style: TextStyle(
                color: selected ? t.canvas : t.inkMuted,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        );
      },
    ),
  );

  Widget _nextSeasonButton(Translations tr, int nextSeason) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 16,
    onPressed: () => setState(() {
      _season = nextSeason;
      _expanded = null;
    }),
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.elevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            tr.t('Season {n}', {'n': nextSeason}),
            style: TextStyle(
              color: t.ink,
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 4),
          Icon(Icons.chevron_right_rounded, size: 18, color: t.inkMuted),
        ],
      ),
    ),
  );

  Widget _footer(Translations tr, Settings settings) {
    final instant = settings.getBool('instantPlay');
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: t.edgeSoft)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Text(
        instant
            ? tr.t(
                'Instant Play: choosing an episode queues its stream automatically.',
              )
            : tr.t('Choosing an episode opens the source picker for it.'),
        style: TextStyle(color: t.inkSubtle, fontSize: 11.5, height: 1.35),
      ),
    );
  }
}

/// One episode row in the panel: still + label + watched check + title + a
/// Play/Restart action, expanding to the air date and overview. Spoiler masks
/// blur the still, title, and overview until the row is focused.
class _PanelEpisodeRow extends StatefulWidget {
  const _PanelEpisodeRow({
    required this.tokens,
    required this.tr,
    required this.episode,
    required this.isCurrent,
    required this.watched,
    required this.expanded,
    required this.mask,
    required this.onToggle,
    required this.onPlay,
  });

  final HarborTokens tokens;
  final Translations tr;
  final VideoRef episode;
  final bool isCurrent;
  final bool watched;
  final bool expanded;
  final SpoilerMask mask;
  final VoidCallback onToggle;
  final VoidCallback onPlay;

  @override
  State<_PanelEpisodeRow> createState() => _PanelEpisodeRowState();
}

class _PanelEpisodeRowState extends State<_PanelEpisodeRow> {
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
    final tr = widget.tr;
    final e = widget.episode;
    final mask = widget.mask;
    final still = e.thumbnail;
    final epLabel = 'S${e.season} · E${e.episode}';
    final airDate = (e.released != null && e.released!.length >= 10)
        ? e.released!.substring(0, 10)
        : null;
    final title = (e.title?.trim().isNotEmpty ?? false)
        ? e.title!
        : tr.t('Episode {n}', {'n': e.episode});
    final overview = e.overview?.trim() ?? '';

    // Reveal the spoiler masks while any of this row's controls hold focus, so a
    // remote user peeks the still/title/overview the same way hover does on web.
    return Focus(
      canRequestFocus: false,
      skipTraversal: true,
      onFocusChange: (f) => setState(() => _focused = f),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: widget.isCurrent ? t.accent : t.edgeSoft,
            width: widget.isCurrent ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 120,
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
                              (still != null && still.isNotEmpty)
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
                              left: 6,
                              bottom: 6,
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
                                  epLabel,
                                  style: TextStyle(
                                    color: t.ink,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                            if (widget.watched && !widget.isCurrent)
                              Positioned(
                                right: 6,
                                top: 6,
                                child: Container(
                                  width: 22,
                                  height: 22,
                                  decoration: BoxDecoration(
                                    color: t.accent,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    Icons.check,
                                    size: 13,
                                    color: t.canvas,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: _blur(
                                mask.title,
                                5,
                                Text(
                                  title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: t.ink,
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w600,
                                    height: 1.2,
                                  ),
                                ),
                              ),
                            ),
                            if (widget.isCurrent)
                              Container(
                                margin: const EdgeInsetsDirectional.only(
                                  start: 6,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: t.accentSoft,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color: t.accent.withValues(alpha: 0.4),
                                  ),
                                ),
                                child: Text(
                                  tr.t('Now Playing').toUpperCase(),
                                  style: TextStyle(
                                    color: t.accent,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: Focusable(
                                tokens: t,
                                scale: 1.0,
                                borderRadius: 999,
                                autofocus: widget.isCurrent,
                                onPressed: widget.onPlay,
                                child: Container(
                                  height: 40,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: t.accent,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        widget.isCurrent
                                            ? Icons.replay_rounded
                                            : Icons.play_arrow_rounded,
                                        size: 18,
                                        color: t.canvas,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        widget.isCurrent
                                            ? tr.t('Restart')
                                            : tr.t('Play'),
                                        style: TextStyle(
                                          color: t.canvas,
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Focusable(
                              tokens: t,
                              scale: 1.0,
                              borderRadius: 999,
                              onPressed: widget.onToggle,
                              child: Container(
                                width: 40,
                                height: 40,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: t.elevated,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: t.edgeSoft),
                                ),
                                child: AnimatedRotation(
                                  turns: widget.expanded ? 0.5 : 0,
                                  duration: const Duration(milliseconds: 200),
                                  child: Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    size: 20,
                                    color: t.inkMuted,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (widget.expanded)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: t.canvas.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (airDate != null) ...[
                        Text(
                          airDate,
                          style: TextStyle(
                            color: t.inkSubtle,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
                      overview.isNotEmpty
                          ? _blur(
                              mask.desc,
                              5,
                              Text(
                                overview,
                                style: TextStyle(
                                  color: t.inkMuted,
                                  fontSize: 13,
                                  height: 1.4,
                                ),
                              ),
                            )
                          : Text(
                              tr.t('No description available.'),
                              style: TextStyle(
                                color: t.inkSubtle,
                                fontSize: 12.5,
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
  }

  Widget _fallback(HarborTokens t) => ColoredBox(
    color: t.surface,
    child: Center(child: Icon(Icons.tv_outlined, color: t.inkSubtle, size: 24)),
  );
}
