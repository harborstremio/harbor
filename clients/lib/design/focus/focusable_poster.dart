import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anime_providers.dart';
import '../../app/providers.dart';
import '../../domain/addons/models.dart';
import '../../domain/anime/anime_dub.dart';
import '../overlays/context_menu.dart';
import '../tokens.dart';
import 'card_score_badges.dart';
import 'focusable.dart';
import 'ui_sound.dart';
import 'rpdb_poster_image.dart';

/// A poster cell width/extent scaled by the user's `posterScale`, floored at
/// 72px, matching the source row layout (`max(72, min * posterScale)`).
double scaledPosterCell(double base, double posterScale) =>
    (base * (posterScale > 0 ? posterScale : 1)).clamp(72.0, 400.0);

/// The vertical space a poster's title label + its top padding occupy beneath
/// the 2:3 image; removed from the rail height / grid cell when titles are off.
const double kPosterTitleArea = 28;

/// The horizontal-rail height for a scaled poster: the 2:3 poster plus the fixed
/// title area beneath it. When [hideTitles] is set (the `hidePosterTitles`
/// setting) the title area is dropped, leaving only the focus-scale headroom.
double scaledRailHeight(
  double posterScale, {
  bool hideTitles = false,
  double base = 150,
}) {
  final full = scaledPosterCell(base, posterScale) * 1.5 + 40;
  return hideTitles ? full - kPosterTitleArea : full;
}

/// A poster grid cell's aspect ratio: [shownAspect] when the title shows,
/// collapsing to the bare 2:3 image when [hideTitles] (the `hidePosterTitles`
/// setting) removes the title row.
double posterGridAspect(double shownAspect, bool hideTitles) =>
    hideTitles ? 2 / 3 : shownAspect;

/// The poster's visible corner radius from the `posterRadius` setting (px),
/// bounded to the settings slider's 0–40 range. Ported from `--poster-radius`.
double posterCardRadius(double setting) => setting.clamp(0.0, 40.0);

/// A rail/section title's font size scaled by the `rowTitleScale` setting,
/// bounded to the slider's 0.8–1.6 range and rounded — matching
/// `Math.round(17 * rowTitleScale)` on the web's shared Row header.
double scaledRowTitle(double base, double rowTitleScale) =>
    (base * rowTitleScale.clamp(0.8, 1.6)).roundToDouble();

/// The corner inset for the watchlist bookmark badge from the `watchlistBadge`
/// setting (topEnd/topStart/bottomEnd/bottomStart), or null when "off" or
/// unknown. `end` is the trailing edge (right in LTR). Ported from
/// WATCHLIST_POS in `pick-card.tsx`.
({double? top, double? bottom, double? left, double? right})?
watchlistBadgeInset(String pos) {
  const i = 6.0;
  return switch (pos) {
    'topEnd' => (top: i, bottom: null, left: null, right: i),
    'topStart' => (top: i, bottom: null, left: i, right: null),
    'bottomEnd' => (top: null, bottom: i, left: null, right: i),
    'bottomStart' => (top: null, bottom: i, left: i, right: null),
    _ => null,
  };
}

/// A catalog poster tile (2:3) with the standard 10-foot focus treatment and a
/// title that reveals on focus. Posters route through the RPDB chain (rated
/// poster, then the raw poster on error). Real loading/error states — no
/// placeholder art.
class FocusablePoster extends ConsumerWidget {
  const FocusablePoster({
    super.key,
    required this.item,
    required this.tokens,
    required this.onPressed,
    this.width = 150,
    this.autofocus = false,
    this.kids = false,
  });

  final MetaPreview item;
  final HarborTokens tokens;
  final VoidCallback onPressed;
  final double width;
  final bool autofocus;

