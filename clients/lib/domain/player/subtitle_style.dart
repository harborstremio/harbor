import '../settings/settings.dart';

/// A resolved subtitle appearance, mapped from the `sub*` settings (docs/50
/// §6.4). A plain descriptor — the player bridge turns it into the engine's
/// subtitle-view configuration.
class SubtitleStyle {
  const SubtitleStyle({
    required this.fontSize,
    required this.colorArgb,
    required this.bold,
    required this.align,
    required this.marginBottom,
    required this.mode,
    required this.boxArgb,
    required this.edgeArgb,
    required this.edgeSize,
    required this.lineHeight,
    required this.letterSpacing,
  });

  final double fontSize;
  final int colorArgb;
  final bool bold;
  final String align; // left | center | right
  final double marginBottom;
  final String mode; // shadow | box | outline | none
  final int boxArgb; // box background (mode == box)
  final int edgeArgb; // shadow / outline colour
  final double edgeSize;
  final double lineHeight;

  /// Character spacing in logical pixels, from the `subLineSpacing` setting.
  final double letterSpacing;
}

/// The subtitle character spacing (logical px) for [fontSize] from the
/// `subLineSpacing` slider (0–12), ported from `subtitle-overlay.tsx`:
/// `(-0.005 + subLineSpacing * 0.06)` em, converted from em to px via the font
/// size (mpv `sub-spacing`'s Flutter equivalent).
double subLetterSpacing(double subLineSpacing, double fontSize) =>
    (-0.005 + subLineSpacing * 0.06) * fontSize;

/// Parses a `#RRGGBB` (or `#RGB`) colour into an ARGB int with [opacity] alpha.
int parseSubColor(String hex, double opacity) {
  var h = hex.replaceFirst('#', '').trim();
  if (h.length == 3) {
    h = h.split('').map((c) => '$c$c').join();
  }
  final rgb = int.tryParse(h, radix: 16) ?? 0xFFFFFF;
  final a = (opacity.clamp(0.0, 1.0) * 255).round();
  return (a << 24) | (rgb & 0xFFFFFF);
}

/// Builds the subtitle style from the `sub*` settings, ported from the web's
/// subtitle-styling config.
SubtitleStyle subtitleStyleFrom(Settings s) {
  final size = s.getDouble('subFontSize');
  final fontSize = size > 0 ? size : 32.0;
  return SubtitleStyle(
    fontSize: fontSize,
    colorArgb: parseSubColor(
      s.getString('subFontColor'),
      s.getDouble('subOpacity'),
    ),
    bold: s.getBool('subBold'),
    align: s.getString('subAlignX'),
    marginBottom: s.getDouble('subMarginY'),
    mode: s.getString('subStyle'),
    boxArgb: parseSubColor(
      s.getString('subBoxColor'),
      s.getDouble('subBoxOpacity'),
    ),
    edgeArgb: parseSubColor(s.getString('subBorderColor'), 1),
    edgeSize: s.getDouble('subBorderSize'),
    lineHeight: 1.4,
    letterSpacing: subLetterSpacing(s.getDouble('subLineSpacing'), fontSize),
  );
}
