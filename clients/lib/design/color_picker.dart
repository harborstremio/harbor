import 'package:flutter/material.dart';

import 'css_color.dart';
import 'focus/focusable.dart';
import 'tokens.dart';
import '../design/focus/tv_text_field.dart';

/// The ten profile / theme swatches, ported 1:1 from `HARBOR_COLOR_SWATCHES`.
const List<String> kHarborColorSwatches = [
  '#7dd3fc',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
  '#fb923c',
  '#fbbf24',
  '#a3e635',
  '#34d399',
  '#22d3ee',
];

/// Parses a `#rrggbb` hex to a [Color], falling back to the first swatch for an
/// unparseable value (the picker always has a live colour to show).
Color hexToColor(String hex) => parseCssColor(hex) ?? const Color(0xFF7DD3FC);

/// Formats a [Color] as a lowercase `#rrggbb` string.
String colorToHex(Color c) {
  String h(double v) =>
      (v * 255).round().clamp(0, 255).toRadixString(16).padLeft(2, '0');
  return '#${h(c.r)}${h(c.g)}${h(c.b)}';
}

/// Opens the saturation/value + hue + hex colour dialog and resolves to the
/// chosen `#rrggbb` (or null if dismissed). Shared by the profile colour pill
/// and the custom-theme editor.
Future<String?> showHarborColorPicker(
  BuildContext context, {
  required String initial,
  required HarborTokens tokens,
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _CustomColorDialog(initial: initial, tokens: tokens),
  );
}

/// The reusable colour picker, ported from `src/views/settings/color-picker.tsx`:
/// a "Your color" label, the ten preset swatches (selected one ringed), a
/// custom-colour pill that opens a saturation/value + hue + hex panel, and the
/// helper caption. Every control is [Focusable] for D-pad / Siri-remote use.
class HarborColorPicker extends StatelessWidget {
  const HarborColorPicker({
    super.key,
    required this.value,
    required this.onChange,
    required this.tokens,
  });

  final String value;
  final ValueChanged<String> onChange;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final lower = value.toLowerCase();
    final isPreset = kHarborColorSwatches.contains(lower);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Your color',
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.6,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            for (final hex in kHarborColorSwatches)
              _Swatch(
                hex: hex,
                selected: lower == hex,
                tokens: t,
                onPressed: () => onChange(hex),
              ),
            _CustomTrigger(
              value: value,
              label: isPreset ? 'Custom' : value.toUpperCase(),
              highlighted: !isPreset,
              tokens: t,
              onChange: onChange,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          'Used for your cursor in Watch Together, your draw color, and your '
          'name pill in chat.',
          style: TextStyle(color: t.inkSubtle, fontSize: 11.5, height: 1.35),
        ),
      ],
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({
    required this.hex,
    required this.selected,
    required this.tokens,
    required this.onPressed,
  });

  final String hex;
  final bool selected;
  final HarborTokens tokens;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Semantics(
      label: hex,
      button: true,
      selected: selected,
      child: Focusable(
        tokens: t,
        borderRadius: 999,
        onPressed: onPressed,
        child: AnimatedScale(
          scale: selected ? 1.1 : 1,
          duration: const Duration(milliseconds: 120),
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: hexToColor(hex),
              shape: BoxShape.circle,
              border: selected
                  ? Border.all(color: t.ink, width: 2)
                  : Border.all(color: Colors.black.withValues(alpha: 0.25)),
            ),
          ),
        ),
      ),
    );
  }
}

class _CustomTrigger extends StatelessWidget {
  const _CustomTrigger({
    required this.value,
    required this.label,
    required this.highlighted,
    required this.tokens,
    required this.onChange,
  });

  final String value;
  final String label;
  final bool highlighted;
  final HarborTokens tokens;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: () async {
        final picked = await showHarborColorPicker(
          context,
          initial: value,
          tokens: t,
        );
        if (picked != null) onChange(picked);
      },
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: highlighted ? t.ink : t.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: hexToColor(value),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.black.withValues(alpha: 0.3)),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: highlighted ? t.ink : t.inkMuted,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The saturation/value square + hue bar + hex field, emitting the chosen hex on
/// Done. Live-updates as the user drags or types.
class _CustomColorDialog extends StatefulWidget {
  const _CustomColorDialog({required this.initial, required this.tokens});

