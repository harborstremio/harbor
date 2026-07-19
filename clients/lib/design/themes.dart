import 'package:flutter/material.dart';

import 'tokens.dart';

/// A built-in Harbor theme preset. Token maps are the exact values from
/// `docs/20-settings-and-themes.md` §7.3. `hidden` presets (crunch) are not
/// offered in the picker but remain resolvable by id.
class ThemePreset {
  const ThemePreset({
    required this.id,
    required this.name,
    required this.css,
    this.hidden = false,
    this.backgroundGradient,
    this.blurb,
  });

  final String id;
  final String name;
  final Map<String, String> css;
  final bool hidden;
  final Gradient? backgroundGradient;

  /// A one-line description, shown on the featured-theme tiles (the built-in
  /// preset tiles show only the name, matching the original picker).
  final String? blurb;

  HarborTokens get tokens => HarborTokens.fromCss(css);
}

const String kDefaultThemeId = 'cool-grey';

/// The 8 built-in presets, in picker order.
const List<ThemePreset> kThemePresets = [
  ThemePreset(
    id: 'cool-grey',
    name: 'Harbor default',
    css: {
      'canvas': 'oklch(0.18 0.004 260)',
      'surface': 'oklch(0.22 0.004 260)',
      'elevated': 'oklch(0.27 0.004 260)',
      'raised': 'oklch(0.32 0.004 260)',
      'ink': 'oklch(0.97 0.003 260)',
      'inkMuted': 'oklch(0.72 0.003 260)',
      'inkSubtle': 'oklch(0.50 0.003 260)',
      'edge': 'oklch(0.36 0.004 260 / 0.55)',
      'edgeSoft': 'oklch(0.36 0.004 260 / 0.25)',
      'accent': 'oklch(0.78 0.13 60)',
      'accentSoft': 'oklch(0.78 0.13 60 / 0.18)',
      'danger': 'oklch(0.55 0.18 25)',
    },
  ),
  ThemePreset(
    id: 'nord',
    name: 'Nord',
    css: {
      'canvas': '#2e3440',
      'surface': '#353a47',
      'elevated': '#3b4252',
      'raised': '#434c5e',
      'ink': '#eceff4',
      'inkMuted': '#d8dee9',
      'inkSubtle': '#8b95a4',
      'edge': '#4c566a8c',
      'edgeSoft': '#4c566a40',
      'accent': '#88c0d0',
      'accentSoft': '#88c0d02e',
      'danger': '#bf616a',
    },
  ),
  ThemePreset(
    id: 'stremio',
    name: 'Stremio',
    backgroundGradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF0C0B11), Color(0xFF1A173E)],
    ),
    css: {
      'canvas': '#0c0b11',
      'surface': '#181434',
      'elevated': '#1f1b3f',
      'raised': '#2a2358',
      'ink': 'rgba(255,255,255,0.9)',
      'inkMuted': 'rgba(255,255,255,0.6)',
      'inkSubtle': 'rgba(255,255,255,0.35)',
      'edge': 'rgba(255,255,255,0.14)',
      'edgeSoft': 'rgba(255,255,255,0.06)',
      'accent': '#7b5bf5',
      'accentSoft': 'rgba(123,91,245,0.18)',
      'danger': '#dc2626',
    },
  ),
  ThemePreset(
    id: 'crunch',
    name: 'Crunchy',
    hidden: true,
    css: {
      'canvas': '#000000',
      'surface': '#151515',
      'elevated': '#272727',
      'raised': '#414141',
      'ink': '#ffffff',
      'inkMuted': '#bbbbbb',
      'inkSubtle': '#8c8c8c',
      'edge': 'rgba(255,255,255,0.10)',
      'edgeSoft': 'rgba(255,255,255,0.05)',
      'accent': '#ff640a',
      'accentSoft': 'rgba(255,100,10,0.18)',
      'danger': '#c13937',
    },
  ),
  ThemePreset(
    id: 'tokyo-night',
    name: 'Royal',
    css: {
      'canvas': '#0c1118',
      'surface': '#141a24',
      'elevated': '#1c2230',
      'raised': '#262d3d',
      'ink': '#f5f6fa',
      'inkMuted': '#b8bcca',
      'inkSubtle': '#6d7384',
      'edge': '#2e3647a0',
      'edgeSoft': '#2e36474d',
      'accent': '#f08032',
      'accentSoft': '#f080322e',
      'danger': '#ef5a5a',
    },
  ),
  ThemePreset(
    id: 'dracula',
    name: 'Dracula',
    css: {
      'canvas': '#282a36',
      'surface': '#21222c',
      'elevated': '#44475a',
      'raised': '#565969',
      'ink': '#f8f8f2',
      'inkMuted': '#d6d6d0',
      'inkSubtle': '#6272a4',
      'edge': '#6272a48c',
      'edgeSoft': '#6272a440',
      'accent': '#bd93f9',
      'accentSoft': '#bd93f92e',
      'danger': '#ff5555',
    },
  ),
  ThemePreset(
    id: 'forest',
    name: 'Forest',
    css: {
      'canvas': 'oklch(0.18 0.018 145)',
      'surface': 'oklch(0.22 0.020 145)',
      'elevated': 'oklch(0.26 0.024 145)',
      'raised': 'oklch(0.31 0.026 145)',
      'ink': 'oklch(0.97 0.012 140)',
      'inkMuted': 'oklch(0.74 0.020 140)',
      'inkSubtle': 'oklch(0.52 0.022 140)',
      'edge': 'oklch(0.38 0.028 145 / 0.55)',
      'edgeSoft': 'oklch(0.38 0.028 145 / 0.25)',
      'accent': 'oklch(0.80 0.15 145)',
      'accentSoft': 'oklch(0.80 0.15 145 / 0.18)',
      'danger': 'oklch(0.58 0.20 25)',
    },
  ),
  ThemePreset(
    id: 'noir',
    name: 'Noir',
    backgroundGradient: LinearGradient(
      colors: [Color(0xFF000000), Color(0xFF000000)],
    ),
    css: {
      'canvas': '#000000',
      'surface': '#070707',
      'elevated': '#0e0e0e',
      'raised': '#1a1a1a',
      'ink': '#f5f5f5',
      'inkMuted': '#9a9a9a',
      'inkSubtle': '#555555',
      'edge': 'rgba(255,255,255,0.08)',
      'edgeSoft': 'rgba(255,255,255,0.03)',
      'accent': '#ffffff',
      'accentSoft': 'rgba(255,255,255,0.10)',
      'danger': '#b94545',
    },
  ),
];

