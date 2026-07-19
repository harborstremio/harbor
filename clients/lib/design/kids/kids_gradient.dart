import 'package:flutter/painting.dart';

import '../color/oklch.dart';

export '../color/oklch.dart' show oklchToColor;

/// The Tailwind v4 palette tokens used by the Kids franchise gradients, as
/// `(L, C, H)` oklch triples read from the built stylesheet's `--color-*`
/// variables. Resolved to sRGB on demand so the tiles render the exact web
/// colours.
const Map<String, (double, double, double)> _kTailwind = {
  'amber-300': (0.879, 0.169, 91.605),
  'amber-400': (0.828, 0.189, 84.429),
  'blue-400': (0.707, 0.165, 254.624),
  'blue-500': (0.623, 0.214, 259.815),
  'blue-600': (0.546, 0.245, 262.881),
  'cyan-300': (0.865, 0.127, 207.078),
  'cyan-600': (0.609, 0.126, 221.723),
  'emerald-500': (0.696, 0.17, 162.48),
  'emerald-700': (0.508, 0.118, 165.612),
  'fuchsia-500': (0.667, 0.295, 322.15),
  'green-500': (0.723, 0.219, 149.579),
  'green-600': (0.627, 0.194, 149.214),
  'indigo-400': (0.673, 0.182, 276.935),
  'lime-500': (0.768, 0.233, 130.85),
  'orange-500': (0.705, 0.213, 47.604),
  'purple-700': (0.496, 0.265, 301.924),
  'red-500': (0.637, 0.237, 25.331),
  'red-600': (0.577, 0.245, 27.325),
  'rose-500': (0.645, 0.246, 16.439),
  'sky-300': (0.828, 0.111, 230.318),
  'sky-400': (0.746, 0.16, 232.661),
  'teal-500': (0.704, 0.14, 182.503),
  'violet-600': (0.541, 0.281, 293.009),
  'yellow-300': (0.905, 0.182, 98.111),
  'yellow-400': (0.852, 0.199, 91.936),
};

/// Resolves a Tailwind palette token (e.g. `sky-400`) to its sRGB [Color], or
/// null if the token is not in the Kids palette.
Color? tailwindColor(String token) {
  final v = _kTailwind[token];
  return v == null ? null : oklchToColor(v.$1, v.$2, v.$3);
}

/// Parses a Tailwind `bg-gradient-to-br` descriptor like
/// `from-sky-400 via-sky-300 to-amber-300` into the top-left→bottom-right
/// [LinearGradient] the franchise tile paints. Returns null when the `from`/`to`
/// stops cannot be resolved (so callers can fall back visibly, never silently).
LinearGradient? kidsGradient(String grad) {
  String? from;
  String? via;
  String? to;
  for (final part in grad.split(RegExp(r'\s+'))) {
    if (part.startsWith('from-')) {
      from = part.substring(5);
    } else if (part.startsWith('via-')) {
      via = part.substring(4);
    } else if (part.startsWith('to-')) {
      to = part.substring(3);
    }
  }
  final fromColor = from == null ? null : tailwindColor(from);
  final toColor = to == null ? null : tailwindColor(to);
  if (fromColor == null || toColor == null) return null;
  final viaColor = via == null ? null : tailwindColor(via);
  return LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [fromColor, ?viaColor, toColor],
    stops: viaColor != null ? const [0.0, 0.5, 1.0] : const [0.0, 1.0],
  );
}
