import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';

/// The faint logo wash behind an addon card, ported 1:1 from `CardArtBackdrop`:
/// the resolved [logoUrl] as a cover image at 0.1 opacity under a left-to-right
/// canvas-to-transparent gradient. Renders nothing when there is no logo. Place
/// it inside a `Stack` via `Positioned.fill`.
class CardArtBackdrop extends ConsumerWidget {
  const CardArtBackdrop({super.key, required this.logoUrl});

  /// A resolved (absolute) logo URL, or null.
  final String? logoUrl;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final url = logoUrl;
    if (url == null) return const SizedBox.shrink();
    final t = ref.watch(tokensProvider);
    return Stack(
      children: [
        Positioned.fill(
          child: Opacity(
            opacity: 0.1,
            child: CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              errorWidget: (_, _, _) => const SizedBox.shrink(),
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
                  t.canvas,
                  t.canvas,
                  t.canvas.withValues(alpha: 0.78),
                  t.canvas.withValues(alpha: 0.42),
                ],
                stops: const [0, 0.42, 0.68, 1],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
