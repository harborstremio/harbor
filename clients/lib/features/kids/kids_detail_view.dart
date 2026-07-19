import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_row.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/kids_catalog.dart' show dropUnreleased;
import '../../domain/catalog/tmdb_details.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';
import '../../domain/player/audio_track_select.dart' show isAnimeContent;

/// The kid-safe detail page, ported 1:1 from the web `KidsDetailView`. The web
/// renders this — instead of the adult `DetailView` — whenever a kid profile is
/// active: a bold backdrop hero with a big teal Play button, the overview, a
/// kid-friendly episode grid for series, the collection siblings, and a "More
/// to explore" rail. Reuses the shared [detailProvider] /
/// [seasonEpisodesProvider] / [collectionProvider] so no data path is
/// duplicated. Unreleased titles are filtered out so nothing unreleased reaches
/// a child.
class KidsDetailView extends ConsumerWidget {
  const KidsDetailView({super.key, required this.type, required this.id});

  final String type;
  final String id;

  static const Color _teal = Color(0xFF1F8F88);
  static const Color _darkTeal = Color(0xFF0E3A43);

  bool get _isSeries => type == 'series';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final detailAsync = ref.watch(detailProvider((type: type, id: id)));
    return Container(
      color: t.canvas,
      child: detailAsync.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: _teal, strokeWidth: 2),
        ),
        error: (_, _) => const SizedBox.shrink(),
        data: (detail) {
          if (detail == null) return const SizedBox.shrink();
          return _body(context, ref, t, detail);
        },
      ),
    );
  }

  Widget _body(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
    TmdbDetail detail,
  ) {
    final tr = ref.watch(translationsProvider);
    final g = pageGutter(Idiom.of(context));
    final recs = dropUnreleased(
      _dedupe([...detail.recommendations, ...detail.similar], id),
    );
    final showEpisodes = _isSeries && detail.seasons.isNotEmpty;

    // The rails (TvRow / collection) apply their own page gutter, so only the
    // plain sections (overview, episodes) are gutter-padded here.
    final sections = <Widget>[
      if (detail.overview.isNotEmpty)
        Padding(
          padding: EdgeInsets.symmetric(horizontal: g),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Text(
              detail.overview,
              style: TextStyle(
                color: t.ink,
                fontSize: 17,
                height: 1.55,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      if (showEpisodes)
        Padding(
          padding: EdgeInsets.fromLTRB(g, 40, g, 0),
          child: _KidsEpisodes(
            type: type,
            id: id,
            tvId: detail.id,
            seasons: detail.seasons,
            title: detail.title,
            year: detail.year,
            releaseDate: detail.releaseDate,
            poster: detail.poster,
            genres: detail.genres,
            tokens: t,
          ),
        ),
      if (detail.collection != null)
        Padding(
          padding: const EdgeInsets.only(top: 40),
          child: _CollectionRail(
            collectionId: detail.collection!.id,
            collectionName: detail.collection!.name,
            currentId: id,
            tokens: t,
          ),
        ),
      if (recs.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 40),
          child: TvRow(
            title: tr.t('More to explore'),
            items: recs,
            tokens: t,
            kids: true,
            viewAll: false,
            onSelect: (m) => _openMeta(ref, m),
          ),
        ),
    ];

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _hero(context, ref, t, tr, detail)),
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.only(
              top: 12,
              bottom: overscanInset(Idiom.of(context)).bottom + 48,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: sections,
            ),
          ),
        ),
      ],
    );
  }

  Widget _hero(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
    Translations tr,
    TmdbDetail detail,
  ) {
    final height = math.max(460.0, MediaQuery.sizeOf(context).height * 0.66);
    final g = pageGutter(Idiom.of(context));
    final backdrop = detail.backdrop ?? detail.poster;
    final logo = detail.logo;
    final chips = <String>[
      if (detail.year != null && detail.year!.isNotEmpty) detail.year!,
      if (detail.runtime != null && detail.runtime!.isNotEmpty) detail.runtime!,
      ...detail.genres.take(2).map(tr.t),
    ];
    return SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (backdrop != null)
            CachedNetworkImage(
              imageUrl: backdrop,
              fit: BoxFit.cover,
              errorWidget: (_, _, _) => ColoredBox(color: t.elevated),
            ),
          // Bottom fade into the canvas + a soft left darkening for the copy.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [
                  t.canvas,
                  t.canvas.withValues(alpha: 0.35),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.55, 1.0],
              ),
            ),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [Color(0x4D000000), Colors.transparent],
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Padding(
              padding: EdgeInsets.fromLTRB(g, 0, g, 36),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (logo != null)
                    ConstrainedBox(
                      constraints: BoxConstraints(
                        maxHeight: 128,
                        maxWidth: MediaQuery.sizeOf(context).width * 0.6,
                      ),
                      child: CachedNetworkImage(
                        imageUrl: logo,
                        fit: BoxFit.contain,
                        alignment: Alignment.centerLeft,
                        errorWidget: (_, _, _) => _heroTitle(detail.title),
                      ),
                    )
                  else
                    _heroTitle(detail.title),
                  const SizedBox(height: 18),
                  if (chips.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [for (final c in chips) _chip(c)],
                    ),
                  const SizedBox(height: 20),
                  _playButton(context, ref, tr, detail),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroTitle(String name) => Text(
    name,
    maxLines: 2,
    overflow: TextOverflow.ellipsis,
    style: const TextStyle(
      color: Colors.white,
      fontSize: 48,
      height: 1.0,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.5,
      shadows: [Shadow(color: Color(0x8C000000), blurRadius: 12)],
    ),
  );

  Widget _chip(String label) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.75),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: Colors.white.withValues(alpha: 0.6)),
    ),
    child: Text(
      label,
      style: const TextStyle(
        color: _darkTeal,
        fontSize: 13.5,
        fontWeight: FontWeight.w700,
      ),
    ),
  );

  Widget _playButton(
    BuildContext context,
    WidgetRef ref,
    Translations tr,
    TmdbDetail detail,
  ) => Focusable(
    tokens: ref.read(tokensProvider),
    borderRadius: 999,
    autofocus: true,
    onPressed: () => _play(ref, detail),
    child: Container(
      height: 64,
      padding: const EdgeInsetsDirectional.only(start: 24, end: 36),
      decoration: BoxDecoration(
        color: _teal,
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(
            color: Color(0xB31F5A5A),
            blurRadius: 40,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.25),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.play_arrow, size: 26, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Text(
            tr.t('Play'),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    ),
  );

  /// The kid Play button resumes the last-watched episode of a series, else
  /// starts at S1E1; movies just play. Auto-plays the best source, matching the
  /// web's `openPicker(..., { autoPlay: true })`.
  void _play(WidgetRef ref, TmdbDetail detail) {
    int? season;
    int? episode;
    if (_isSeries) {
      final resume = _resolveResumeEpisode(ref, detail);
      season = resume?.season ?? 1;
      episode = resume?.episode ?? 1;
    }
    _openKidsPicker(
      ref,
      type: type,
      id: id,
      season: season,
      episode: episode,
      title: detail.title,
      year: detail.year,
      releaseDate: detail.releaseDate,
      poster: detail.poster,
      genres: detail.genres,
      autoPlay: true,
    );
  }

  ({int season, int episode})? _resolveResumeEpisode(
    WidgetRef ref,
    TmdbDetail detail,
  ) {
    if (!_isSeries) return null;
    final resume = ref.read(resumeStoreProvider);
    final cw = ref.read(localCwStoreProvider);
    final ids = <String>{
      id,
      if (detail.imdbId != null && detail.imdbId!.isNotEmpty) detail.imdbId!,
      if (detail.id > 0 && detail.kind == 'tv') 'tmdb:tv:${detail.id}',
    };
    ({int season, int episode, int t})? best;
    void consider(int season, int episode, int t) {
      if (season < 1 || episode < 1) return;
      if (best == null || t > best!.t) {
        best = (season: season, episode: episode, t: t);
      }
    }

    for (final cid in ids) {
      final e = cw.entry(cid);
      if (e != null &&
          e.type == 'series' &&
          e.season != null &&
          e.episode != null) {
        consider(e.season!, e.episode!, e.t);
      }
      final lp = resume.lastPlayedEpisode(cid);
      if (lp != null) consider(lp.season, lp.episode, lp.t);
    }
    final b = best;
    return b == null ? null : (season: b.season, episode: b.episode);
  }

  void _openMeta(WidgetRef ref, MetaPreview m) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id}));

  static List<MetaPreview> _dedupe(List<MetaPreview> list, String excludeId) {
    final seen = <String>{excludeId};
    final out = <MetaPreview>[];
    for (final m in list) {
      if (!seen.add(m.id)) continue;
      out.add(m);
    }
    // Match the web `dedupe`, which caps at 24 before the unreleased filter.
    return out.length > 24 ? out.sublist(0, 24) : out;
  }
}

