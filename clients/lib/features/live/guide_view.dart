import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/catchup.dart';
import '../../domain/iptv/epg_resolver.dart';
import '../../domain/iptv/m3u.dart';
import '../../domain/iptv/xmltv.dart';
import 'guide_utils.dart';

/// The Live TV guide — a horizontally-scrollable EPG timeline: a sticky channel
/// column, a time ruler, and each channel's programmes as time-positioned
/// blocks with a live "now" line. Ports `views/live/guide/guide-view.tsx`.
///
/// The web layout uses CSS sticky; natively the channel column and ruler are
/// mirror scroll views synced to the single scrollable grid — the same sticky
/// effect on both axes.
class GuideView extends StatefulWidget {
  const GuideView({
    super.key,
    required this.tokens,
    required this.channels,
    required this.epg,
    required this.tvgCounts,
    required this.overrides,
    required this.offset,
    required this.nowMs,
    required this.onPlay,
    required this.tr,
    this.onPlayCatchup,
  });

  final HarborTokens tokens;
  final Translations tr;
  final List<IptvChannel> channels;
  final EpgIndex? epg;
  final Map<String, int> tvgCounts;
  final Map<String, String> overrides;
  final double offset;
  final int nowMs;
  final void Function(IptvChannel) onPlay;

  /// Plays a past programme via catch-up (when the channel supports it).
  final void Function(IptvChannel, EpgProgram)? onPlayCatchup;

  @override
  State<GuideView> createState() => _GuideViewState();
}

class _GuideViewState extends State<GuideView> {
  final _vGrid = ScrollController();
  final _vChannels = ScrollController();
  final _hGrid = ScrollController();
  final _hRuler = ScrollController();

  @override
  void initState() {
    super.initState();
    _vGrid.addListener(() {
      if (_vChannels.hasClients && _vChannels.offset != _vGrid.offset) {
        _vChannels.jumpTo(_vGrid.offset);
      }
    });
    // Reverse mirror: when the D-pad focuses a channel cell below the fold,
    // Flutter scrolls the channel column into view — sync the program grid back
    // so the two stay aligned. The `offset != offset` guards prevent a feedback
    // loop (the forward listener no-ops once the two match).
    _vChannels.addListener(() {
      if (_vGrid.hasClients && _vGrid.offset != _vChannels.offset) {
        _vGrid.jumpTo(_vChannels.offset);
      }
    });
    _hGrid.addListener(() {
      if (_hRuler.hasClients && _hRuler.offset != _hGrid.offset) {
        _hRuler.jumpTo(_hGrid.offset);
      }
    });
  }

  @override
  void dispose() {
    _vGrid.dispose();
    _vChannels.dispose();
    _hGrid.dispose();
    _hRuler.dispose();
    super.dispose();
  }

  List<EpgProgram> _programsFor(IptvChannel ch) =>
      epgProgramsForChannel(
        ch,
        widget.epg,
        widget.tvgCounts,
        override: widget.overrides[ch.id],
        offsetHours: widget.offset,
      ) ??
      const [];

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    // The fixed 200px channel column eats over half a phone's width; shrink it
    // there and keep the roomy 200 on tablet/tv. Used for both the ruler-header
    // left box and the channel column so they stay aligned.
    final colW = Idiom.of(context).isPhone ? 120.0 : channelColPx;
    final windowStart = startOfWindow(widget.nowMs);
    const windowMinutes = windowHours * 60;
    final windowEnd = windowStart + windowMinutes * 60000;
    final nowOffset = offsetPxFor(widget.nowMs, windowStart);
    final showNow = widget.nowMs >= windowStart && widget.nowMs < windowEnd;

