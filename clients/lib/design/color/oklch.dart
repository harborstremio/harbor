import 'dart:math' as math;

import 'package:flutter/painting.dart';

/// Converts an oklch colour to an sRGB [Color] using Björn Ottosson's oklab
/// matrices and the sRGB transfer function — the exact colour a browser renders
/// for a CSS/Tailwind `oklch()` value. [l] is lightness 0..1, [c] the chroma,
/// and [hDeg] the hue in degrees.
Color oklchToColor(double l, double c, double hDeg, {int alpha = 255}) {
  final h = hDeg * math.pi / 180.0;
  final a = c * math.cos(h);
  final b = c * math.sin(h);

  final lp = l + 0.3963377774 * a + 0.2158037573 * b;
  final mp = l - 0.1055613458 * a - 0.0638541728 * b;
  final sp = l - 0.0894841775 * a - 1.2914855480 * b;

  final lc = lp * lp * lp;
  final mc = mp * mp * mp;
  final sc = sp * sp * sp;

  final rLin = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  final gLin = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  final bLin = -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc;

  int channel(double lin) {
    final v = lin <= 0.0031308
        ? 12.92 * lin
        : 1.055 * math.pow(lin, 1 / 2.4) - 0.055;
    return (v.clamp(0.0, 1.0) * 255.0).round();
  }

  return Color.fromARGB(alpha, channel(rLin), channel(gLin), channel(bLin));
}

double _cbrt(double x) =>
    x < 0 ? -math.pow(-x, 1 / 3).toDouble() : math.pow(x, 1 / 3).toDouble();

/// The inverse of [oklchToColor]: an sRGB [color]'s oklch `(L, C, H)` (H in
/// degrees). Used to derive palette variants that keep a colour's hue/chroma —
/// the native form of CSS's `oklch(from <color> …)` relative syntax.
(double l, double c, double h) colorToOklch(Color color) {
  double toLinear(double s) =>
      s <= 0.04045 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
  final r = toLinear(color.r);
  final g = toLinear(color.g);
  final b = toLinear(color.b);

  final lp = _cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  final mp = _cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  final sp = _cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  final okL = 0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp;
  final okA = 1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp;
  final okB = 0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp;

  final c = math.sqrt(okA * okA + okB * okB);
  var h = math.atan2(okB, okA) * 180 / math.pi;
  if (h < 0) h += 360;
  return (okL, c, h);
}
