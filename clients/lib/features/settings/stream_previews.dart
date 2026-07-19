import 'package:flutter/material.dart';

import '../../design/addons/addon_logo.dart';
import '../../design/tokens.dart';
import '../../domain/streams/stream_badges.dart';
import '../picker/format_badge.dart';

/// The live in-settings previews for the Streaming sources panel, ported from
/// web `stream-filter-preview.tsx` + `picker-previews.tsx` + `ad-skip-showcase`.
/// Each shows a worked example of what a setting does.

Widget _shell(HarborTokens t, Widget child) => Container(
  margin: const EdgeInsets.only(top: 4),
  padding: const EdgeInsets.all(14),
  decoration: BoxDecoration(
    color: t.canvas.withValues(alpha: 0.35),
    borderRadius: BorderRadius.circular(16),
    border: Border.all(color: t.edgeSoft),
  ),
  child: child,
);

// ─────────────────────────── Stream safety filter ───────────────────────────

enum _Reason { clean, cam, mismatch, oversized, malware }

const Map<_Reason, List<String>> _reject = {
  _Reason.clean: [],
  _Reason.malware: ['strict', 'balanced'],
  _Reason.mismatch: ['strict', 'balanced'],
  _Reason.oversized: ['strict'],
  _Reason.cam: ['strict'],
};

const Map<_Reason, String> _reasonLabel = {
  _Reason.cam: 'Likely cam',
  _Reason.mismatch: 'Wrong year',
  _Reason.oversized: 'Size outlier',
  _Reason.malware: 'Suspicious file',
};

typedef _FilterStream = ({
  String addon,
  List<String> badges,
  String name,
  _Reason reason,
});

const List<_FilterStream> _filterStreams = [
  (
    addon: 'torrentio',
    badges: ['2160p', 'HDR', 'Atmos'],
    name: 'Dune.Part.Two.2024.2160p.WEB-DL.x265-NTb',
    reason: _Reason.clean,
  ),
  (
    addon: 'yts',
    badges: ['1080p'],
    name: 'Dune.Part.Two.2024.1080p.BluRay.x264-PiGNUS',
    reason: _Reason.clean,
  ),
  (
    addon: 'thepiratebay',
    badges: ['CAM'],
    name: 'Dune.Part.Two.2024.HDCAM.c1nem4',
    reason: _Reason.cam,
  ),
  (
    addon: 'comet',
    badges: ['1080p'],
    name: 'Dune.Part.One.2021.1080p.WEBRip-OUTDATED',
    reason: _Reason.mismatch,
  ),
  (
    addon: 'mediafusion',
    badges: ['2160p', 'REMUX'],
    name: 'Dune.Part.Two.2024.REMUX.2160p.94GB',
    reason: _Reason.oversized,
  ),
  (
    addon: 'eztv',
    badges: ['EXE'],
    name: 'Dune2_HD_Player_setup.exe',
    reason: _Reason.malware,
  ),
];

bool _isBlocked(_Reason reason, String level) =>
    level != 'off' && (_reject[reason] ?? const []).contains(level);

/// A live "what gets through" preview for the stream safety filter.
class StreamFilterPreview extends StatelessWidget {
  const StreamFilterPreview({
    super.key,
    required this.level,
    required this.tokens,
  });

