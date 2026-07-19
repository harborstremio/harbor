import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/tmdb.dart';
import '../../domain/catalog/tmdb_details.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';
import 'trakt_comments_section.dart';

/// The single-episode page, ported from `views/episode-detail.tsx`: a still
/// hero with the S:E plate, air-date / runtime / rating pills and a Play
/// Episode action, the overview, a guest-stars rail, and a stills grid. Consumes
/// [episodeDetailProvider] (TMDB) plus the per-episode rating providers.
class EpisodeDetailView extends ConsumerWidget {
  const EpisodeDetailView({
    super.key,
    required this.type,
    required this.id,
    required this.season,
    required this.episode,
    this.title,
    this.tvId,
    this.seriesImdbId,
  });

  final String type;
  final String id;
  final int season;
  final int episode;
  final String? title;

  /// The TMDB series id (from the opening detail context) — required to fetch
  /// the episode's rich detail.
  final int? tvId;
  final String? seriesImdbId;

  void _play(WidgetRef ref) {
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.picker, {
            'type': 'series',
            'id': id,
            'season': season,
            'episode': episode,
            'title': ?title,
          }),
        );
  }

  double? _rating(WidgetRef ref, EpisodeDetail? ep) {
    final imdb = seriesImdbId;
    if (imdb != null && imdb.startsWith('tt')) {
      final harbor = ref.watch(harborImdbEpisodesProvider(imdb)).value;
      final byHarbor = harbor?['$season:$episode'];
      if (byHarbor != null) return byHarbor;
      final omdb = ref
          .watch(omdbSeasonRatingsProvider((imdbId: imdb, season: season)))
          .value;
      final byOmdb = omdb?[episode];
      if (byOmdb != null) return byOmdb;
    }
    return ep?.voteAverage?.toDouble();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    if (tvId == null) {
      return _centered(tr.t('Add a TMDB key to view episode details.'), t);
    }
    final async = ref.watch(
      episodeDetailProvider((tvId: tvId!, season: season, episode: episode)),
    );
    final ep = async.value;
    if (ep == null && async.isLoading) {
      return Center(
        child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
      );
    }
    final rating = _rating(ref, ep);
    final g = pageGutter(Idiom.of(context));

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _hero(context, ref, t, tr, ep, rating),
          if ((ep?.overview ?? '').isNotEmpty) ...[
            const SizedBox(height: 28),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: g),
              child: Text(
                ep!.overview,
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 15.5,
                  height: 1.5,
                ),
              ),
            ),
          ],
          if ((ep?.guestStars ?? const []).isNotEmpty) ...[
            const SizedBox(height: 32),
            _GuestStars(cast: ep!.guestStars, tokens: t),
          ],
          if ((ep?.stills ?? const []).isNotEmpty) ...[
            const SizedBox(height: 32),
            _Stills(paths: ep!.stills, tokens: t, tr: tr),
          ],
          // Trakt community comments for this specific episode, matching the
          // web episode-detail (self-hides when there are none). Gated on the
          // same "Show comments on detail pages" setting as the series page.
          if (ref.watch(settingsProvider).getBool('showTraktComments')) ...[
            const SizedBox(height: 32),
            TraktCommentsSection(
              type: 'series',
              id: seriesImdbId ?? id,
              season: season,
              episode: episode,
              tokens: t,
            ),
          ],
          const SizedBox(height: 56),
        ],
      ),
    );
  }

  Widget _hero(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
    Translations tr,
    EpisodeDetail? ep,
    double? rating,
  ) {
    final idiom = Idiom.of(context);
    final phone = idiom.isPhone;
    final g = pageGutter(idiom);
    final height = (MediaQuery.of(context).size.height * 0.52).clamp(
      360.0,
      560.0,
    );
    final still = ep?.stillPath;
    final stillUrl = still == null ? null : '$tmdbImg/w780$still';
    return SizedBox(
      height: height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (stillUrl != null)
            CachedNetworkImage(imageUrl: stillUrl, fit: BoxFit.cover)
          else
            ColoredBox(color: t.elevated),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  t.canvas.withValues(alpha: 0.15),
                  t.canvas.withValues(alpha: 0.65),
                  t.canvas,
                ],
                stops: const [0.0, 0.6, 1.0],
              ),
            ),
          ),
          // The back button pins to the top and the episode copy to the bottom
          // as a Stack, so a long name (or a large text scale) clips under the
          // hero rather than overflowing the fixed-height flex on a phone.
          Padding(
            padding: EdgeInsets.fromLTRB(g, 24, g, 28),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Positioned(
                  top: 0,
                  left: 0,
                  child: _BackButton(
                    tokens: t,
                    tr: tr,
                    onPressed: () =>
                        ref.read(navControllerProvider.notifier).back(),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'S$season · E$episode${title != null ? '  ·  $title' : ''}',
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        ep?.name.isNotEmpty == true
                            ? ep!.name
                            : tr.t('Episode {n}', {'n': episode}),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: phone ? 26 : 34,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if ((ep?.airDate ?? '').isNotEmpty)
                            _pill(t, ep!.airDate!),
                          if (ep?.runtime != null && ep!.runtime! > 0)
                            _pill(t, '${ep.runtime} ${tr.t('min')}'),
                          if (rating != null)
                            _pill(t, '★ ${rating.toStringAsFixed(1)}'),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _PlayButton(
                        tokens: t,
                        tr: tr,
                        onPressed: () => _play(ref),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(HarborTokens t, String text) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.7),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Text(
      text,
      style: TextStyle(
        color: t.inkMuted,
        fontSize: 13,
        fontWeight: FontWeight.w500,
      ),
    ),
  );

  Widget _centered(String text, HarborTokens t) => Center(
    child: Text(text, style: TextStyle(color: t.inkMuted, fontSize: 16)),
  );
}

class _BackButton extends StatelessWidget {
  const _BackButton({
    required this.tokens,
    required this.tr,
    required this.onPressed,
  });
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      autofocus: true,
      borderRadius: 999,
      onPressed: onPressed,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.arrow_back, size: 17, color: t.inkMuted),
            const SizedBox(width: 8),
            Text(
              tr.t('Back'),
              style: TextStyle(color: t.inkMuted, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlayButton extends StatelessWidget {
  const _PlayButton({
    required this.tokens,
    required this.tr,
    required this.onPressed,
  });
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onPressed,
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 28),
        decoration: BoxDecoration(
          color: t.ink,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.play_arrow, color: t.canvas, size: 20),
            const SizedBox(width: 8),
            Text(
              tr.t('Play Episode'),
              style: TextStyle(
                color: t.canvas,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GuestStars extends StatelessWidget {
  const _GuestStars({required this.cast, required this.tokens});
  final List<CastEntry> cast;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 0, g, 12),
          child: Text(
            'Guest stars · ${cast.length}',
            style: TextStyle(
              color: t.ink,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: 238,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: g),
            itemCount: cast.length,
            separatorBuilder: (_, _) => const SizedBox(width: 16),
            itemBuilder: (context, i) => _GuestCard(cast: cast[i], tokens: t),
          ),
        ),
      ],
    );
  }
}

