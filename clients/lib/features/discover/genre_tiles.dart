import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/color/oklch.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart' show scaledRowTitle;
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/filter_rails.dart';
import '../../domain/catalog/tmdb.dart' show kMovieGenres;
import '../../domain/nav/frame.dart';
import 'tile_collage.dart';

/// A genre tile's palette — from/to gradient stops and the ink colour, each an
/// `(L, C, H)` oklch triple ported 1:1 from the web `GENRE_PALETTE`.
typedef _Oklch = (double l, double c, double h);

class _Palette {
  const _Palette(this.from, this.to, this.ink);
  final _Oklch from;
  final _Oklch to;
  final _Oklch ink;
}

const Map<String, _Palette> _kPalette = {
  'Action': _Palette((0.40, 0.18, 25), (0.18, 0.10, 20), (0.96, 0.02, 25)),
  'Adventure': _Palette((0.45, 0.14, 145), (0.20, 0.10, 155), (
    0.96,
    0.02,
    145,
  )),
  'Animation': _Palette((0.50, 0.16, 200), (0.20, 0.10, 195), (
    0.96,
    0.02,
    200,
  )),
  'Comedy': _Palette((0.55, 0.16, 75), (0.22, 0.08, 60), (0.96, 0.02, 80)),
  'Crime': _Palette((0.32, 0.10, 50), (0.14, 0.04, 30), (0.95, 0.04, 60)),
  'Documentary': _Palette((0.36, 0.10, 145), (0.18, 0.06, 150), (
    0.96,
    0.02,
    145,
  )),
  'Drama': _Palette((0.36, 0.12, 240), (0.18, 0.06, 230), (0.96, 0.02, 240)),
  'Family': _Palette((0.50, 0.13, 100), (0.20, 0.08, 110), (0.96, 0.02, 100)),
  'Fantasy': _Palette((0.42, 0.14, 320), (0.18, 0.08, 305), (0.96, 0.02, 320)),
  'History': _Palette((0.42, 0.10, 70), (0.16, 0.05, 55), (0.95, 0.04, 75)),
  'Horror': _Palette((0.30, 0.10, 15), (0.10, 0.04, 20), (0.94, 0.02, 20)),
  'Music': _Palette((0.46, 0.18, 320), (0.18, 0.10, 305), (0.96, 0.02, 320)),
  'Mystery': _Palette((0.32, 0.10, 95), (0.14, 0.06, 80), (0.95, 0.04, 90)),
  'Romance': _Palette((0.45, 0.15, 0), (0.20, 0.08, 350), (0.96, 0.02, 0)),
  'Sci-Fi': _Palette((0.38, 0.16, 285), (0.18, 0.10, 280), (0.96, 0.02, 285)),
  'Thriller': _Palette((0.32, 0.10, 200), (0.14, 0.04, 220), (0.96, 0.02, 220)),
  'War': _Palette((0.32, 0.06, 70), (0.14, 0.04, 60), (0.95, 0.02, 75)),
  'Western': _Palette((0.45, 0.12, 55), (0.18, 0.08, 35), (0.96, 0.04, 60)),
};

/// The genres shown, in order, ported 1:1 from the web `TILES`.
const List<String> _kGenreTiles = [
  'Action',
  'Adventure',
  'Thriller',
  'Crime',
  'Drama',
  'Romance',
  'Mystery',
  'Sci-Fi',
  'Fantasy',
  'Horror',
  'Comedy',
  'Family',
  'Animation',
  'Western',
  'War',
  'History',
  'Documentary',
  'Music',
];

const double _kTileWidth = 210;
const double _kTileHeight = 168; // 5:4

Color _c(_Oklch v, {double alpha = 1}) =>
    oklchToColor(v.$1, v.$2, v.$3, alpha: (alpha * 255).round());

/// Three popular backdrops for a genre's collage, from TMDB discover. Empty
/// without a key.
final _genreSampleProvider = FutureProvider.family<List<MetaPreview>, String>((
  ref,
  genre,
) async {
  final client = ref.watch(tmdbClientProvider);
  final id = kMovieGenres[genre];
  if (!client.hasKey || id == null) return const [];
  try {
    final list = await client.discover('movie', {
      'with_genres': '$id',
      'vote_count.gte': '500',
      'sort_by': 'popularity.desc',
      'page': '1',
    });
    return [
      for (final m in list)
        if (m.background != null) m,
    ].take(3).toList();
  } catch (_) {
    return const [];
  }
});

/// The "Browse by Genre" tiles — a horizontal rail of gradient genre tiles that
/// open the genre browse. Ported 1:1 from the web `GenreTiles`.
class GenreTiles extends ConsumerWidget {
  const GenreTiles({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 4, g, 10),
          child: Text(
            tr.t('Browse by Genre'),
            style: TextStyle(
              color: t.ink,
              fontSize: scaledRowTitle(
                20,
                ref.watch(settingsProvider).getDouble('rowTitleScale'),
              ),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: _kTileHeight,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: _kGenreTiles.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) =>
                  _GenreTile(genre: _kGenreTiles[i], tokens: t),
            ),
          ),
        ),
      ],
    );
  }
}

class _GenreTile extends ConsumerWidget {
  const _GenreTile({required this.genre, required this.tokens});

  final String genre;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tr = ref.watch(translationsProvider);
    final palette = _kPalette[genre] ?? _kPalette['Drama']!;
    final from = _c(palette.from);
    final to = _c(palette.to);
    final ink = _c(palette.ink);
    final backdrops = ref.watch(_genreSampleProvider(genre)).value ?? const [];
    final id = kMovieGenres[genre];

    return Focusable(
      tokens: tokens,
      borderRadius: 16,
      onPressed: id == null
          ? () {}
          : () => ref
                .read(navControllerProvider.notifier)
                .push(
                  Frame(
                    FrameKind.filter,
                    GenreFilter('movie', genre, id).toArgs(),
                  ),
                ),
      child: SizedBox(
        width: _kTileWidth,
        height: _kTileHeight,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: tokens.edgeSoft),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                      colors: [from, to],
                    ),
                  ),
                ),
                TileCollage(backdrops: backdrops, tileWidth: _kTileWidth),
                // The palette tint over the collage (approximates the web's
                // multiply blend of the gradient over the backdrops).
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                      colors: [
                        _c(palette.from, alpha: backdrops.isEmpty ? 1 : 0.55),
                        _c(palette.to, alpha: backdrops.isEmpty ? 1 : 0.85),
                      ],
                    ),
                  ),
                ),
                // Bottom fade into the `to` colour.
                Align(
                  alignment: Alignment.bottomCenter,
                  child: FractionallySizedBox(
                    heightFactor: 0.4,
                    widthFactor: 1,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [to.withValues(alpha: 0), to],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 18,
                  right: 18,
                  bottom: 16,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          tr.tOr('genre.$genre', genre),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: ink,
                            fontSize: 24,
                            height: 1.05,
                            fontWeight: FontWeight.w500,
                            letterSpacing: -0.3,
                            shadows: const [
                              Shadow(color: Color(0x66000000), blurRadius: 18),
                            ],
                          ),
                        ),
                      ),
                      Icon(Icons.chevron_right, color: ink, size: 20),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