/// The featured / template / beta themes (`FEATURED_CUSTOM_THEMES`,
/// `TEMPLATE_THEMES`, `BETA_THEMES`, docs/20-… §7.4) that ship a solid palette,
/// so they render 1:1 from their colour tokens alone. `aurora` is intentionally
/// omitted — its translucent-glass surfaces require the gradient/bokeh backdrop
/// to be legible, which the native client does not yet render. Per §7.4 the
/// beta themes' `css`/`js`/`html` web-injection payloads are not run natively;
/// the colour tokens are the load-bearing part reproduced here.
const List<ThemePreset> kFeaturedThemePresets = [
  ThemePreset(
    id: 'minui',
    name: 'MinUI',
    blurb: 'Crisp and light. Big targets, restrained chrome.',
    css: {
      'canvas': '#f6f6f7',
      'surface': '#ffffff',
      'elevated': '#ffffff',
      'raised': '#f1f1f2',
      'ink': '#0a0a0c',
      'inkMuted': '#3f3f46',
      'inkSubtle': '#71717a',
      'edge': 'rgba(15,15,18,0.12)',
      'edgeSoft': 'rgba(15,15,18,0.06)',
      'accent': '#0d7c66',
      'accentSoft': 'rgba(13,124,102,0.12)',
      'danger': '#b91c1c',
    },
  ),
  ThemePreset(
    id: 'velvet',
    name: 'Velvet',
    blurb: 'Eggplant + champagne gold + serif. Old theatre, late night.',
    css: {
      'canvas': '#160c1b',
      'surface': '#1f1226',
      'elevated': '#2b1934',
      'raised': '#382242',
      'ink': '#f6efe3',
      'inkMuted': '#c4b6a2',
      'inkSubtle': '#7a6c64',
      'edge': 'rgba(212,181,98,0.18)',
      'edgeSoft': 'rgba(212,181,98,0.08)',
      'accent': '#d4b562',
      'accentSoft': 'rgba(212,181,98,0.16)',
      'danger': '#e87474',
    },
  ),
  ThemePreset(
    id: 'elegantfin',
    name: 'ElegantFin',
    blurb: 'Dark navy with one purple accent. Ported from Jellyfin.',
    css: {
      'canvas': '#111827',
      'surface': '#1f2937',
      'elevated': '#1e2836',
      'raised': '#374151',
      'ink': '#d1d5db',
      'inkMuted': '#9ca3af',
      'inkSubtle': '#6b7280',
      'edge': '#47505ce6',
      'edgeSoft': '#47505c66',
      'accent': '#775bf4',
      'accentSoft': '#775bf42e',
      'danger': '#a91d1d',
    },
  ),
  ThemePreset(
    id: 'feishin',
    name: 'Feishin',
    blurb: 'Layered near-black with one electric-blue accent.',
    css: {
      'canvas': '#0c0c0c',
      'surface': '#141414',
      'elevated': '#181818',
      'raised': '#242424',
      'ink': '#e1e1e1',
      'inkMuted': '#969696',
      'inkSubtle': '#6e6e6e',
      'edge': 'rgba(255,255,255,0.10)',
      'edgeSoft': 'rgba(255,255,255,0.05)',
      'accent': '#3574fc',
      'accentSoft': 'rgba(53,116,252,0.18)',
      'danger': '#cc3232',
    },
  ),
];