/// Opens the stream picker for a kid selection with the full trust context the
/// picker's stream filter conditions on (title, year, release date, anime flag,
/// poster) — the port of the web `openPicker`.
void _openKidsPicker(
  WidgetRef ref, {
  required String type,
  required String id,
  int? season,
  int? episode,
  String? title,
  String? year,
  String? releaseDate,
  String? poster,
  required List<String> genres,
  required bool autoPlay,
}) {
  final yearMatch = RegExp(r'\d{4}').firstMatch(year ?? '');
  final yearInt = yearMatch != null ? int.parse(yearMatch.group(0)!) : null;
  ref
      .read(navControllerProvider.notifier)
      .push(
        Frame(FrameKind.picker, {
          'type': type,
          'id': id,
          'season': ?season,
          'episode': ?episode,
          'title': ?title,
          'year': ?yearInt,
          'releaseDate': ?releaseDate,
          'isAnime': isAnimeContent(id, genres),
          'poster': ?poster,
          'autoPlay': autoPlay,
        }),
      );
}

/// The kid-friendly episode grid for a series, ported from `KidsEpisodes`: a
/// teal "Episodes" header, a season selector, and 16:9 still cards that fire the
/// picker on select.
class _KidsEpisodes extends ConsumerStatefulWidget {
  const _KidsEpisodes({
    required this.type,
    required this.id,
    required this.tvId,
    required this.seasons,
    required this.title,
    required this.year,
    required this.releaseDate,
    required this.poster,
    required this.genres,
    required this.tokens,
  });

