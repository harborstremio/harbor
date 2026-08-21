import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// The rainbow progress fill (`seekBarStyle == 'rainbow'`), byte-identical to the
/// web `RAINBOW_BG` six-band vertical gradient.
const LinearGradient _kRainbowFill = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [
    Color(0xFFFF595E), Color(0xFFFF595E), //
    Color(0xFFFF924C), Color(0xFFFF924C), //
    Color(0xFFFFCA3A), Color(0xFFFFCA3A), //
    Color(0xFF8AC926), Color(0xFF8AC926), //
    Color(0xFF1982C4), Color(0xFF1982C4), //
    Color(0xFF6A4C93), Color(0xFF6A4C93), //
  ],
  stops: [
    0.0, 0.1667, //
    0.1667, 0.3333, //
    0.3333, 0.5, //
    0.5, 0.6667, //
    0.6667, 0.8333, //
    0.8333, 1.0, //
  ],
);

/// The glass sheen overlaid on the accent fill (`seekBarStyle == 'glass'`),
/// matching the web `GLASS_BG` (white→dark vertical gradient, overlay blend).
const LinearGradient _kGlassOverlay = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Color(0x47FFFFFF), Color(0x0AFFFFFF), Color(0x2E000000)],
  stops: [0.0, 0.5, 1.0],
);

/// The player scrub bar: a track + buffered + progress fill with a draggable
/// thumb. Touch users can tap or drag anywhere along it to seek (the D-pad /
/// remote seek path is unaffected — it drives the same [onSeek]). While dragging
/// the fill follows the finger and [onScrub] reports the previewed second (null
/// when the drag ends), so the time label can track it.
class PlayerSeekBar extends StatefulWidget {
  const PlayerSeekBar({
    super.key,
    required this.position,
    required this.buffered,
    required this.durationSec,
    required this.accent,
    required this.onSeek,
    this.onScrub,
    this.barHeight = 6,
    this.fillEnabled = true,
    this.fillOpacity = 0.35,
    this.dotShape = 'circle',
    this.dotSize = 16,
    this.dotImage,
    this.barStyle = 'flat',
    this.barImage,
  });

  final ValueListenable<double> position;
  final ValueListenable<double> buffered;
  final double durationSec;
  final Color accent;
  final void Function(double seconds) onSeek;
  final void Function(double? seconds)? onScrub;

  /// The scrub-bar track height, `seekBarHeight` (3–14px).
  final double barHeight;

  /// Whether the buffered-ahead fill is drawn (`seekBarFill`).
  final bool fillEnabled;

  /// The buffered-fill brightness, `seekBarFillOpacity` (0.05–1.0).
  final double fillOpacity;

  /// The scrub thumb shape, `seekDotShape`: `circle` | `square` | `image` |
  /// `hidden`. Ported from `seek-bar-visual`'s `SeekDot`.
  final String dotShape;

  /// The scrub thumb diameter, `seekDotSize` (clamped 8–64, or 8–200 for an
  /// image thumb); it grows by 4px while scrubbing.
  final double dotSize;

  /// The custom thumb image URL for `dotShape == 'image'` (`seekDotImage`).
  final String? dotImage;

  /// The progress-fill style, `seekBarStyle`: `flat` | `rainbow` | `glass` |
  /// `pinstripe` | `image`. Ported from `seek-bar-visual`.
  final String barStyle;

  /// The tiled fill image URL for `barStyle == 'image'` (`seekBarImage`).
  final String? barImage;

  /// The fraction [0, 1] a horizontal offset [dx] maps to across [width].
  static double fracFromDx(double dx, double width) =>
      width <= 0 ? 0 : (dx / width).clamp(0.0, 1.0);

  @override
  State<PlayerSeekBar> createState() => _PlayerSeekBarState();
}