/// Resolves a preset id across the built-in and featured tables (mirrors the
/// web `getThemeById`), falling back to the default when unknown.
ThemePreset themePresetById(String id) {
  for (final p in kThemePresets) {
    if (p.id == id) return p;
  }
  for (final p in kFeaturedThemePresets) {
    if (p.id == id) return p;
  }
  return kThemePresets.firstWhere((p) => p.id == kDefaultThemeId);
}

/// Every selectable preset id (built-in non-hidden + featured), used to validate
/// a persisted `theme.preset`.
bool isSelectablePresetId(String id) =>
    kThemePresets.any((p) => p.id == id) ||
    kFeaturedThemePresets.any((p) => p.id == id);

/// The ten editable roles of a custom palette (`customColors`), in editor order.
/// `edge`/`accent` also seed the derived `edgeSoft`/`accentSoft` tokens — see
/// [HarborTokens.fromCustomColors].
const List<String> kCustomColorKeys = [
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

/// The starting palette when the user first switches to a custom theme
/// (`DEFAULT_CUSTOM_COLORS`, docs/20-… §7.1).
const Map<String, String> kDefaultCustomColors = {
  'canvas': '#1f2128',
  'surface': '#292c34',
  'elevated': '#34373f',
  'raised': '#3f424b',
  'ink': '#f6f6f8',
  'inkMuted': '#aaadb6',
  'inkSubtle': '#6e7079',
  'edge': '#70727b',
  'accent': '#d3a064',
  'danger': '#d35a3a',
};

/// Builds a Material [ThemeData] from Harbor tokens. All surfaces/text/controls
/// map to the token roles so every preset renders natively.
ThemeData buildHarborTheme(HarborTokens t) {
  final scheme = ColorScheme(
    brightness: t.brightness,
    primary: t.accent,
    onPrimary: _readableOn(t.accent),
    secondary: t.accent,
    onSecondary: _readableOn(t.accent),
    surface: t.surface,
    onSurface: t.ink,
    error: t.danger,
    onError: _readableOn(t.danger),
    surfaceContainerHighest: t.elevated,
    outline: t.edge,
    outlineVariant: t.edgeSoft,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: t.brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: t.canvas,
    canvasColor: t.canvas,
    cardColor: t.surface,
    dividerColor: t.edgeSoft,
    splashFactory: NoSplash.splashFactory,
    textTheme: _textTheme(t),
    iconTheme: IconThemeData(color: t.inkMuted),
    cardTheme: CardThemeData(
      color: t.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: t.edgeSoft),
      ),
    ),
  );
}

Color _readableOn(Color bg) => bg.computeLuminance() > 0.55
    ? const Color(0xFF0A0A0A)
    : const Color(0xFFFFFFFF);

TextTheme _textTheme(HarborTokens t) {
  final base = ThemeData(brightness: t.brightness).textTheme;
  return base
      .apply(bodyColor: t.ink, displayColor: t.ink)
      .copyWith(
        bodyMedium: base.bodyMedium?.copyWith(color: t.ink),
        bodySmall: base.bodySmall?.copyWith(color: t.inkMuted),
        labelSmall: base.labelSmall?.copyWith(color: t.inkSubtle),
      );
}