  final String type;
  final String id;
  final int tvId;
  final List<Season> seasons;
  final String title;
  final String? year;
  final String? releaseDate;
  final String? poster;
  final List<String> genres;
  final HarborTokens tokens;

  @override
  ConsumerState<_KidsEpisodes> createState() => _KidsEpisodesState();
}

class _KidsEpisodesState extends ConsumerState<_KidsEpisodes> {
  late int _season = widget.seasons.first.seasonNumber;

  @override
  void didUpdateWidget(_KidsEpisodes old) {
    super.didUpdateWidget(old);
    // If the season list changed and the selected season is gone, fall back to
    // the first so we never query a season that no longer exists.
    if (!widget.seasons.any((s) => s.seasonNumber == _season)) {
      _season = widget.seasons.first.seasonNumber;
    }
  }

  void _play(int season, int episode) {
    _openKidsPicker(
      ref,
      type: widget.type,
      id: widget.id,
      season: season,
      episode: episode,
      title: widget.title,
      year: widget.year,
      releaseDate: widget.releaseDate,
      poster: widget.poster,
      genres: widget.genres,
      autoPlay: ref.read(settingsProvider).getBool('instantPlay'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final epsAsync = ref.watch(
      seasonEpisodesProvider((tvId: widget.tvId, season: _season)),
    );
    final columns = switch (Idiom.of(context)) {
      Idiom.phone => 2,
      Idiom.tablet => 3,
      Idiom.tv => 4,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.tv_rounded, size: 24, color: KidsDetailView._teal),
            const SizedBox(width: 10),
            Text(
              tr.t('Episodes'),
              style: const TextStyle(
                color: KidsDetailView._darkTeal,
                fontSize: 26,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
              ),
            ),
          ],
        ),
        if (widget.seasons.length > 1) ...[
          const SizedBox(height: 16),
          _seasonPicker(tr),
        ],
        const SizedBox(height: 16),
        epsAsync.when(
          loading: () =>
              _grid(columns, [for (var i = 0; i < 6; i++) _skeletonCard()]),
          error: (_, _) => const SizedBox.shrink(),
          data: (eps) => eps.isEmpty
              ? const SizedBox.shrink()
              : _grid(columns, [
                  for (final (i, ep) in eps.indexed)
                    _EpisodeCard(
                      ep: ep,
                      tokens: t,
                      tr: tr,
                      autofocus: i == 0,
                      onPlay: () => _play(ep.seasonNumber, ep.episodeNumber),
                    ),
                ]),
        ),
      ],
    );
  }

  Widget _grid(int columns, List<Widget> children) => GridView.count(
    crossAxisCount: columns,
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    crossAxisSpacing: 16,
    mainAxisSpacing: 16,
    // Cells hold a still that Expands to fill plus a one-line title beneath;
    // a slightly-taller-than-16:9 ratio leaves room without overflowing.
    childAspectRatio: 1.4,
    children: children,
  );

  Widget _skeletonCard() => DecoratedBox(
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: 0.6), width: 2),
    ),
  );

  Widget _seasonPicker(Translations tr) {
    // A horizontally-scrollable pill row rather than the web's dropdown: a
    // D-pad can walk the pills directly, which the mouse-oriented popover
    // cannot on a TV.
    return SizedBox(
      height: 44,
      child: FocusTraversalGroup(
        policy: ReadingOrderTraversalPolicy(),
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: widget.seasons.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final s = widget.seasons[i];
            final active = s.seasonNumber == _season;
            return Focusable(
              tokens: widget.tokens,
              scale: 1.0,
              borderRadius: 999,
              onPressed: () => setState(() => _season = s.seasonNumber),
              child: Container(
                height: 44,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                decoration: BoxDecoration(
                  color: active
                      ? KidsDetailView._teal
                      : Colors.white.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(999),
                  border: active
                      ? null
                      : Border.all(color: Colors.white.withValues(alpha: 0.7)),
                ),
                child: Text(
                  tr.t('Season {n}', {'n': s.seasonNumber}),
                  style: TextStyle(
                    color: active ? Colors.white : KidsDetailView._darkTeal,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

const String _stillBase = 'https://image.tmdb.org/t/p/w300';

class _EpisodeCard extends StatelessWidget {
  const _EpisodeCard({
    required this.ep,
    required this.tokens,
    required this.tr,
    required this.onPlay,
    this.autofocus = false,
  });

  final Episode ep;
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onPlay;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final still = ep.stillPath != null ? '$_stillBase${ep.stillPath}' : null;
    final rating = ep.voteAverage != null && ep.voteAverage! > 0
        ? ep.voteAverage!.toStringAsFixed(1)
        : null;
    return Focusable(
      tokens: t,
      borderRadius: 16,
      autofocus: autofocus,
      onPressed: onPlay,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x40142838),
                    blurRadius: 28,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (still != null)
                    CachedNetworkImage(
                      imageUrl: still,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => ColoredBox(color: t.elevated),
                    ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [Color(0x99000000), Colors.transparent],
                        stops: [0.0, 0.5],
                      ),
                    ),
                  ),
                  PositionedDirectional(
                    start: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        tr.t('Ep {n}', {'n': ep.episodeNumber}),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  if (rating != null)
                    PositionedDirectional(
                      end: 6,
                      bottom: 6,
                      child: SizedBox(
                        width: 36,
                        height: 36,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            SvgPicture.asset('assets/kids/starbadge.svg'),
                            Padding(
                              padding: const EdgeInsets.only(top: 1),
                              child: Text(
                                rating,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  shadows: [
                                    Shadow(
                                      color: Color(0x99000000),
                                      blurRadius: 3,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            ep.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: KidsDetailView._darkTeal,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// The collection siblings rail for the kids detail, reusing [collectionProvider]
/// and rendering the sibling films (this title excluded) through a [TvRow].
class _CollectionRail extends ConsumerWidget {
  const _CollectionRail({
    required this.collectionId,
    required this.collectionName,
    required this.currentId,
    required this.tokens,
  });

  final int collectionId;
  final String collectionName;
  final String currentId;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coll = ref.watch(collectionProvider(collectionId)).value;
    if (coll == null) return const SizedBox.shrink();
    final parts = coll.parts.where((p) => p.id != currentId).toList();
    if (parts.isEmpty) return const SizedBox.shrink();
    return TvRow(
      title: collectionName,
      items: parts,
      tokens: tokens,
      kids: true,
      viewAll: false,
      onSelect: (m) => ref
          .read(navControllerProvider.notifier)
          .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id})),
    );
  }
}