class _GuestCard extends StatelessWidget {
  const _GuestCard({required this.cast, required this.tokens});
  final CastEntry cast;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final path = cast.profilePath;
    final photo = path == null
        ? null
        : (path.startsWith('http') ? path : '$tmdbImg/w185$path');
    return SizedBox(
      width: 118,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(
              aspectRatio: 2 / 3,
              child: photo != null
                  ? CachedNetworkImage(
                      imageUrl: photo,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => ColoredBox(color: t.elevated),
                      errorWidget: (_, _, _) => ColoredBox(color: t.elevated),
                    )
                  : ColoredBox(color: t.elevated),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            cast.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: t.ink,
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (cast.character.isNotEmpty)
            Text(
              cast.character,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: t.inkSubtle, fontSize: 12),
            ),
        ],
      ),
    );
  }
}

class _Stills extends StatelessWidget {
  const _Stills({required this.paths, required this.tokens, required this.tr});
  final List<String> paths;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 0, g, 12),
          child: Text(
            tr.t('Stills'),
            style: TextStyle(
              color: t.ink,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: 150,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: g),
            itemCount: paths.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) => ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: CachedNetworkImage(
                  imageUrl: '$tmdbImg/w500${paths[i]}',
                  fit: BoxFit.cover,
                  placeholder: (_, _) => ColoredBox(color: t.elevated),
                  errorWidget: (_, _, _) => ColoredBox(color: t.elevated),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
