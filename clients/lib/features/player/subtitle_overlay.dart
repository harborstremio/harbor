import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../domain/player/subtitle_style.dart';
import '../../domain/subtitles/parser.dart';

/// Renders the active external-subtitle cue over the default engine's video (the
/// libmpv advanced engine draws its own). Driven by the playback [position]
/// notifier so only the cue rebuilds on each ~4×/sec tick, and by the
/// user-stepped [offsetSec] delay. Styled from the `sub*` settings via [style].
class SubtitleOverlay extends StatelessWidget {
  const SubtitleOverlay({
    super.key,
    required this.cues,
    required this.position,
    required this.offsetSec,
    required this.style,
  });

  final List<SubCue> cues;
  final ValueListenable<double> position;
  final double offsetSec;
  final SubtitleStyle style;

  Alignment get _align => switch (style.align) {
    'left' => Alignment.bottomLeft,
    'right' => Alignment.bottomRight,
    _ => Alignment.bottomCenter,
  };

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: position,
      builder: (context, posSec, _) {
        final cue = findActiveCue(cues, posSec - offsetSec);
        if (cue == null || cue.text.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: EdgeInsets.only(
            bottom: style.marginBottom,
            left: 40,
            right: 40,
          ),
          child: Align(
            alignment: _align,
            child: _CueText(text: cue.text, style: style),
          ),
        );
      },
    );
  }
}

/// Draws one cue's text in the configured mode (shadow / box / outline / none).
class _CueText extends StatelessWidget {
  const _CueText({required this.text, required this.style});

  final String text;
  final SubtitleStyle style;

  @override
  Widget build(BuildContext context) {
    final s = style;
    final align = switch (s.align) {
      'left' => TextAlign.left,
      'right' => TextAlign.right,
      _ => TextAlign.center,
    };
    final base = TextStyle(
      color: Color(s.colorArgb),
      fontSize: s.fontSize,
      fontWeight: s.bold ? FontWeight.w700 : FontWeight.w500,
      height: s.lineHeight,
      letterSpacing: s.letterSpacing,
    );

    switch (s.mode) {
      case 'box':
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          color: Color(s.boxArgb),
          child: Text(text, textAlign: align, style: base),
        );
      case 'outline':
        final stroke = TextStyle(
          fontSize: s.fontSize,
          fontWeight: base.fontWeight,
          height: s.lineHeight,
          letterSpacing: s.letterSpacing,
          foreground: Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = s.edgeSize
            ..color = Color(s.edgeArgb),
        );
        return Stack(
          children: [
            Text(text, textAlign: align, style: stroke),
            Text(text, textAlign: align, style: base),
          ],
        );
      case 'none':
        return Text(text, textAlign: align, style: base);
      default: // shadow
        return Text(
          text,
          textAlign: align,
          style: base.copyWith(
            shadows: [
              Shadow(
                color: Color(s.edgeArgb),
                blurRadius: s.edgeSize,
                offset: Offset(0, s.edgeSize * 0.35),
              ),
            ],
          ),
        );
    }
  }
}