  final String level;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final blocked = _filterStreams
        .where((s) => _isBlocked(s.reason, level))
        .length;
    final shown = _filterStreams.length - blocked;
    return _shell(
      t,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.verified_user_outlined,
                size: 14,
                color: level == 'off' ? t.inkSubtle : t.accent,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'WHAT GETS THROUGH',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              if (level == 'off')
                Text(
                  'No filtering',
                  style: TextStyle(color: t.danger, fontSize: 11),
                )
              else
                Text(
                  '$blocked blocked · $shown shown',
                  style: TextStyle(color: t.inkSubtle, fontSize: 11),
                ),
            ],
          ),
          const SizedBox(height: 10),
          for (final s in _filterStreams) _filterRow(t, s),
        ],
      ),
    );
  }

  Widget _filterRow(HarborTokens t, _FilterStream s) {
    final off = _isBlocked(s.reason, level);
    return Opacity(
      opacity: off ? 0.6 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            AddonLogo(
              addonId: s.addon,
              addonName: s.addon,
              size: AddonLogoSize.xs,
            ),
            const SizedBox(width: 8),
            for (final b in s.badges) ...[
              _textBadge(t, b),
              const SizedBox(width: 4),
            ],
            Expanded(
              child: Text(
                s.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  decoration: off ? TextDecoration.lineThrough : null,
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (off)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: t.danger.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _reasonLabel[s.reason] ?? '',
                  style: TextStyle(
                    color: t.danger,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              )
            else
              Icon(Icons.check_circle, size: 15, color: t.success),
          ],
        ),
      ),
    );
  }

  Widget _textBadge(HarborTokens t, String label) {
    final Color fg;
    if (label == 'CAM' || label == 'EXE') {
      fg = const Color(0xFFF59E0B);
    } else if (label == 'HDR' || label == 'DV') {
      fg = const Color(0xFFA78BFA);
    } else if (label == 'Atmos') {
      fg = const Color(0xFF38BDF8);
    } else if (label == 'REMUX') {
      fg = const Color(0xFFE879F9);
    } else {
      fg = t.inkMuted;
    }
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 9.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

// ─────────────────────────── Source-row mock ───────────────────────────

typedef _Source = ({
  String addonId,
  String addonName,
  String headline,
  String desc,
  String file,
  List<BadgeKind> badges,
});

const List<_Source> _sources = [
  (
    addonId: 'torrentio',
    addonName: 'Torrentio',
    headline: 'Dune: Part Two 2024 2160p WEB-DL',
    desc: '👤 24 💾 18.4 GB ⚙️ RD',
    file: 'Dune.Part.Two.2024.2160p.MAX.WEB-DL.DDP5.1.Atmos.HDR.HEVC-NTb.mkv',
    badges: [
      BadgeKind.uhd4k,
      BadgeKind.webdl,
      BadgeKind.hevc,
      BadgeKind.hdr,
      BadgeKind.atmos,
    ],
  ),
  (
    addonId: 'yts',
    addonName: 'YTS',
    headline: 'Dune: Part Two (2024) 1080p BluRay',
    desc: '👤 11 💾 2.6 GB',
    file: 'Dune.Part.Two.2024.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4',
    badges: [BadgeKind.p1080, BadgeKind.bluray],
  ),
  (
    addonId: 'comet',
    addonName: 'Comet',
    headline: 'Dune: Part Two 2024 1080p WEB-DL DDP5.1',
    desc: '👤 8 💾 4.1 GB',
    file: 'Dune.Part.Two.2024.1080p.WEB-DL.DDP5.1.H.264-FLUX.mkv',
    badges: [BadgeKind.p1080, BadgeKind.webdl, BadgeKind.ddp],
  ),
];

Widget _sourceRow(
  HarborTokens t,
  _Source s, {
  bool filename = false,
  String? descOverride,
  bool fullDesc = false,
}) => Container(
  margin: const EdgeInsets.only(top: 8),
  padding: const EdgeInsets.all(12),
  decoration: BoxDecoration(
    color: t.elevated.withValues(alpha: 0.4),
    borderRadius: BorderRadius.circular(14),
    border: Border.all(color: t.edgeSoft),
  ),
  child: Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      AddonLogo(
        addonId: s.addonId,
        addonName: s.addonName,
        size: AddonLogoSize.xl,
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              s.headline,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.ink,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              descOverride ?? s.desc,
              maxLines: descOverride != null && fullDesc ? 6 : 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: t.inkMuted, fontSize: 12.5, height: 1.35),
            ),
            if (filename) ...[
              const SizedBox(height: 4),
              Text(
                s.file,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 11,
                  fontFamily: 'monospace',
                ),
              ),
            ],
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final k in s.badges)
                  FormatBadge(kind: k, size: BadgeSize.sm),
              ],
            ),
          ],
        ),
      ),
      const SizedBox(width: 10),
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: t.accent, shape: BoxShape.circle),
        child: Icon(Icons.play_arrow_rounded, color: t.canvas, size: 22),
      ),
    ],
  ),
);

// ─────────────────────────── Torrent name / descriptions ───────────────────

class TorrentNamePreview extends StatelessWidget {
  const TorrentNamePreview({super.key, required this.on, required this.tokens});

  final bool on;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => _shell(
    tokens,
    Column(
      children: [
        for (final s in _sources.take(2)) _sourceRow(tokens, s, filename: on),
      ],
    ),
  );
}

const String _aioDesc =
    'Dune.Part.Two.2024.2160p.MAX.WEB-DL.DDP5.1.Atmos.HDR.HEVC-NTb.mkv\n'
    '👤 142 💾 18.4 GB ⚙️ RealDebrid · Instant\n'
    '🌐 English · Spanish · French · German\n'
    '🎞️ HDR10 · Dolby Atmos 7.1 · HEVC\n'
    '📁 Dune Part Two (2024) [2160p WEB-DL]';

class StreamDescriptionPreview extends StatelessWidget {
  const StreamDescriptionPreview({
    super.key,
    required this.full,
    required this.tokens,
  });

  final bool full;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => _shell(
    tokens,
    _sourceRow(
      tokens,
      (
        addonId: 'aiostreams',
        addonName: 'AIOStreams',
        headline: 'Dune: Part Two 2024 2160p WEB-DL',
        desc: _aioDesc,
        file: '',
        badges: const [
          BadgeKind.uhd4k,
          BadgeKind.webdl,
          BadgeKind.hevc,
          BadgeKind.hdr,
          BadgeKind.atmos,
        ],
      ),
      descOverride: _aioDesc,
      fullDesc: full,
    ),
  );
}

