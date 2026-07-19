import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../app/theme_controller.dart';
import '../../../design/layout/idiom.dart';
import '../../../design/tokens.dart';
import '../../../design/focus/focusable.dart';

typedef _Tile = ({
  String cat,
  String title,
  String blurb,
  Color from,
  Color to,
  String icon,
});

// The six category tiles, ported 1:1 from `CATEGORY_TILES` (Tailwind 500/600
// accents; the torrents tile reuses the sports glyph, as in the web).
const List<_Tile> _tiles = [
  (
    cat: 'http+streams',
    title: 'Streaming',
    blurb: 'Where your video comes from',
    from: Color(0xFFF59E0B),
    to: Color(0xFFEA580C),
    icon: 'streams',
  ),
  (
    cat: 'metadata',
    title: 'Catalogs',
    blurb: 'Posters, ratings, lists',
    from: Color(0xFF3B82F6),
    to: Color(0xFF4F46E5),
    icon: 'catalogs',
  ),
  (
    cat: 'subtitles',
    title: 'Subtitles',
    blurb: 'Captions in your language',
    from: Color(0xFF8B5CF6),
    to: Color(0xFFC026D3),
    icon: 'subtitles',
  ),
  (
    cat: 'anime',
    title: 'Anime',
    blurb: 'Kitsu, MAL, season-aware',
    from: Color(0xFFF43F5E),
    to: Color(0xFFDB2777),
    icon: 'anime',
  ),
  (
    cat: 'torrents',
    title: 'Torrents',
    blurb: 'P2P sources, debrid-ready',
    from: Color(0xFF10B981),
    to: Color(0xFF0D9488),
    icon: 'sports',
  ),
  (
    cat: 'live+tv',
    title: 'Live TV',
    blurb: 'OTA channels + IPTV',
    from: Color(0xFF06B6D4),
    to: Color(0xFF0284C7),
    icon: 'livetv',
  ),
];

/// The Discover "Browse by category" grid, ported 1:1 from `CategoryGrid`. Six
/// gradient tiles; tapping one filters the Browse catalog by that slug.
class CategoryGrid extends ConsumerWidget {
  const CategoryGrid({super.key, required this.onCategorySelect});

  final void Function(String cat) onCategorySelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    return Padding(
      padding: const EdgeInsets.only(bottom: 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 20),
            padding: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.7)),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Browse by category',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w500,
                    color: t.ink,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  "Six places to start. Tap one and we'll filter the catalog "
                  'for you.',
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.5,
                    color: t.inkMuted,
                  ),
                ),
              ],
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              final cols = gridColumnsFor(
                AddonGrid.categoryGrid,
                constraints.maxWidth,
              );
              // The grid caps at 3 columns, so on a 1080p TV each tile is very
              // wide; a taller tile keeps a card-like proportion instead of a
              // thin 120px band. Phone/tablet keep the compact 1:1 height.
              final tileHeight = Idiom.of(context).isTv ? 168.0 : 120.0;
              return Column(children: _rows(t, cols, tileHeight));
            },
          ),
        ],
      ),
    );
  }

  List<Widget> _rows(HarborTokens t, int cols, double tileHeight) {
    final rows = <Widget>[];
    for (var i = 0; i < _tiles.length; i += cols) {
      final rowTiles = _tiles.skip(i).take(cols).toList();
      rows.add(
        Row(
          children: [
            for (var j = 0; j < cols; j++) ...[
              if (j > 0) const SizedBox(width: 12),
              Expanded(
                child: j < rowTiles.length
                    ? _tile(t, rowTiles[j], tileHeight)
                    : const SizedBox.shrink(),
              ),
            ],
          ],
        ),
      );
      if (i + cols < _tiles.length) rows.add(const SizedBox(height: 12));
    }
    return rows;
  }

  Widget _tile(HarborTokens t, _Tile tile, double tileHeight) => Focusable(
    onPressed: () => onCategorySelect(tile.cat),
    tokens: t,
    borderRadius: 16,
    scale: 1.02,
    child: Container(
      height: tileHeight,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    tile.from.withValues(alpha: 0.4),
                    tile.to.withValues(alpha: 0.3),
                  ],
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    t.canvas.withValues(alpha: 0.85),
                    t.canvas.withValues(alpha: 0.3),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: 16,
            right: 16,
            child: Opacity(
              opacity: 0.55,
              child: SvgPicture.asset(
                'assets/category/${tile.icon}.svg',
                width: 56,
                height: 56,
              ),
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  tile.title,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w500,
                    color: t.ink,
                  ),
                ),
                Text(
                  tile.blurb,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: t.inkMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
