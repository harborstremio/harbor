import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/feed_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart'
    show detailRatingsProvider, imdbIdProvider, settingsProvider;
import '../../design/focus/focusable.dart';
import '../../design/lightbox.dart';
import '../../design/rating_badges.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/anime/anime_awards.dart' show parseAwardYear;
import '../../domain/catalog/tmdb.dart' show tmdbImg;
import '../../domain/catalog/tmdb_critic.dart';
import '../../domain/nav/frame.dart';
import '../detail/meta_awards_corner.dart';
import '../home/hero_carousel.dart' show heroLogoProvider;

/// Trims a review to ~320 chars at a sentence or word boundary. Ported 1:1 from
/// `excerptReview` in critics-pick/utils.ts.
String excerptReview(String content) {
  final trimmed = content.trim();
  if (trimmed.length <= 320) return trimmed;
  final cutoff = trimmed.substring(0, 320);
  final lastSentence = cutoff.lastIndexOf('. ');
  if (lastSentence > 160) return trimmed.substring(0, lastSentence + 1);
  final lastSpace = cutoff.lastIndexOf(' ');
  return '${trimmed.substring(0, lastSpace > 0 ? lastSpace : 320)}…';
}

/// The Discover "Critics' Pick" spotlight — one enriched title with its
/// backdrop, logo/title, key metadata and the top critic review. Ported from
/// `components/critics-pick.tsx` (this slice: the backdrop hero + review quote;
/// stills strip, cast chips, review nav and lightbox follow). Focusable so a
/// TV remote can Select it to open the title.
class CriticsPickSpotlight extends ConsumerWidget {
  const CriticsPickSpotlight({
    super.key,
    required this.meta,
    required this.tokens,
  });

  final MetaPreview meta;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tr = ref.watch(translationsProvider);
    final logo = ref
        .watch(heroLogoProvider((id: meta.id, type: meta.type)))
        .value;
    final critic = ref
        .watch(criticDataProvider((id: meta.id, type: meta.type)))
        .value;

