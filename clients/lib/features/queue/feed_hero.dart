import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/tmdb.dart';
import '../../domain/feed/feed_pool.dart';
import '../../domain/nav/frame.dart';
import '../../domain/player/audio_track_select.dart' show isAnimeContent;
import '../detail/meta_awards_corner.dart';

/// The discovery-queue hero card — a full-bleed backdrop under the title's tag,
/// name, meta line and overview, over Play / Save / Skip / Not-interested
/// actions. Ported 1:1 from `components/feed-hero.tsx`. The leave animation is
/// owned by the queue; this card just renders one [item].
class FeedHero extends ConsumerWidget {
  const FeedHero({
    super.key,
    required this.item,
    required this.position,
    required this.total,
    required this.onSkip,
    this.onNotInterested,
  });

  final FeedItem item;
  final int position;
  final int total;
  final VoidCallback onSkip;
  final VoidCallback? onNotInterested;

  int? get _year => int.tryParse(
    RegExp(r'\d{4}').firstMatch(item.meta.releaseInfo ?? '')?.group(0) ?? '',
  );

  void _openDetail(WidgetRef ref) => ref
      .read(navControllerProvider.notifier)
      .push(
        Frame(FrameKind.meta, {'type': item.meta.type, 'id': item.meta.id}),
      );

