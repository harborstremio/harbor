import 'dart:ui';

import 'css_color.dart';

/// The 12 themeable color roles Harbor sets as CSS custom properties on `<html>`
/// (`--color-canvas` … `--color-danger`), plus the fixed `success`. Every native
/// surface, text style, and control derives from these — see `docs/20-…`.
class HarborTokens {
  const HarborTokens({
    required this.canvas,
    required this.surface,
    required this.elevated,
    required this.raised,
    required this.ink,
    required this.inkMuted,
    required this.inkSubtle,
    required this.edge,
    required this.edgeSoft,
    required this.accent,
    required this.accentSoft,
    required this.danger,
    this.success = const Color(0xFF3FB27F),
  });

  final Color canvas; // app background
  final Color surface; // cards / rails
  final Color elevated; // raised cards / menus
  final Color raised; // controls / inputs
  final Color ink; // primary text
  final Color inkMuted; // secondary text
  final Color inkSubtle; // tertiary text / hints
  final Color edge; // borders
  final Color edgeSoft; // hairline borders
  final Color accent; // brand / focus / actions
  final Color accentSoft; // accent tint (hover/selected fills)
  final Color danger; // destructive / errors
  final Color success;

  /// Builds tokens from a role→CSS-color map. Throws [ArgumentError] if any
  /// required role is missing or unparseable — a theme is never partially
  /// applied with silent defaults.
  factory HarborTokens.fromCss(Map<String, String> css) {
    Color role(String key) {
      final raw = css[key];
      if (raw == null) {
        throw ArgumentError('theme token "$key" is missing');
      }
      final c = parseCssColor(raw);
      if (c == null) {
        throw ArgumentError('theme token "$key" is not a valid color: "$raw"');
      }
      return c;
    }

    return HarborTokens(
      canvas: role('canvas'),
      surface: role('surface'),
      elevated: role('elevated'),
      raised: role('raised'),
      ink: role('ink'),
      inkMuted: role('inkMuted'),
      inkSubtle: role('inkSubtle'),
      edge: role('edge'),
      edgeSoft: role('edgeSoft'),
      accent: role('accent'),
      accentSoft: role('accentSoft'),
      danger: role('danger'),
    );
  }

  /// Builds tokens from a 10-key custom palette (the `customColors` theme
  /// field), mirroring `customColorsToTokens` in `src/lib/theme.ts`: `edge` is
  /// expanded to the border role (`8c` alpha) and the hairline `edgeSoft`
  /// (`40` alpha), and `accent` derives its soft tint `accentSoft` (`2e`
  /// alpha). Throws [ArgumentError] on any missing or unparseable role so a
  /// custom theme is never partially applied with silent defaults.
  factory HarborTokens.fromCustomColors(Map<String, String> colors) {
    Color role(String key) {
      final raw = colors[key];
      if (raw == null) {
        throw ArgumentError('custom colour "$key" is missing');
      }
      final c = parseCssColor(raw);
      if (c == null) {
        throw ArgumentError(
          'custom colour "$key" is not a valid color: "$raw"',
        );
      }
      return c;
    }

    final edge = role('edge');
    final accent = role('accent');
    return HarborTokens(
      canvas: role('canvas'),
      surface: role('surface'),
      elevated: role('elevated'),
      raised: role('raised'),
      ink: role('ink'),
      inkMuted: role('inkMuted'),
      inkSubtle: role('inkSubtle'),
      edge: edge.withValues(alpha: 0x8c / 255),
      edgeSoft: edge.withValues(alpha: 0x40 / 255),
      accent: accent,
      accentSoft: accent.withValues(alpha: 0x2e / 255),
      danger: role('danger'),
    );
  }

  Brightness get brightness =>
      canvas.computeLuminance() < 0.5 ? Brightness.dark : Brightness.light;
}
