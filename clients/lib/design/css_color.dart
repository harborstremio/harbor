import 'dart:math' as math;
import 'dart:ui';

/// Parses the CSS color syntaxes Harbor's theme tokens use — `#rgb`, `#rrggbb`,
/// `#rrggbbaa`, `rgb()/rgba()`, and `oklch()` — into a Flutter [Color].
///
/// OKLCH is resolved through the real OKLab → linear-sRGB → gamma pipeline so a
/// token like `oklch(0.78 0.13 60)` renders the same color the browser paints.
/// Returns `null` for anything it cannot parse (callers treat that as an error,
/// never a silent default).
Color? parseCssColor(String raw) {
  final s = raw.trim().toLowerCase();
  if (s.startsWith('#')) return _parseHex(s);
  if (s.startsWith('rgb')) return _parseRgb(s);
  if (s.startsWith('oklch')) return _parseOklch(s);
  return null;
}

Color? _parseHex(String s) {
  var h = s.substring(1);
  if (h.length == 3) {
    h = h.split('').map((c) => '$c$c').join();
  }
  int? value;
  if (h.length == 6) {
    value = int.tryParse('ff$h', radix: 16);
  } else if (h.length == 8) {
    // CSS is #rrggbbaa; Flutter's Color wants 0xaarrggbb.
    final rgb = h.substring(0, 6);
    final a = h.substring(6, 8);
    value = int.tryParse('$a$rgb', radix: 16);
  }
  return value == null ? null : Color(value);
}

Color? _parseRgb(String s) {
  final inside = s.substring(s.indexOf('(') + 1, s.lastIndexOf(')'));
  final parts = inside
      .split(RegExp(r'[,\s/]+'))
      .where((p) => p.isNotEmpty)
      .toList();
  if (parts.length < 3) return null;
  final r = int.tryParse(parts[0]);
  final g = int.tryParse(parts[1]);
  final b = int.tryParse(parts[2]);
  if (r == null || g == null || b == null) return null;
  var a = 1.0;
  if (parts.length >= 4) a = double.tryParse(parts[3]) ?? 1.0;
  return Color.fromARGB((a * 255).round(), r, g, b);
}

Color? _parseOklch(String s) {
  final inside = s.substring(s.indexOf('(') + 1, s.lastIndexOf(')'));
  final parts = inside
      .split(RegExp(r'[\s/]+'))
      .where((p) => p.isNotEmpty)
      .toList();
  if (parts.length < 3) return null;
  final l = _num(parts[0]);
  final c = _num(parts[1]);
  final h = _num(parts[2]);
  if (l == null || c == null || h == null) return null;
  var alpha = 1.0;
  if (parts.length >= 4) alpha = _num(parts[3]) ?? 1.0;
  return _oklchToColor(l, c, h, alpha);
}

double? _num(String p) {
  final t = p.trim();
  if (t.endsWith('%')) {
    final v = double.tryParse(t.substring(0, t.length - 1));
    return v == null ? null : v / 100.0;
  }
  return double.tryParse(t);
}

Color _oklchToColor(double l, double c, double hDeg, double alpha) {
  final h = hDeg * math.pi / 180.0;
  final a = c * math.cos(h);
  final b = c * math.sin(h);

  final l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  final m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  final s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  final lc = l_ * l_ * l_;
  final mc = m_ * m_ * m_;
  final sc = s_ * s_ * s_;

  final r = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  final g = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  final bl = -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc;

  return Color.fromARGB(
    (alpha.clamp(0.0, 1.0) * 255).round(),
    _encode(r),
    _encode(g),
    _encode(bl),
  );
}

int _encode(double linear) {
  final c = linear <= 0.0031308
      ? 12.92 * linear
      : 1.055 * math.pow(linear, 1 / 2.4) - 0.055;
  return (c.clamp(0.0, 1.0) * 255).round();
}