  final String initial;
  final HarborTokens tokens;

  @override
  State<_CustomColorDialog> createState() => _CustomColorDialogState();
}

class _CustomColorDialogState extends State<_CustomColorDialog> {
  late HSVColor _hsv = HSVColor.fromColor(hexToColor(widget.initial));
  late final TextEditingController _hex = TextEditingController(
    text: colorToHex(_hsv.toColor()).toUpperCase(),
  );

  static final _hexRe = RegExp(r'^#[0-9a-fA-F]{6}$');

  Color get _color => _hsv.toColor();

  void _setHsv(HSVColor next) {
    setState(() {
      _hsv = next;
      _hex.text = colorToHex(next.toColor()).toUpperCase();
    });
  }

  void _onSl(Offset local, Size size) {
    final s = (local.dx / size.width).clamp(0.0, 1.0);
    final v = (1 - local.dy / size.height).clamp(0.0, 1.0);
    _setHsv(_hsv.withSaturation(s).withValue(v));
  }

  void _onHue(double dx, double width) {
    final h = (dx / width).clamp(0.0, 1.0) * 360;
    _setHsv(_hsv.withHue(h));
  }

  @override
  void dispose() {
    _hex.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final baseHue = HSVColor.fromAHSV(1, _hsv.hue, 1, 1).toColor();
    return Dialog(
      backgroundColor: t.elevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 300),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LayoutBuilder(
                builder: (context, c) {
                  const h = 150.0;
                  final w = c.maxWidth;
                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onPanDown: (d) => _onSl(d.localPosition, Size(w, h)),
                    onPanUpdate: (d) => _onSl(d.localPosition, Size(w, h)),
                    child: SizedBox(
                      height: h,
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                gradient: LinearGradient(
                                  colors: [Colors.white, baseHue],
                                ),
                              ),
                            ),
                          ),
                          Positioned.fill(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                gradient: const LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [Colors.transparent, Colors.black],
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            left: _hsv.saturation * w - 7,
                            top: (1 - _hsv.value) * h - 7,
                            child: _thumb(_color),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, c) {
                  final w = c.maxWidth;
                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onPanDown: (d) => _onHue(d.localPosition.dx, w),
                    onPanUpdate: (d) => _onHue(d.localPosition.dx, w),
                    child: SizedBox(
                      height: 14,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Positioned.fill(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                gradient: const LinearGradient(
                                  colors: [
                                    Color(0xFFFF0000),
                                    Color(0xFFFFFF00),
                                    Color(0xFF00FF00),
                                    Color(0xFF00FFFF),
                                    Color(0xFF0000FF),
                                    Color(0xFFFF00FF),
                                    Color(0xFFFF0000),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            left: (_hsv.hue / 360) * w - 3,
                            top: -2,
                            child: Container(
                              width: 6,
                              height: 18,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(3),
                                border: Border.all(
                                  color: Colors.black.withValues(alpha: 0.55),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: _color,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: t.edgeSoft),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 100,
                    child: TvTextField(
                      controller: _hex,
                      style: TextStyle(
                        color: t.ink,
                        fontFamily: 'monospace',
                        fontSize: 12,
                      ),
                      cursorColor: t.accent,
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 8,
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: t.edgeSoft),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: t.ink),
                        ),
                      ),
                      onChanged: (v) {
                        if (_hexRe.hasMatch(v)) {
                          setState(
                            () => _hsv = HSVColor.fromColor(hexToColor(v)),
                          );
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Focusable(
                tokens: t,
                borderRadius: 12,
                onPressed: () => Navigator.of(context).pop(colorToHex(_color)),
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  decoration: BoxDecoration(
                    color: t.accent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Done',
                    style: TextStyle(
                      color: t.canvas,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _thumb(Color color) => Container(
    width: 14,
    height: 14,
    decoration: BoxDecoration(
      color: color,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 2),
      boxShadow: const [
        BoxShadow(color: Colors.black54, blurRadius: 2, spreadRadius: 0.5),
      ],
    ),
  );
}