    final reviews = critic?.reviews ?? const <CriticReview>[];
    final cast = critic?.cast ?? const <CriticCast>[];
    final stills = ref.watch(movieStillsProvider(meta.id)).value ?? const [];
    // The resolved IMDb id backs the awards corner (self-hides without wins)
    // and the OMDB critic scores (RT + Metacritic) on the rating line.
    final imdbId = ref.watch(imdbIdProvider(meta.id)).value;
    final omdb = imdbId != null
        ? ref
              .watch(
                detailRatingsProvider((
                  imdbId: imdbId,
                  mediaType: meta.type == 'series' ? 'show' : 'movie',
                )),
              )
              .value
              ?.omdb
        : null;
    final showRt = ref.watch(settingsProvider).getBool('showRtBadge');
    final rtCritics = showRt ? omdb?.rtCritics : null;
    final metascore = omdb?.metascore;
    final metaBits = <String>[
      ...(critic?.genres.take(2) ?? const <String>[]),
      if (critic?.runtime != null && critic!.runtime! > 0)
        '${critic.runtime} min',
      if (critic?.director != null) critic!.director!.name,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          tr.t("Critics' Pick"),
          style: TextStyle(
            color: tokens.ink,
            fontSize: 22,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.2,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          tr.t('Loved by reviewers today').toUpperCase(),
          style: TextStyle(
            color: tokens.inkSubtle,
            fontSize: 11,
            letterSpacing: 2.4,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: tokens.surface,
              border: Border.all(color: tokens.edgeSoft),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Only the backdrop opens the title — the review nav and cast
                // chips below are their own focusable controls (web parity).
                Focusable(
                  tokens: tokens,
                  borderRadius: 16,
                  onPressed: () => ref
                      .read(navControllerProvider.notifier)
                      .push(
                        Frame(FrameKind.meta, {
                          'type': meta.type,
                          'id': meta.id,
                        }),
                      ),
                  child: _backdrop(
                    logo,
                    metaBits,
                    imdbId,
                    rtCritics,
                    metascore,
                  ),
                ),
                if (reviews.isNotEmpty)
                  _ReviewCarousel(reviews: reviews, tokens: tokens)
                else if ((critic?.tagline ?? meta.description ?? '').isNotEmpty)
                  _fallbackText(critic?.tagline ?? meta.description!),
                if ((critic?.overview ?? meta.description ?? '').isNotEmpty)
                  _ReadFullButton(
                    title: meta.name,
                    overview: critic?.overview ?? meta.description!,
                    tagline: critic?.tagline,
                    label: tr.t('Read full'),
                    closeLabel: tr.t('Close'),
                    tokens: tokens,
                  ),
                if (stills.isNotEmpty)
                  _StillsGrid(stills: stills, tokens: tokens),
                if (cast.isNotEmpty)
                  _CastStrip(
                    cast: cast,
                    tokens: tokens,
                    onOpen: (id) => ref
                        .read(navControllerProvider.notifier)
                        .push(Frame(FrameKind.person, {'id': id})),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _fallbackText(String text) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
    child: Text(
      text,
      maxLines: 4,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(color: tokens.inkMuted, fontSize: 13.5, height: 1.45),
    ),
  );

  Widget _backdrop(
    String? logo,
    List<String> metaBits,
    String? imdbId,
    int? rtCritics,
    int? metascore,
  ) {
    return LayoutBuilder(
      builder: (context, c) {
        final height = c.maxWidth < 640 ? 220.0 : 320.0;
        final background = meta.background ?? meta.poster;
        return SizedBox(
          height: height,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (background != null)
                CachedNetworkImage(
                  imageUrl: background,
                  fit: BoxFit.cover,
                  placeholder: (_, _) => ColoredBox(color: tokens.surface),
                  errorWidget: (_, _, _) => ColoredBox(color: tokens.surface),
                )
              else
                ColoredBox(color: tokens.surface),
              // Award laurels for a decorated title (self-hides otherwise).
              if (imdbId != null && imdbId.isNotEmpty)
                PositionedDirectional(
                  start: 16,
                  top: 16,
                  child: MetaAwardsCorner(
                    imdbId: imdbId,
                    name: meta.name,
                    year: parseAwardYear(meta.releaseInfo) ?? 0,
                    isAnime: false,
                    tokens: tokens,
                  ),
                ),
              // Bottom scrim so the title/meta read over any backdrop.
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      tokens.canvas.withValues(alpha: 0.15),
                      tokens.canvas.withValues(alpha: 0.9),
                    ],
                    stops: const [0.35, 0.65, 1],
                  ),
                ),
              ),
              Positioned(
                left: 20,
                right: 20,
                bottom: 18,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (logo != null && logo.isNotEmpty)
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 54),
                        child: Image.network(
                          logo,
                          height: 54,
                          fit: BoxFit.contain,
                          alignment: Alignment.centerLeft,
                          errorBuilder: (_, _, _) => _titleText(),
                        ),
                      )
                    else
                      _titleText(),
                    if (metaBits.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _metaLine(metaBits, rtCritics, metascore),
                    ],
                  ],
                ),
              ),
              // Play affordance, top-end.
              PositionedDirectional(
                end: 16,
                top: 16,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: tokens.ink.withValues(alpha: 0.92),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.play_arrow, size: 22, color: tokens.canvas),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _titleText() => Text(
    meta.name,
    maxLines: 2,
    overflow: TextOverflow.ellipsis,
    style: TextStyle(
      color: tokens.ink,
      fontSize: 26,
      fontWeight: FontWeight.w700,
      height: 1.05,
    ),
  );

  Widget _metaLine(List<String> bits, int? rtCritics, int? metascore) {
    final rating = meta.imdbRating;
    return Row(
      children: [
        if (rating != null) ...[
          Icon(Icons.star, size: 13, color: const Color(0xFFF5C518)),
          const SizedBox(width: 4),
          Text(
            rating.toStringAsFixed(1),
            style: TextStyle(
              color: tokens.ink,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 10),
        ],
        // Rotten Tomatoes critics score, then the Metacritic chip.
        if (rtCritics != null) ...[
          RtScore(critics: rtCritics, tokens: tokens),
          const SizedBox(width: 10),
        ],
        if (metascore != null) ...[
          MetascoreChip(score: metascore),
          const SizedBox(width: 10),
        ],
        Flexible(
          child: Text(
            bits.join('  ·  '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: tokens.ink.withValues(alpha: 0.85), fontSize: 12.5),
          ),
        ),
      ],
    );
  }
}

/// The critic-review quote with prev/next navigation across the (up to six)
/// reviews, ported from the `reviewIdx` carousel in critics-pick.tsx.
class _ReviewCarousel extends StatefulWidget {
  const _ReviewCarousel({required this.reviews, required this.tokens});

  final List<CriticReview> reviews;
  final HarborTokens tokens;

  @override
  State<_ReviewCarousel> createState() => _ReviewCarouselState();
}

class _ReviewCarouselState extends State<_ReviewCarousel> {
  int _idx = 0;

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final n = widget.reviews.length;
    final review = widget.reviews[_idx % n];
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.format_quote, size: 20, color: t.accent),
          const SizedBox(height: 6),
          Text(
            excerptReview(review.content),
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: t.inkMuted, fontSize: 13.5, height: 1.45),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Text(
                        '— ${review.author}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 11.5,
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (review.rating != null) ...[
                      const SizedBox(width: 8),
                      Icon(Icons.star, size: 11, color: t.accent),
                      const SizedBox(width: 2),
                      Text(
                        review.rating!.toStringAsFixed(0),
                        style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                      ),
                    ],
                  ],
                ),
              ),
              // Prev/next only when there is more than one review.
              if (n > 1) ...[
                _navButton(t, Icons.chevron_left, 'Previous review', () {
                  setState(() => _idx = (_idx - 1 + n) % n);
                }),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Text(
                    '${_idx % n + 1}/$n',
                    style: TextStyle(color: t.inkSubtle, fontSize: 11),
                  ),
                ),
                _navButton(t, Icons.chevron_right, 'Next review', () {
                  setState(() => _idx = (_idx + 1) % n);
                }),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _navButton(
    HarborTokens t,
    IconData icon,
    String label,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: onTap,
    child: Padding(
      padding: const EdgeInsets.all(4),
      child: Semantics(
        label: label,
        button: true,
        child: Icon(icon, size: 18, color: t.inkMuted),
      ),
    ),
  );
}