// ─────────────────────────── Picker layout ───────────────────────────

class PickerLayoutPreview extends StatelessWidget {
  const PickerLayoutPreview({
    super.key,
    required this.condensed,
    required this.tokens,
  });

  final bool condensed;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) =>
      _shell(tokens, condensed ? _condensed(tokens) : _stremio(tokens));

  Widget _stremio(HarborTokens t) => Column(
    children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          children: [
            Icon(Icons.grid_view_rounded, size: 16, color: t.inkMuted),
            const SizedBox(width: 10),
            Text('All', style: TextStyle(color: t.ink, fontSize: 14)),
            const Spacer(),
            Icon(Icons.expand_more, size: 18, color: t.inkMuted),
          ],
        ),
      ),
      for (final s in _sources) _sourceRow(t, s),
    ],
  );

  Widget _condensed(HarborTokens t) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      // Best-source card.
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 74,
              height: 111,
              child: Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [t.elevated, t.surface],
                      ),
                    ),
                  ),
                  Positioned(
                    right: 5,
                    top: 5,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: const [
                        FormatBadge(kind: BadgeKind.uhd4k, size: BadgeSize.sm),
                        SizedBox(height: 3),
                        FormatBadge(kind: BadgeKind.hdr, size: BadgeSize.sm),
                        SizedBox(height: 3),
                        FormatBadge(kind: BadgeKind.atmos, size: BadgeSize.sm),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: t.canvas.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: t.edgeSoft),
                    ),
                    child: Text(
                      'AUDIO NOT LABELED',
                      style: TextStyle(
                        color: t.inkSubtle,
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Dune.Part.Two.2024.2160p.WEB-DL.x265-NTb',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 12,
                      height: 1.35,
                      fontFamily: 'monospace',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'WEB-DL · 18.4 GB',
                    style: TextStyle(
                      color: t.inkMuted,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.bolt, size: 13, color: t.inkMuted),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          'Cached on Real-Debrid',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: t.inkMuted, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Container(
                        height: 36,
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        decoration: BoxDecoration(
                          color: t.ink,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.play_arrow_rounded,
                              size: 18,
                              color: t.canvas,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Play',
                              style: TextStyle(
                                color: t.canvas,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      AddonLogo(
                        addonId: 'torrentio',
                        addonName: 'Torrentio',
                        size: AddonLogoSize.lg,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      Text(
        'SWITCH QUALITY',
        style: TextStyle(
          color: t.inkSubtle,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 3,
        ),
      ),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _tierTile(
            t,
            BadgeKind.uhd4k,
            '4K',
            'Instant · 18.4 GB',
            selected: true,
          ),
          _tierTile(t, BadgeKind.p1080, '1080p', 'Cached · 2.6 GB'),
          _tierTile(t, BadgeKind.p720, '720p', 'Cache · 1.1 GB', dim: true),
        ],
      ),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          children: [
            Text(
              'All sources',
              style: TextStyle(color: t.inkMuted, fontSize: 13),
            ),
            const Spacer(),
            Icon(Icons.expand_more, size: 16, color: t.inkSubtle),
          ],
        ),
      ),
    ],
  );

  Widget _tierTile(
    HarborTokens t,
    BadgeKind badge,
    String label,
    String status, {
    bool selected = false,
    bool dim = false,
  }) => Opacity(
    opacity: dim ? 0.65 : 1,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: selected ? t.ink.withValues(alpha: 0.05) : null,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: selected ? t.ink.withValues(alpha: 0.35) : t.edgeSoft,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FormatBadge(kind: badge, size: BadgeSize.sm),
          const SizedBox(width: 8),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 2),
              Text(status, style: TextStyle(color: t.inkSubtle, fontSize: 10)),
            ],
          ),
        ],
      ),
    ),
  );
}

// ─────────────────────────── Ad-skip showcase ───────────────────────────

class AdSkipShowcase extends StatelessWidget {
  const AdSkipShowcase({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      margin: const EdgeInsets.only(top: 4, bottom: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // A still frame of the player with a Skip button sliding in.
          AspectRatio(
            aspectRatio: 16 / 7,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        const Color(0xFF1A1A22),
                        Colors.black.withValues(alpha: 0.9),
                      ],
                    ),
                  ),
                ),
                Center(
                  child: Text(
                    'AD',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.25),
                      fontSize: 40,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 6,
                    ),
                  ),
                ),
                Positioned(
                  right: 14,
                  bottom: 14,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.fast_forward_rounded,
                          size: 16,
                          color: Colors.black,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Skip injected ad',
                          style: TextStyle(
                            color: Colors.black.withValues(alpha: 0.85),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: t.edgeSoft)),
            ),
            child: Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: t.accent,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'When a flagged ad plays, a Skip button slides in so you '
                    'jump straight past it.',
                    style: TextStyle(color: t.inkMuted, fontSize: 11.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