  /// On the kids surface, the rating badge shows as a gold star.
  final bool kids;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    // The poster's visible corner radius follows the `posterRadius` setting;
    // Focusable clips its child at (borderRadius - 3), so the +3 keeps the
    // focus ring exactly 3px outside the poster corners.
    final radius = posterCardRadius(settings.getDouble('posterRadius'));
    final hideTitle = settings.getBool('hidePosterTitles');
    // The watchlist bookmark badge shows on bookmarked titles at the corner set
    // by `watchlistBadge` ("off" hides it).
    final badgeInset = ref.watch(watchlistProvider).contains(item.id)
        ? watchlistBadgeInset(settings.getString('watchlistBadge'))
        : null;
    // The "DUB" badge on anime cards (web pick-card) — only anime ids subscribe
    // to the dub set (the `&&` short-circuits the watch for movies/series).
    final isAnimeId =
        item.id.startsWith('mal:') || item.id.startsWith('anilist:');
    final hasDub =
        !kids &&
        isAnimeId &&
        settings.getBool('showDubBadge') &&
        (ref.watch(animeDubSetProvider).asData?.value ?? AnimeDubSet.empty)
            .hasDub(item.id);
    return SizedBox(
      width: width,
      child: Focusable(
        tokens: tokens,
        autofocus: autofocus,
        onPressed: onPressed,
        onLongPress: () => _openMenu(context, ref),
        borderRadius: radius + 3,
        sfxTap: SfxTap.open, // media card → web SFX.open
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 2 / 3,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    color: tokens.surface,
                    child: RpdbPosterImage(
                      metaId: item.id,
                      rawPoster: item.poster,
                      type: item.type,
                      tokens: tokens,
                      fallback: _fallback,
                    ),
                  ),
                  if (badgeInset != null)
                    Positioned(
                      top: badgeInset.top,
                      bottom: badgeInset.bottom,
                      left: badgeInset.left,
                      right: badgeInset.right,
                      child: _watchlistBadge(),
                    ),
                  CardScoreBadges(item: item, tokens: tokens, kids: kids),
                  if (hasDub)
                    Positioned(top: 6, left: 6, child: _dubBadge()),
                ],
              ),
            ),
            if (!hideTitle)
              Padding(
                padding: const EdgeInsets.fromLTRB(2, 6, 2, 0),
                child: Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: tokens.inkMuted, fontSize: 13),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// The "DUB" pill for a dubbed anime card (web pick-card's DUB badge).
  Widget _dubBadge() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: tokens.accent.withValues(alpha: 0.92),
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: Colors.black.withValues(alpha: 0.1)),
    ),
    child: Text(
      'DUB',
      style: TextStyle(
        color: tokens.canvas,
        fontSize: 9,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.2,
      ),
    ),
  );

  Widget _watchlistBadge() => Container(
    width: 22,
    height: 22,
    decoration: BoxDecoration(
      color: tokens.canvas.withValues(alpha: 0.85),
      shape: BoxShape.circle,
      border: Border.all(color: tokens.edgeSoft.withValues(alpha: 0.7)),
    ),
    child: Icon(Icons.bookmark, size: 12, color: tokens.ink),
  );

  Widget _fallback() => Center(
    child: Padding(
      padding: const EdgeInsets.all(8),
      child: Text(
        item.name,
        textAlign: TextAlign.center,
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: tokens.inkSubtle, fontSize: 13),
      ),
    ),
  );

  /// The poster's long-press / context-key menu — the native counterpart of the
  /// web poster context menu, offering the actions clientv2 can back locally.
  Future<void> _openMenu(BuildContext context, WidgetRef ref) async {
    final inWatchlist = ref.read(watchlistProvider).contains(item.id);
    final inFavorites = ref.read(mediaFavoritesProvider).contains(item.id);
    final isMovie = item.type == 'movie';
    final watched = ref.read(movieWatchedProvider).contains(item.id);
    final result = await showContextMenu<String>(
      context: context,
      tokens: tokens,
      actions: [
        const ContextMenuAction(
          value: 'details',
          label: 'View details',
          icon: Icons.info_outline,
        ),
        ContextMenuAction(
          value: 'watchlist',
          label: inWatchlist ? 'In watchlist' : 'Add to watchlist',
          icon: inWatchlist ? Icons.bookmark : Icons.bookmark_add_outlined,
        ),
        ContextMenuAction(
          value: 'favorite',
          label: inFavorites ? 'In favorites' : 'Add to favorites',
          icon: inFavorites ? Icons.star : Icons.star_border,
        ),
        if (isMovie && !watched)
          const ContextMenuAction(
            value: 'watched',
            label: 'Mark as watched',
            icon: Icons.check,
          ),
      ],
    );
    switch (result) {
      case 'details':
        onPressed();
      case 'watchlist':
        ref
            .read(watchlistProvider.notifier)
            .toggle(
              id: item.id,
              type: item.type,
              name: item.name,
              poster: item.poster,
            );
      case 'favorite':
        ref
            .read(mediaFavoritesProvider.notifier)
            .toggle(
              id: item.id,
              type: item.type,
              name: item.name,
              poster: item.poster,
            );
      case 'watched':
        ref.read(movieWatchedProvider.notifier).mark(item.id);
    }
  }
}