/// The "Read full" affordance — opens the full plot overview (and tagline) in a
/// modal. Ported from the `OverviewModal` trigger in critics-pick.tsx.
class _ReadFullButton extends StatelessWidget {
  const _ReadFullButton({
    required this.title,
    required this.overview,
    required this.tagline,
    required this.label,
    required this.closeLabel,
    required this.tokens,
  });

  final String title;
  final String overview;
  final String? tagline;
  final String label;
  final String closeLabel;
  final HarborTokens tokens;

  void _open(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: tokens.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560, maxHeight: 520),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: tokens.ink,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (tagline != null && tagline!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    tagline!,
                    style: TextStyle(
                      color: tokens.inkSubtle,
                      fontSize: 13,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                Flexible(
                  child: SingleChildScrollView(
                    child: Text(
                      overview,
                      style: TextStyle(
                        color: tokens.inkMuted,
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: Focusable(
                    tokens: tokens,
                    borderRadius: 999,
                    autofocus: true,
                    onPressed: () => Navigator.of(context).maybePop(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: tokens.ink,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        closeLabel,
                        style: TextStyle(
                          color: tokens.canvas,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Focusable(
          tokens: tokens,
          borderRadius: 8,
          onPressed: () => _open(context),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            child: Text(
              label.toUpperCase(),
              style: TextStyle(
                color: tokens.accent,
                fontSize: 11.5,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The 2-column stills grid (up to four backdrops) — each tile opens the full
/// stills set in the shared lightbox. Ported from the `stillTiles` grid + the
/// lightbox wiring in critics-pick.tsx.
class _StillsGrid extends StatelessWidget {
  const _StillsGrid({required this.stills, required this.tokens});

  final List<String> stills;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final tiles = stills.take(4).toList();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 6,
        crossAxisSpacing: 6,
        childAspectRatio: 16 / 9,
        children: [
          for (var i = 0; i < tiles.length; i++)
            Focusable(
              tokens: tokens,
              borderRadius: 10,
              onPressed: () => showImageLightbox(context, stills, i, tokens),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: CachedNetworkImage(
                  imageUrl: tiles[i],
                  fit: BoxFit.cover,
                  placeholder: (_, _) => ColoredBox(color: tokens.elevated),
                  errorWidget: (_, _, _) => ColoredBox(color: tokens.elevated),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The horizontal cast strip — a scroller of circular avatar chips that open
/// the person on Select. Ported from the cast row + `CastChip`.
class _CastStrip extends StatelessWidget {
  const _CastStrip({
    required this.cast,
    required this.tokens,
    required this.onOpen,
  });

  final List<CriticCast> cast;
  final HarborTokens tokens;
  final void Function(int personId) onOpen;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 20, right: 8, bottom: 18),
      child: SizedBox(
        height: 78,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: cast.length,
          separatorBuilder: (_, _) => const SizedBox(width: 6),
          itemBuilder: (context, i) => _CastChip(
            member: cast[i],
            tokens: tokens,
            onTap: () => onOpen(cast[i].id),
          ),
        ),
      ),
    );
  }
}

class _CastChip extends StatelessWidget {
  const _CastChip({
    required this.member,
    required this.tokens,
    required this.onTap,
  });

  final CriticCast member;
  final HarborTokens tokens;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final firstName = member.name.split(' ').first;
    final profile = member.profilePath;
    return SizedBox(
      width: 68,
      child: Focusable(
        tokens: tokens,
        borderRadius: 12,
        onPressed: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipOval(
              child: SizedBox(
                width: 48,
                height: 48,
                child: profile != null
                    ? CachedNetworkImage(
                        imageUrl: '$tmdbImg/w185$profile',
                        fit: BoxFit.cover,
                        placeholder: (_, _) => _initial(firstName),
                        errorWidget: (_, _, _) => _initial(firstName),
                      )
                    : _initial(firstName),
              ),
            ),
            const SizedBox(height: 5),
            Text(
              firstName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(color: tokens.ink, fontSize: 10.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _initial(String name) => ColoredBox(
    color: tokens.elevated,
    child: Center(
      child: Text(
        name.isEmpty ? '?' : name.substring(0, 1),
        style: TextStyle(
          color: tokens.inkSubtle,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );
}
