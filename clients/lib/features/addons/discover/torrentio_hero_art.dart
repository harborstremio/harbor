import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/tokens.dart';

/// The number of poster tiles in the Torrentio hero mosaic (`POSTER_SLOTS`).
const int _posterSlots = 18;

// Saturate the poster tiles to 0.7, matching `saturate-[0.7]` (luminance
// weights 0.2126/0.7152/0.0722, amount 0.7).
const ColorFilter _saturate = ColorFilter.matrix(<double>[
  0.76378, 0.21456, 0.021666, 0, 0, //
  0.06378, 0.91456, 0.021666, 0, 0, //
  0.06378, 0.21456, 0.721666, 0, 0, //
  0, 0, 0, 1, 0, //
]);

// Reduce contrast to 0.9, matching `contrast-[0.9]` ((in - 0.5) * 0.9 + 0.5).
const ColorFilter _contrast = ColorFilter.matrix(<double>[
  0.9, 0, 0, 0, 12.75, //
  0, 0.9, 0, 0, 12.75, //
  0, 0, 0.9, 0, 12.75, //
  0, 0, 0, 1, 0, //
]);

/// The Torrentio hero backdrop: a masked six-column poster mosaic behind a
/// surface wash, with the Torrentio badge glowing at the trailing edge. Ported
/// 1:1 from `TorrentioHeroArt`.
class TorrentioHeroArt extends ConsumerWidget {
  const TorrentioHeroArt({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final posters = ref.watch(cinemetaPostersProvider).value ?? const [];
    final tiles = posters.take(_posterSlots).toList();

    return Stack(
      fit: StackFit.expand,
      children: [
        if (tiles.isNotEmpty)
          Positioned(
            top: -24,
            bottom: -24,
            left: 0,
            right: 0,
            child: Opacity(
              opacity: 0.35,
              child: ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (rect) => const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    Color(0x00000000),
                    Color(0x26000000),
                    Color(0xA6000000),
                    Color(0xFF000000),
                  ],
                  stops: [0.0, 0.3, 0.65, 1.0],
                ).createShader(rect),
                child: _mosaic(t, tiles),
              ),
            ),
          ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  t.surface,
                  t.surface.withValues(alpha: 0.75),
                  t.surface.withValues(alpha: 0.35),
                ],
                stops: const [0.0, 0.45, 1.0],
              ),
            ),
          ),
        ),
        // The logo badge sits in the upper-right and scales to the art region so
        // it never crowds the title/subtitle on a narrow (tablet) featured card
        // — on a wide desktop card it grows back toward the source's 164px.
        Positioned.fill(
          child: LayoutBuilder(
            builder: (context, c) {
              final size = (c.maxWidth * 0.34).clamp(76.0, 150.0);
              return Align(
                alignment: const Alignment(0.88, -0.6),
                child: _badge(t, size),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _mosaic(HarborTokens t, List<String> tiles) {
    Widget cell(int i) {
      if (i >= tiles.length) return const SizedBox.shrink();
      return ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: ColorFiltered(
          colorFilter: _contrast,
          child: ColorFiltered(
            colorFilter: _saturate,
            child: CachedNetworkImage(
              imageUrl: tiles[i],
              fit: BoxFit.cover,
              fadeInDuration: const Duration(milliseconds: 200),
              errorWidget: (_, _, _) =>
                  ColoredBox(color: t.elevated.withValues(alpha: 0.3)),
              placeholder: (_, _) =>
                  ColoredBox(color: t.elevated.withValues(alpha: 0.3)),
            ),
          ),
        ),
      );
    }

    const cols = 6;
    final rowCount = (_posterSlots / cols).ceil();
    return Column(
      children: [
        for (var r = 0; r < rowCount; r++) ...[
          if (r > 0) const SizedBox(height: 6),
          Expanded(
            child: Row(
              children: [
                for (var c = 0; c < cols; c++) ...[
                  if (c > 0) const SizedBox(width: 6),
                  Expanded(child: cell(r * cols + c)),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _badge(HarborTokens t, double size) {
    final logo = size * 0.73;
    return SizedBox(
      width: size * 1.4,
      height: size * 1.4,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Opacity(
            opacity: 0.7,
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  radius: 0.72,
                  colors: [t.accent.withValues(alpha: 0.4), Colors.transparent],
                ),
              ),
            ),
          ),
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: t.canvas.withValues(alpha: 0.95),
              borderRadius: BorderRadius.circular(size * 0.22),
              border: Border.all(color: t.accent.withValues(alpha: 0.35)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0xF2000000),
                  blurRadius: 60,
                  spreadRadius: -16,
                  offset: Offset(0, 24),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: Image.asset(
              'assets/addon_logos/torrentio.png',
              width: logo,
              height: logo,
              fit: BoxFit.contain,
            ),
          ),
        ],
      ),
    );
  }
}