    return Column(
      children: [
        SizedBox(
          height: rulerHeightPx,
          child: Row(
            children: [
              Container(
                width: colW,
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: t.surface,
                  border: Border(bottom: BorderSide(color: t.edgeSoft)),
                ),
                child: Text(
                  widget.tr.t('CHANNEL'),
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  controller: _hRuler,
                  physics: const NeverScrollableScrollPhysics(),
                  child: _ruler(t, windowStart, windowMinutes),
                ),
              ),
            ],
          ),
        ),
        if (widget.epg == null) _epgBanner(t),
        Expanded(
          child: Row(
            children: [
              SizedBox(
                width: colW,
                child: ListView.builder(
                  controller: _vChannels,
                  physics: const NeverScrollableScrollPhysics(),
                  itemExtent: rowHeightPx,
                  itemCount: widget.channels.length,
                  itemBuilder: (ctx, i) =>
                      _channelCell(t, widget.channels[i], autofocus: i == 0),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  controller: _hGrid,
                  child: SizedBox(
                    width: windowPx,
                    child: Stack(
                      children: [
                        ListView.builder(
                          controller: _vGrid,
                          itemExtent: rowHeightPx,
                          itemCount: widget.channels.length,
                          itemBuilder: (ctx, i) => _rowTrack(
                            t,
                            widget.channels[i],
                            windowStart,
                            windowEnd,
                          ),
                        ),
                        if (showNow)
                          Positioned(
                            left: nowOffset,
                            top: 0,
                            bottom: 0,
                            child: Container(width: 2, color: t.danger),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _ruler(HarborTokens t, int windowStart, int windowMinutes) {
    final slots = <Widget>[];
    for (var m = 0; m < windowMinutes; m += 30) {
      final ms = windowStart + m * 60000;
      slots.add(
        Container(
          width: 30 * pxPerMin,
          height: rulerHeightPx,
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.only(left: 8),
          decoration: BoxDecoration(
            color: t.surface,
            border: Border(bottom: BorderSide(color: t.edgeSoft)),
          ),
          child: Text(
            formatTimeLabel(ms),
            style: TextStyle(
              color: m % 60 == 0 ? t.ink : t.inkSubtle,
              fontSize: 12,
              fontWeight: m % 60 == 0 ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      );
    }
    return SizedBox(
      width: windowPx,
      child: Row(children: slots),
    );
  }

  Widget _channelCell(
    HarborTokens t,
    IptvChannel ch, {
    bool autofocus = false,
  }) {
    return Focusable(
      tokens: t,
      borderRadius: 0,
      scale: 1.0,
      autofocus: autofocus,
      onPressed: () => widget.onPlay(ch),
      child: Container(
        height: rowHeightPx,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: t.surface,
          border: Border(
            bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.4)),
            right: BorderSide(color: t.edgeSoft.withValues(alpha: 0.6)),
          ),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 40,
              child: (ch.logo != null && ch.logo!.isNotEmpty)
                  ? Image.network(
                      ch.logo!,
                      fit: BoxFit.contain,
                      errorBuilder: (_, _, _) => Icon(
                        Icons.live_tv_outlined,
                        color: t.inkSubtle,
                        size: 20,
                      ),
                    )
                  : Icon(Icons.live_tv_outlined, color: t.inkSubtle, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                ch.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _rowTrack(
    HarborTokens t,
    IptvChannel ch,
    int windowStart,
    int windowEnd,
  ) {
    final programs = _programsFor(ch);
    final blocks = <Widget>[];
    for (final p in programs) {
      final clip = clampDuration(p.startMs, p.endMs, windowStart, windowEnd);
      if (clip == null) continue;
      blocks.add(
        Positioned(
          left: offsetPxFor(clip.visibleStart, windowStart),
          top: 0,
          bottom: 0,
          width: (clip.visibleEnd - clip.visibleStart) * pxPerMs,
          child: _programBlock(t, ch, p),
        ),
      );
    }
    return Container(
      height: rowHeightPx,
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.3)),
        ),
      ),
      child: blocks.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  widget.tr.t('No program info'),
                  style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                ),
              ),
            )
          : Stack(children: blocks),
    );
  }

  Widget _programBlock(HarborTokens t, IptvChannel ch, EpgProgram p) {
    final isPast = p.endMs <= widget.nowMs;
    final isLive =
        !isPast && p.startMs <= widget.nowMs && widget.nowMs < p.endMs;
    final replayable =
        isPast && widget.onPlayCatchup != null && channelHasCatchup(ch);
    final bg = isLive ? t.accentSoft : (isPast ? t.surface : t.raised);
    return Padding(
      padding: const EdgeInsets.all(2),
      child: Focusable(
        tokens: t,
        borderRadius: 8,
        scale: 1.02,
        onPressed: () =>
            replayable ? widget.onPlayCatchup!(ch, p) : widget.onPlay(ch),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: replayable ? t.accent : t.edgeSoft.withValues(alpha: 0.5),
              width: replayable ? 1.4 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      p.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isPast ? t.inkMuted : t.ink,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (replayable)
                    Padding(
                      padding: const EdgeInsets.only(left: 4),
                      child: Icon(Icons.replay, size: 13, color: t.accent),
                    ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                formatTimeLabel(p.startMs),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: t.inkSubtle, fontSize: 10.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _epgBanner(HarborTokens t) {
    return Container(
      margin: const EdgeInsets.fromLTRB(24, 10, 24, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: t.elevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: t.inkSubtle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              widget.tr.t(
                'Loading program listings… channels are ready to play in the '
                'meantime.',
              ),
              style: TextStyle(color: t.inkMuted, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }
}