class _PlayerSeekBarState extends State<PlayerSeekBar>
    with SingleTickerProviderStateMixin {
  double? _dragFrac;

  /// Drives the pinstripe (barberpole) scroll; created only for that style so
  /// the default flat bar has no running ticker.
  AnimationController? _barberpole;

  @override
  void initState() {
    super.initState();
    _syncBarberpole();
  }

  @override
  void didUpdateWidget(PlayerSeekBar old) {
    super.didUpdateWidget(old);
    if (old.barStyle != widget.barStyle) _syncBarberpole();
  }

  void _syncBarberpole() {
    final want = widget.barStyle == 'pinstripe';
    if (want && _barberpole == null) {
      _barberpole = AnimationController(
        vsync: this,
        duration: const Duration(seconds: 1),
      )..repeat();
    } else if (!want && _barberpole != null) {
      _barberpole!.dispose();
      _barberpole = null;
    }
  }

  @override
  void dispose() {
    _barberpole?.dispose();
    super.dispose();
  }

  double get _dur => widget.durationSec;

  void _seekToDx(double dx, double width) {
    if (_dur <= 0) return;
    widget.onSeek(PlayerSeekBar.fracFromDx(dx, width) * _dur);
  }

  void _drag(double dx, double width) {
    if (_dur <= 0) return;
    final frac = PlayerSeekBar.fracFromDx(dx, width);
    setState(() => _dragFrac = frac);
    widget.onScrub?.call(frac * _dur);
  }

  void _endDrag() {
    final frac = _dragFrac;
    if (frac != null && _dur > 0) widget.onSeek(frac * _dur);
    setState(() => _dragFrac = null);
    widget.onScrub?.call(null);
  }

  /// The largest thumb size for the shape (`seek-bar-visual` `dotMax`).
  double get _dotMax => widget.dotShape == 'image' ? 200 : 64;

  /// The resting thumb diameter, clamped to the shape's range.
  double get _baseDot => widget.dotSize.clamp(8.0, _dotMax);

  bool get _hasDotImage =>
      widget.dotShape == 'image' &&
      widget.dotImage != null &&
      widget.dotImage!.isNotEmpty;

  bool get _hasBarImage =>
      widget.barStyle == 'image' &&
      widget.barImage != null &&
      widget.barImage!.isNotEmpty;

  /// The thumb colour: white over a rainbow/image fill (web `dotColor`), else
  /// the accent.
  Color get _dotColor => (widget.barStyle == 'rainbow' || _hasBarImage)
      ? Colors.white
      : widget.accent;

  /// The scrub thumb at [size] px — an image, a rounded square, or a circle,
  /// matching the web `SeekDot`. Returns nothing for the `hidden` shape.
  Widget _thumb(double size, ImageProvider? image) {
    if (widget.dotShape == 'hidden') return const SizedBox.shrink();
    if (image != null) {
      return Image(
        image: image,
        width: size,
        height: size,
        fit: BoxFit.contain,
      );
    }
    // `square` uses a 20%-radius rounded square; everything else is a circle.
    final radius = widget.dotShape == 'square' ? size * 0.2 : size / 2;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: _dotColor,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 4)],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Resolve the thumb image once per rebuild (not per playback frame); the
    // ImageCache keys it by URL so it is not re-fetched.
    final ImageProvider? dotImage = _hasDotImage
        ? NetworkImage(widget.dotImage!)
        : null;
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (d) => _seekToDx(d.localPosition.dx, width),
          onHorizontalDragStart: (d) => _drag(d.localPosition.dx, width),
          onHorizontalDragUpdate: (d) => _drag(d.localPosition.dx, width),
          onHorizontalDragEnd: (_) => _endDrag(),
          onHorizontalDragCancel: _endDrag,
          child: SizedBox(
            height: 24,
            width: width,
            child: ValueListenableBuilder<double>(
              valueListenable: widget.position,
              builder: (context, pos, _) {
                final liveFrac = _dur > 0 ? (pos / _dur).clamp(0.0, 1.0) : 0.0;
                final frac = _dragFrac ?? liveFrac;
                return ValueListenableBuilder<double>(
                  valueListenable: widget.buffered,
                  builder: (context, buf, _) {
                    final bufFrac = _dur > 0
                        ? (buf / _dur).clamp(0.0, 1.0)
                        : 0.0;
                    // The track thickens by 2px while scrubbing (web parity),
                    // and every bar is a pill (rounded-full = half its height).
                    final trackH = _dragFrac != null
                        ? widget.barHeight + 2
                        : widget.barHeight;
                    final radius = trackH / 2;
                    return Stack(
                      alignment: Alignment.centerLeft,
                      children: [
                        Center(
                          child: SizedBox(
                            height: trackH,
                            child: Stack(
                              children: [
                                _bar(1, const Color(0x33FFFFFF), radius),
                                if (widget.fillEnabled)
                                  _bar(
                                    bufFrac,
                                    Colors.white.withValues(
                                      alpha: widget.fillOpacity,
                                    ),
                                    radius,
                                  ),
                                _progressFill(frac, radius),
                              ],
                            ),
                          ),
                        ),
                        if (widget.dotShape != 'hidden')
                          Builder(
                            builder: (context) {
                              // Grow the thumb by 4px while scrubbing (web parity).
                              final size = _dragFrac != null
                                  ? _baseDot + 4
                                  : _baseDot;
                              return Positioned(
                                left: (frac * width - size / 2).clamp(
                                  0.0,
                                  (width - size).clamp(0.0, width),
                                ),
                                child: _thumb(size, dotImage),
                              );
                            },
                          ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
        );
      },
    );
  }

  Widget _bar(double frac, Color color, double radius) => FractionallySizedBox(
    widthFactor: frac,
    alignment: Alignment.centerLeft,
    child: DecoratedBox(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
      ),
    ),
  );

  /// The progress fill styled by `seekBarStyle`, ported from `seek-bar-visual`.
  Widget _progressFill(double frac, double radius) => FractionallySizedBox(
    widthFactor: frac,
    alignment: Alignment.centerLeft,
    child: ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: _fillContent(),
    ),
  );

  Widget _fillContent() {
    switch (widget.barStyle) {
      case 'rainbow':
        return const DecoratedBox(
          decoration: BoxDecoration(gradient: _kRainbowFill),
        );
      case 'image':
        if (_hasBarImage) {
          return DecoratedBox(
            decoration: BoxDecoration(
              // Keep the accent behind the image so a broken/loading URL still
              // shows the fill rather than a gap.
              color: widget.accent,
              image: DecorationImage(
                image: NetworkImage(widget.barImage!),
                repeat: ImageRepeat.repeat,
                fit: BoxFit.fitHeight,
                onError: (_, _) {},
              ),
            ),
          );
        }
        return ColoredBox(color: widget.accent);
      case 'glass':
        return Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: widget.accent),
            // `overlay` blend of the glass sheen with the accent behind it.
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: _kGlassOverlay,
                backgroundBlendMode: BlendMode.overlay,
              ),
            ),
          ],
        );
      case 'pinstripe':
        return Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: widget.accent),
            if (_barberpole != null)
              AnimatedBuilder(
                animation: _barberpole!,
                builder: (context, _) => CustomPaint(
                  painter: _BarberpolePainter(phase: _barberpole!.value),
                ),
              ),
          ],
        );
      default: // flat
        return ColoredBox(color: widget.accent);
    }
  }
}

/// Paints the animated barberpole (`.harbor-barberpole`): a 135° repeating
/// stripe pattern (0.28 / transparent / 0.14 / transparent over a 16px period)
/// that scrolls one period as [phase] runs 0→1.
class _BarberpolePainter extends CustomPainter {
  _BarberpolePainter({required this.phase});

  final double phase;

  @override
  void paint(Canvas canvas, Size size) {
    const period = 16.0;
    final dir = Offset(
      math.cos(math.pi * 0.75),
      math.sin(math.pi * 0.75),
    ); // 135°
    final origin = dir * (phase * period);
    final shader = ui.Gradient.linear(
      origin,
      origin + dir * period,
      const [
        Color(0x47000000), Color(0x47000000), // 0.28α, 0–4px
        Color(0x00000000), Color(0x00000000), // transparent, 4–8px
        Color(0x24000000), Color(0x24000000), // 0.14α, 8–12px
        Color(0x00000000), Color(0x00000000), // transparent, 12–16px
      ],
      const [0.0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1.0],
      TileMode.repeated,
    );
    canvas.drawRect(Offset.zero & size, Paint()..shader = shader);
  }

  @override
  bool shouldRepaint(_BarberpolePainter old) => old.phase != phase;
}
