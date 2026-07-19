import 'package:flutter/material.dart';

import '../../design/tokens.dart';

/// The Anime4K activity badge — a floating pill shown while upscaling shaders
/// are running, fading with the player chrome. The native port of the web
/// `Anime4kIndicator`; clientv2 tracks the applied shader chain directly rather
/// than polling mpv's `glsl-shaders` property.
///
/// [active] is whether shaders are running (and the indicator is enabled on a
/// capable engine); [visible] fades it with the chrome (and suppresses it while
/// a top-anchored volume HUD is showing); [modeLabel] is the running mode id.
class Anime4kIndicator extends StatelessWidget {
  const Anime4kIndicator({
    super.key,
    required this.tokens,
    required this.active,
    required this.visible,
    this.modeLabel,
  });

  final HarborTokens tokens;
  final bool active;
  final bool visible;
  final String? modeLabel;

  @override
  Widget build(BuildContext context) {
    if (!active) return const SizedBox.shrink();
    final t = tokens;
    return IgnorePointer(
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: const Duration(milliseconds: 300),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.82),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.auto_awesome, size: 13, color: t.accent),
              const SizedBox(width: 6),
              Text(
                'Anime4K',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              if (modeLabel != null) ...[
                const SizedBox(width: 6),
                Text(
                  modeLabel!,
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
