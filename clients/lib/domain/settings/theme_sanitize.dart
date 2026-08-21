/// Theme-settings validation, transcribed from `sanitizeTheme` in
/// `src/lib/settings/load.ts`. Guards a stored `theme` object against invalid
/// preset ids, font pairs, dim range, oversized background images, and malformed
/// custom colors — falling back to the documented defaults per field.
library;

final RegExp _hex = RegExp(r'^#[0-9a-f]{6}$', caseSensitive: false);

/// Built-in + bundled preset ids `isKnownPreset` accepts (THEME_PRESETS plus the
/// featured/template/beta themes).
const Set<String> kKnownPresetIds = {
  'cool-grey',
  'nord',
  'stremio',
  'crunch',
  'tokyo-night',
  'dracula',
  'forest',
  'noir',
  'aurora',
  'minui',
  'velvet',
  'elegantfin',
  'feishin',
};

const Set<String> kFontPairs = {
  'sentient-switzer',
  'fraunces-inter',
  'general-sans',
  'cabinet-switzer',
  'plex',
  'plus-jakarta',
  'system',
};

const List<String> _customColorKeys = [
  'canvas',
  'surface',
  'elevated',
  'raised',
  'ink',
  'inkMuted',
  'inkSubtle',
  'edge',
  'accent',
  'danger',
];

const Map<String, dynamic> kDefaultTheme = {
  'preset': 'cool-grey',
  'fontPair': 'sentient-switzer',
  'backgroundDim': 0.65,
  'backgroundImage': null,
  'customColors': null,
  'customFontId': null,
};

Map<String, dynamic>? _sanitizeCustomColors(Object? c) {
  if (c is! Map) return null;
  final out = <String, dynamic>{};
  for (final k in _customColorKeys) {
    final v = c[k];
    if (v is! String || !_hex.hasMatch(v)) return null;
    out[k] = v;
  }
  return out;
}

Map<String, dynamic> sanitizeTheme(Object? theme) {
  if (theme is! Map) return Map<String, dynamic>.from(kDefaultTheme);
  final t = theme;
  final preset = t['preset'];
  final isBuiltIn =
      preset is String &&
      preset != 'custom' &&
      kKnownPresetIds.contains(preset);
  final isUserPreset = preset is String && preset.startsWith('user:');
  final isPreset = isBuiltIn || isUserPreset;
  final isCustom = preset == 'custom';

  final fontPair = t['fontPair'];
  final fontOk = fontPair is String && kFontPairs.contains(fontPair);

  final dim = t['backgroundDim'];
  final dimOk = dim is num && dim >= 0 && dim <= 1;

  final img = t['backgroundImage'];
  final imgOk = img == null || (img is String && img.length < 3000000);

  final customColors = _sanitizeCustomColors(t['customColors']);

  final resolvedPreset = isPreset
      ? preset
      : (isCustom && customColors != null ? 'custom' : kDefaultTheme['preset']);

  return {
    'preset': resolvedPreset,
    'fontPair': fontOk ? fontPair : kDefaultTheme['fontPair'],
    'backgroundDim': dimOk ? dim : kDefaultTheme['backgroundDim'],
    'backgroundImage': imgOk ? img : null,
    'customColors': customColors,
    'customFontId': t['customFontId'] is String ? t['customFontId'] : null,
  };
}
