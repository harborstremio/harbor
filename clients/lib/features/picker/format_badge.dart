import 'package:flutter/material.dart';

import '../../domain/streams/stream_badges.dart';

/// Badge footprint, mirroring the web `BadgeSize`.
enum BadgeSize { sm, md, lg }

const Map<BadgeSize, double> _width = {
  BadgeSize.sm: 30,
  BadgeSize.md: 42,
  BadgeSize.lg: 60,
};
const Map<BadgeSize, double> _maxHeight = {
  BadgeSize.sm: 28,
  BadgeSize.md: 40,
  BadgeSize.lg: 56,
};

/// New-pack badges are square with transparent padding around the artwork, so
/// at the landscape footprint their inner art reads tiny next to the legacy
/// landscape badges. This multiplier scales those specific kinds up to match —
/// ported verbatim from the web `SCALE_UP` table.
const Map<BadgeKind, double> _scaleUp = {
  BadgeKind.i1080: 1.5,
  BadgeKind.qhd2k: 1.5,
  BadgeKind.p360: 1.5,
  BadgeKind.p576: 1.5,
  BadgeKind.uhd: 1.5,
  BadgeKind.webrip: 1.5,
  BadgeKind.hdtv: 1,
  BadgeKind.dvb: 1.5,
  BadgeKind.hdcam: 1.5,
  BadgeKind.hdts: 1.5,
  BadgeKind.scr: 1.5,
  BadgeKind.wp: 1.5,
  BadgeKind.hdr10: 1.5,
  BadgeKind.sdr: 1.5,
  BadgeKind.atmos912: 1.5,
  BadgeKind.dtsHdMa: 1.5,
  BadgeKind.dd: 1.5,
  BadgeKind.ddp: 1.5,
  BadgeKind.ac3: 1.5,
  BadgeKind.eac3: 1.5,
  BadgeKind.mp3: 1.5,
  BadgeKind.opus: 1.5,
  BadgeKind.pcm: 1.5,
  BadgeKind.lpcm: 1.5,
  BadgeKind.extended: 1.5,
  BadgeKind.remastered: 1.5,
  BadgeKind.repack: 1.5,
};

/// A single real quality/audio/HDR badge image, the native analog of the web
/// `FormatBadge`. Low-confidence and theater-capture kinds carry an
/// explanatory [BadgeNote], surfaced as a long-press / hover tooltip.
class FormatBadge extends StatelessWidget {
  const FormatBadge({super.key, required this.kind, this.size = BadgeSize.md});

  final BadgeKind kind;
  final BadgeSize size;

  @override
  Widget build(BuildContext context) {
    final scale = _scaleUp[kind] ?? 1.0;
    final w = (_width[size]! * scale).roundToDouble();
    final maxH = (_maxHeight[size]! * scale).roundToDouble();
    final image = ConstrainedBox(
      constraints: BoxConstraints(maxWidth: w, maxHeight: maxH),
      child: Image.asset(
        'assets/badges/${kind.asset}.webp',
        width: w,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
        semanticLabel: kind.alt,
      ),
    );
    final note = kind.note;
    if (note == null) return image;
    return Tooltip(
      richMessage: TextSpan(
        children: [
          TextSpan(
            text: '${note.title}\n',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          TextSpan(text: note.body),
        ],
      ),
      preferBelow: false,
      child: image,
    );
  }
}
