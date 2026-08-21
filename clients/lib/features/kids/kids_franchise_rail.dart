import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart' show scaledRowTitle;
import '../../design/kids/kids_gradient.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/kids_franchises.dart';
import '../../domain/nav/frame.dart';

const double _kTileWidth = 232;
const double _kTileHeight = 145; // 16:10 landscape

/// The "Pick a World" franchise rail — a horizontal row of gradient tiles, each
/// opening its franchise world grid. Ported 1:1 from `KidsFranchiseRail`; hidden
/// without a TMDB key (its grids are TMDB-backed).
class KidsFranchiseRail extends ConsumerWidget {
  const KidsFranchiseRail({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final settings = ref.watch(settingsProvider);
    if (settings.tmdbKey.isEmpty) return const SizedBox.shrink();
    // Match the sibling kids rows' idiom gutter (16 phone / 48 tablet-tv) so the
    // rail lines up instead of over-indenting on a phone.
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 4, g, 10),
          child: Text(
            'Pick a World',
            style: TextStyle(
              color: t.ink,
              fontSize: scaledRowTitle(20, settings.getDouble('rowTitleScale')),
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
              itemCount: kKidsFranchises.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) =>
                  _FranchiseTile(franchise: kKidsFranchises[i], tokens: t),
            ),
          ),
        ),
      ],
    );
  }
}

class _FranchiseTile extends ConsumerWidget {
  const _FranchiseTile({required this.franchise, required this.tokens});

  final Franchise franchise;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final grad = kidsGradient(franchise.grad);
    final drop = franchise.drop;
    return Focusable(
      tokens: tokens,
      borderRadius: 24,
      onPressed: () => ref
          .read(navControllerProvider.notifier)
          .push(Frame(FrameKind.kidsFranchise, {'key': franchise.key})),
      child: SizedBox(
        width: _kTileWidth,
        height: _kTileHeight,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [
              BoxShadow(
                color: Color(0x59142838),
                blurRadius: 34,
                offset: Offset(0, 14),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (grad != null)
                  DecoratedBox(decoration: BoxDecoration(gradient: grad)),
                // Soft white glows (approximating the web's blurred circles).
                _glow(top: -48, right: -40, size: 128, opacity: 0.25),
                _glow(bottom: -40, left: -24, size: 96, opacity: 0.15),
                // Character art, overflowing the top, clipped to the tile.
                Positioned(
                  right: 0,
                  bottom: drop != null ? -(drop / 100 * _kTileHeight) : 0,
                  width: _kTileWidth * 0.8,
                  height: _kTileHeight * 1.22,
                  child: Image.asset(
                    'assets/kids/cta/${franchise.key}.webp',
                    fit: BoxFit.contain,
                    alignment: Alignment.bottomRight,
                  ),
                ),
                // Left-to-right darkening for the label.
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      colors: [
                        Color(0x73000000),
                        Color(0x1A000000),
                        Color(0x00000000),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: 14,
                  right: 14,
                  bottom: 12,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        franchise.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 19,
                          height: 1.05,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.3,
                          shadows: [
                            Shadow(color: Color(0x80000000), blurRadius: 8),
                          ],
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Text(
                            'Explore',
                            style: TextStyle(
                              color: Color(0xE6FFFFFF),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          SizedBox(width: 3),
                          Icon(
                            Icons.arrow_forward,
                            size: 12,
                            color: Color(0xE6FFFFFF),
                          ),
                        ],
                      ),
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

  Widget _glow({
    double? top,
    double? bottom,
    double? left,
    double? right,
    required double size,
    required double opacity,
  }) {
    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              Colors.white.withValues(alpha: opacity),
              Colors.white.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}