  /// Opens the picker for tonight's watch, resolving the resume (or first)
  /// episode for a series, mirroring `smartPlayEpisode`.
  void _playTonight(WidgetRef ref) {
    final meta = item.meta;
    int? season;
    int? episode;
    if (meta.type == 'series') {
      final last = ref.read(resumeStoreProvider).lastPlayedEpisode(meta.id);
      season = last?.season ?? 1;
      episode = last?.episode ?? 1;
    }
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.picker, {
            'type': meta.type,
            'id': meta.id,
            'season': ?season,
            'episode': ?episode,
            'title': meta.name,
            'year': ?_year,
            'isAnime': isAnimeContent(meta.id, meta.genres),
            'poster': ?meta.poster,
          }),
        );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final meta = item.meta;
    final phone = Idiom.of(context).isPhone;
    final inWatchlist = ref.watch(watchlistProvider).contains(meta.id);
    final imdbId = meta.id.startsWith('tt') ? meta.id : null;
    final backdrop = upsizeTmdb(meta.background, full: true) ?? meta.poster;
    final positionLabel =
        '${(position + 1).toString().padLeft(2, '0')} / '
        '${total.toString().padLeft(2, '0')}';
    final isSeries = meta.type == 'series';

    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: t.canvas,
          border: Border.all(color: t.edgeSoft),
          borderRadius: BorderRadius.circular(28),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (backdrop != null)
              CachedNetworkImage(imageUrl: backdrop, fit: BoxFit.cover),
            // Bottom-up scrim so the copy stays legible over the backdrop.
            const _Scrim(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
            ),
            // Left-to-right scrim behind the text column.
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    Colors.black.withValues(alpha: 0.62),
                    Colors.transparent,
                  ],
                  stops: const [0, 0.58],
                ),
              ),
            ),
            if (imdbId != null)
              Positioned.fill(
                child: IgnorePointer(
                  child: MetaAwardsCorner(
                    imdbId: imdbId,
                    name: meta.name,
                    year: _year,
                    isAnime: isAnimeContent(meta.id, meta.genres),
                    tokens: t,
                  ),
                ),
              ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                phone ? 24 : 40,
                20,
                phone ? 24 : 40,
                phone ? 28 : 36,
              ),
              // The label pins to the top and the copy/actions to the bottom.
              // A Stack (rather than a Column with a Spacer) means a very short
              // hero clips the copy under the card — matching the web's
              // justify-between inside an overflow-hidden container — instead of
              // overflowing the flex on a small screen.
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Row(
                      children: [
                        Text(
                          positionLabel,
                          style: TextStyle(
                            color: t.ink.withValues(alpha: 0.85),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 2.6,
                          ),
                        ),
                        const Spacer(),
                        Focusable(
                          tokens: t,
                          borderRadius: 999,
                          onPressed: () => _openDetail(ref),
                          child: Container(
                            height: 44,
                            width: 44,
                            decoration: BoxDecoration(
                              color: t.canvas.withValues(alpha: 0.35),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: t.ink.withValues(alpha: 0.15),
                              ),
                            ),
                            child: Icon(
                              Icons.info_outline,
                              size: 18,
                              color: t.ink.withValues(alpha: 0.85),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 760),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _pill(t, item.tag, filled: true),
                                if (isSeries &&
                                    item.tag.toLowerCase() != 'series') ...[
                                  const SizedBox(width: 8),
                                  _pill(t, 'Series', filled: false),
                                ],
                              ],
                            ),
                            const SizedBox(height: 14),
                            Text(
                              meta.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: t.ink,
                                fontSize: phone ? 34 : 44,
                                fontWeight: FontWeight.w500,
                                height: 1.05,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 12),
                            _metaLine(t),
                            if (meta.description != null &&
                                meta.description!.isNotEmpty) ...[
                              const SizedBox(height: 14),
                              Text(
                                meta.description!,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: t.ink.withValues(alpha: 0.8),
                                  fontSize: 15.5,
                                  height: 1.55,
                                ),
                              ),
                            ],
                            const SizedBox(height: 20),
                            Wrap(
                              spacing: 12,
                              runSpacing: 10,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                _playButton(ref, t),
                                _secondaryAction(
                                  t,
                                  icon: inWatchlist
                                      ? Icons.bookmark
                                      : Icons.bookmark_border,
                                  label: inWatchlist ? 'Saved' : 'Save',
                                  active: inWatchlist,
                                  onPressed: () => ref
                                      .read(watchlistProvider.notifier)
                                      .toggle(
                                        id: meta.id,
                                        type: meta.type,
                                        name: meta.name,
                                        poster: meta.poster,
                                      ),
                                ),
                                _secondaryAction(
                                  t,
                                  icon: Icons.skip_next,
                                  label: 'Skip',
                                  onPressed: onSkip,
                                ),
                                if (onNotInterested != null)
                                  _secondaryAction(
                                    t,
                                    icon: Icons.thumb_down_outlined,
                                    label: 'Not interested',
                                    onPressed: onNotInterested!,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _metaLine(HarborTokens t) {
    final meta = item.meta;
    final parts = <Widget>[];
    void addDot() {
      if (parts.isNotEmpty) {
        parts.add(
          Text(
            '·',
            style: TextStyle(color: t.ink.withValues(alpha: 0.4), fontSize: 14),
          ),
        );
      }
    }

    if (meta.releaseInfo != null && meta.releaseInfo!.isNotEmpty) {
      parts.add(_metaText(t, meta.releaseInfo!));
    }
    if (meta.imdbRating != null) {
      addDot();
      parts.add(
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: const Color(0xFFF5C518),
                borderRadius: BorderRadius.circular(3),
              ),
              child: const Text(
                'IMDb',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 6),
            _metaText(t, '${meta.imdbRating}'),
          ],
        ),
      );
    }
    if (meta.genres.isNotEmpty) {
      addDot();
      parts.add(_metaText(t, meta.genres.take(3).join(', ')));
    }
    return Wrap(
      spacing: 12,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: parts,
    );
  }

  Widget _metaText(HarborTokens t, String text) => Text(
    text,
    style: TextStyle(color: t.ink.withValues(alpha: 0.85), fontSize: 14),
  );

  Widget _pill(HarborTokens t, String label, {required bool filled}) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: filled ? t.accent.withValues(alpha: 0.9) : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: filled
              ? null
              : Border.all(color: t.ink.withValues(alpha: 0.3)),
        ),
        child: Text(
          label.toUpperCase(),
          style: TextStyle(
            color: filled ? t.canvas : t.ink.withValues(alpha: 0.85),
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 2.2,
          ),
        ),
      );

  Widget _playButton(WidgetRef ref, HarborTokens t) => Focusable(
    tokens: t,
    autofocus: true,
    borderRadius: 999,
    onPressed: () => _playTonight(ref),
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
          Icon(Icons.play_arrow, size: 20, color: t.canvas),
          const SizedBox(width: 8),
          Text(
            'Play tonight',
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

  Widget _secondaryAction(
    HarborTokens t, {
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    bool active = false,
  }) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: onPressed,
    child: Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: active
            ? t.accent.withValues(alpha: 0.15)
            : t.canvas.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: active ? t.accent.withValues(alpha: 0.6) : t.edge,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: active ? t.accent : t.ink),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: active ? t.accent : t.ink,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    ),
  );
}

/// A single-direction black scrim gradient, fading from opaque to transparent.
class _Scrim extends StatelessWidget {
  const _Scrim({required this.begin, required this.end});

  final Alignment begin;
  final Alignment end;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: begin,
        end: end,
        colors: [
          Colors.black.withValues(alpha: 0.96),
          Colors.black.withValues(alpha: 0.55),
          Colors.transparent,
        ],
        stops: const [0, 0.36, 0.64],
      ),
    ),
  );
}
