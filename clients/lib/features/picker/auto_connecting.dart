import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';

/// The instant-play connecting screen: a full-screen overlay shown while the
/// auto-fired source resolves — a blurred backdrop, the title, a branded pulse
/// animation, a "Connecting" status, and a Back-to-sources escape. Ports the
/// web `AutoPlayTransition` (the non-kid theme).
class AutoConnecting extends StatefulWidget {
  const AutoConnecting({
    super.key,
    required this.tokens,
    required this.title,
    required this.onCancel,
    this.season,
    this.episode,
    this.backdrop,
    this.status = 'Connecting',
  });

  final HarborTokens tokens;
  final String title;
  final int? season;
  final int? episode;
  final String? backdrop;

  /// The status line under the title (e.g. "Connecting").
  final String status;
  final VoidCallback onCancel;

  @override
  State<AutoConnecting> createState() => _AutoConnectingState();
}

class _AutoConnectingState extends State<AutoConnecting>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final ep = (widget.season != null && widget.episode != null)
        ? 'S${widget.season}  ·  E${widget.episode}'
        : null;
    return ColoredBox(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (widget.backdrop != null)
            ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
              child: CachedNetworkImage(
                imageUrl: widget.backdrop!,
                fit: BoxFit.cover,
                color: Colors.black.withValues(alpha: 0.6),
                colorBlendMode: BlendMode.darken,
                errorWidget: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.65),
                  Colors.black.withValues(alpha: 0.55),
                  Colors.black.withValues(alpha: 0.85),
                ],
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _BrandPulse(pulse: _pulse, accent: t.accent),
                const SizedBox(height: 32),
                if (ep != null) ...[
                  Text(
                    ep,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.6),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: Text(
                    widget.title,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      height: 1.1,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  widget.status.toUpperCase(),
                  style: TextStyle(
                    color: t.accent,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 3,
                  ),
                ),
                const SizedBox(height: 40),
                Focusable(
                  tokens: t,
                  borderRadius: 999,
                  // The only control on this splash — land the TV remote on it
                  // so Select can cancel back to the source list.
                  autofocus: true,
                  onPressed: widget.onCancel,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 11,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.15),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.arrow_back,
                          size: 16,
                          color: Colors.white70,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Back to sources',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The branded connecting animation: three concentric accent rings that pulse
/// outward, evoking a signal locking on.
class _BrandPulse extends StatelessWidget {
  const _BrandPulse({required this.pulse, required this.accent});

  final Animation<double> pulse;
  final Color accent;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 96,
    height: 96,
    child: AnimatedBuilder(
      animation: pulse,
      builder: (context, _) {
        return Stack(
          alignment: Alignment.center,
          children: [
            for (var i = 0; i < 3; i++) _ring(((pulse.value + i / 3) % 1.0)),
            Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
            ),
          ],
        );
      },
    ),
  );

  Widget _ring(double p) {
    final size = 24 + p * 72;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: accent.withValues(alpha: (1 - p) * 0.6),
          width: 2,
        ),
      ),
    );
  }
}
