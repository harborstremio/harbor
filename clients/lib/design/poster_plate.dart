import 'package:flutter/widgets.dart';

import 'color/oklch.dart';

/// The hue (0–359°) for a poster plate derived from [seed] — a stable,
/// well-distributed value so each list/title gets a consistent colour. Ports
/// the web `hash(seed) % 360` (a `(h << 5) - h + charCode` 32-bit string hash).
int posterPlateHue(String seed) => _hash(seed) % 360;

int _hash(String seed) {
  var h = 0;
  for (var i = 0; i < seed.length; i++) {
    h = _toInt32(_toInt32(h) << 5) - h + seed.codeUnitAt(i);
  }
  return h.abs();
}

/// Emulates JS `ToInt32` (32-bit signed wraparound) so the hash matches the web.
int _toInt32(int v) {
  final masked = v & 0xFFFFFFFF;
  return masked >= 0x80000000 ? masked - 0x100000000 : masked;
}

/// A deterministic, seed-tinted gradient plate — the native equivalent of the
/// web `posterPlate(seed)` CSS background (two oklch radial blobs over a
/// diagonal oklch base). Fills its parent; renders [child] on top. Used as the
/// artwork-less fallback for posters and list covers.
class PosterPlate extends StatelessWidget {
  const PosterPlate({super.key, required this.seed, this.child});

  final String seed;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final hue = posterPlateHue(seed).toDouble();
    final a = hue;
    final b = (hue + 140) % 360;
    final c = (hue + 60) % 360;

    Color blob(double l, double chroma, double h) => oklchToColor(l, chroma, h);

    return Stack(
      fit: StackFit.expand,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [blob(0.20, 0.05, c), blob(0.10, 0.02, b)],
            ),
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(-0.5, -0.4),
              radius: 1.0,
              colors: [
                blob(0.45, 0.14, a),
                blob(0.45, 0.14, a).withValues(alpha: 0),
              ],
              stops: const [0.0, 0.55],
            ),
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0.5, 0.5),
              radius: 1.0,
              colors: [
                blob(0.32, 0.10, b),
                blob(0.32, 0.10, b).withValues(alpha: 0),
              ],
              stops: const [0.0, 0.55],
            ),
          ),
        ),
        ?child,
      ],
    );
  }
}
