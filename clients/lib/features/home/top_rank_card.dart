import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../app/anime_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/anime/anime_awards.dart';
import '../../domain/nav/frame.dart';
import '../../design/layout/idiom.dart';

/// The Home "Top 10" rail, ported from the `shape="rank"` Row in
/// `src/views/home.tsx`: a horizontal track of [TopRankCard]s, each a giant
/// outlined rank numeral behind a portrait poster.
class TopRankRail extends ConsumerWidget {
  const TopRankRail({super.key, required this.title, required this.items});

  final String title;
  final List<MetaPreview> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = pageGutter(Idiom.of(context));
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final titleScale = ref.watch(settingsProvider).getDouble('rowTitleScale');
    // Localize the whole phrase like web `t('Top 10 {name}', {name})` — the
    // "Top 10" prefix must translate too (was a hardcoded English prefix). A
    // name that already says "top" is shown as-is.
    final railTitle = title.toLowerCase().contains('top')
        ? title
        : tr.t('Top 10 {name}', {'name': title});
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 4, g, 10),
          child: Text(
            railTitle,
            style: TextStyle(
              color: t.ink,
              fontSize: scaledRowTitle(20, titleScale),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: _cardWidth * 268 / 228 + 4,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 18),
              itemBuilder: (context, i) =>
                  TopRankCard(meta: items[i], rank: i + 1, tokens: t),
            ),
          ),
        ),
      ],
    );
  }
}

/// The web card is `min={180}` in a `228 / 268` aspect box.
const double _cardWidth = 190;

/// A single Top-10 card: an outlined serif rank numeral pinned to the left, the
/// portrait poster occupying the right 60%, a watchlist bookmark when the title
/// is saved, and the truncated name along the bottom.
class TopRankCard extends ConsumerWidget {
  const TopRankCard({
    super.key,
    required this.meta,
    required this.rank,
    required this.tokens,
  });

  final MetaPreview meta;
  final int rank;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The bookmark shows when the title is in the watchlist under either its
    // own id or its resolved IMDb id — a Top-10 `tmdb:` title may have been
    // saved under `tt…` (or vice-versa). Ports `useInWatchlist(id, [imdb])`;
    // `imdbIdProvider` passes `tt…` through with no network and only resolves
    // `tmdb:` ids.
    final watchlist = ref.watch(watchlistProvider);
    final resolvedImdb = ref.watch(imdbIdProvider(meta.id)).value;
    final inWatchlist =
        watchlist.contains(meta.id) ||
        (resolvedImdb != null && watchlist.contains(resolvedImdb));
    // The top anime-award win (if any), for the corner AwardDot. Ported from
    // `<AwardDot name={meta.name} year={parseAwardYear(meta.releaseInfo)}/>`.
    final award = ref
        .watch(animeAwardsProvider)
        .value
        ?.findTopAward(meta.name, releaseYear: parseAwardYear(meta.releaseInfo));
    final poster = meta.poster;
    // 240/228 of the card width, matching the web's `100cqw * 240 / 228`.
    final numeralSize = _cardWidth * 240 / 228;
    final posterWidth = _cardWidth * 0.6;

    return SizedBox(
      width: _cardWidth,
      child: Focusable(
        tokens: tokens,
        borderRadius: 12,
        onPressed: () => ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.meta, {'type': meta.type, 'id': meta.id})),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // The outlined rank numeral, behind the poster, bled off the start edge.
            Positioned(
              left: -_cardWidth * 0.03,
              top: 0,
              child: Text(
                '$rank',
                style: TextStyle(
                  fontFamily: 'serif',
                  fontSize: numeralSize,
                  height: 0.85,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.05 * numeralSize,
                  foreground: Paint()
                    ..style = PaintingStyle.stroke
                    ..strokeWidth = 2.4
                    ..color = tokens.inkMuted,
                ),
              ),
            ),
            // The poster, occupying the right 60%.
            Positioned(
              right: 0,
              top: 0,
              width: posterWidth,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AspectRatio(
                  aspectRatio: 2 / 3,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Route through the RPDB rated-poster chain (falls back
                      // to the raw poster, then the name), matching the web's
                      // `usePosterChain(settings.rpdbKey, …)` in top-rank-card.
                      RpdbPosterImage(
                        metaId: meta.id,
                        rawPoster: poster,
                        type: meta.type,
                        tokens: tokens,
                        fallback: _fallback,
                      ),
                      if (inWatchlist)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: tokens.canvas.withValues(alpha: 0.85),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.bookmark,
                              size: 12,
                              color: tokens.ink,
                            ),
                          ),
                        ),
                      // The anime-award corner badge (icon + year), at the
                      // poster's top-start. Ported from `AwardDot`.
                      if (award != null)
                        PositionedDirectional(
                          top: 6,
                          start: 6,
                          child: _AwardDot(win: award, tokens: tokens),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            // The title along the bottom, right-aligned under the poster.
            Positioned(
              right: 0,
              bottom: 0,
              width: _cardWidth * 0.63,
              child: Text(
                meta.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: tokens.inkSubtle, fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fallback() => ColoredBox(
    color: tokens.surface,
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Text(
          meta.name,
          textAlign: TextAlign.center,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: tokens.inkSubtle, fontSize: 12),
        ),
      ),
    ),
  );
}

/// The anime-award corner badge: the award body's small logo followed by the
/// win year, on a translucent pill. Ported 1:1 from `AwardDot` in
/// `top-rank-card.tsx` (the `animation_kobe` logo is inverted to read white).
class _AwardDot extends StatelessWidget {
  const _AwardDot({required this.win, required this.tokens});

  final AwardWin win;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final src = kAwardSourceMeta[win.source];
    final iconAsset = src?.iconSmall;
    final invert = win.source == AwardSourceId.animationKobe;
    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: tokens.canvas.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: tokens.edgeSoft.withValues(alpha: 0.6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (iconAsset != null) ...[
            _icon(iconAsset, invert),
            const SizedBox(width: 4),
          ],
          Text(
            '${win.year}',
            style: TextStyle(
              color: tokens.ink,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.26, // 0.14em on 9px
            ),
          ),
        ],
      ),
    );
  }

  /// The award body's small logo, 10×10. SVG sources render through
  /// [SvgPicture]; [invert] tints them to the foreground (the web's
  /// `brightness-0 invert` on the animation_kobe mark).
  Widget _icon(String asset, bool invert) {
    if (asset.endsWith('.svg')) {
      return SvgPicture.asset(
        asset,
        width: 10,
        height: 10,
        fit: BoxFit.contain,
        colorFilter: invert
            ? ColorFilter.mode(tokens.ink, BlendMode.srcIn)
            : null,
        placeholderBuilder: (_) => const SizedBox(width: 10, height: 10),
      );
    }
    return Image.asset(
      asset,
      width: 10,
      height: 10,
      fit: BoxFit.contain,
      color: invert ? tokens.ink : null,
      errorBuilder: (_, _, _) => const SizedBox.shrink(),
    );
  }
}
