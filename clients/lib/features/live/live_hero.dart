import 'dart:async';

import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/live_home.dart';
import '../../domain/iptv/m3u.dart';
import 'live_channel_card.dart' show formatChannelTimeLeft;

/// The Live Home hero — a large featured area that rotates through the now-
/// playing spotlight (auto-advance every 9s, dot pager for the remote), showing
/// the channel's backdrop, a LIVE badge, the current programme title, the
/// channel · group line and a progress bar. Click/OK plays the active channel.
/// Ports web `LiveHero` (the muted in-hero video preview + Cinemeta backdrop
/// hydration are intentionally omitted — the card uses the EPG icon / channel
/// logo, the same graceful fallback web uses without hydration).
class LiveHero extends StatefulWidget {
  const LiveHero({
    super.key,
    required this.tokens,
    required this.tr,
    required this.items,
    required this.nowMs,
    required this.onPlay,
  });

  final HarborTokens tokens;
  final Translations tr;
  final List<NowItem> items;
  final int nowMs;
  final void Function(IptvChannel) onPlay;

  @override
  State<LiveHero> createState() => _LiveHeroState();
}

class _LiveHeroState extends State<LiveHero> {
  int _idx = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _restart();
  }

  @override
  void didUpdateWidget(LiveHero old) {
    super.didUpdateWidget(old);
    final oldKey = old.items.map((i) => i.channel.id).join('|');
    final key = widget.items.map((i) => i.channel.id).join('|');
    if (oldKey != key) {
      _idx = 0;
      _restart();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _restart() {
    _timer?.cancel();
    if (widget.items.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 9), (_) {
      if (mounted) setState(() => _idx = (_idx + 1) % widget.items.length);
    });
  }

  void _go(int i) {
    setState(() => _idx = i);
    _restart();
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    if (items.isEmpty) return const SizedBox.shrink();
    final t = widget.tokens;
    final tr = widget.tr;
    final active = items[_idx.clamp(0, items.length - 1)];
    final ch = active.channel;
    final cur = active.current;
    final art = (cur?.iconUrl?.isNotEmpty ?? false)
        ? cur!.iconUrl!
        : (ch.logo?.isNotEmpty ?? false)
        ? ch.logo!
        : null;
    final title = (cur?.title.isNotEmpty ?? false) ? cur!.title : ch.name;
    final meta = [
      ch.name,
      if (ch.group != null && ch.group!.isNotEmpty) ch.group,
    ].join(' · ');
    final left = (cur != null && cur.endMs > widget.nowMs)
        ? formatChannelTimeLeft(cur.endMs - widget.nowMs)
        : null;
    final tall = Idiom.of(context) != Idiom.phone;
    final g = pageGutter(Idiom.of(context));

    return Padding(
      padding: EdgeInsets.fromLTRB(g, 4, g, 22),
      child: Focusable(
        tokens: t,
        borderRadius: 14,
        scale: 1.0,
        onPressed: () => widget.onPlay(ch),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            height: tall ? 420 : 300,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(color: t.surface),
                if (art != null)
                  Image.network(
                    art,
                    fit: (cur?.iconUrl?.isNotEmpty ?? false)
                        ? BoxFit.cover
                        : BoxFit.contain,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  )
                else
                  Center(
                    child: Icon(
                      Icons.live_tv_outlined,
                      color: t.inkSubtle,
                      size: 56,
                    ),
                  ),
                // Bottom + left scrims so the copy stays legible over any art.
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        t.canvas,
                        t.canvas.withValues(alpha: 0.35),
                        Colors.transparent,
                      ],
                      stops: const [0, 0.45, 1],
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(28, 24, 28, 22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: t.danger,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                tr.t('Live').toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.6,
                                ),
                              ),
                            ),
                            if (left != null) ...[
                              const SizedBox(width: 12),
                              Icon(
                                Icons.history_rounded,
                                size: 15,
                                color: t.ink,
                              ),
                              const SizedBox(width: 5),
                              Text(
                                left,
                                style: TextStyle(
                                  color: t.ink,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t.ink,
                            fontSize: tall ? 38 : 27,
                            fontWeight: FontWeight.w600,
                            height: 1.05,
                            letterSpacing: -0.5,
                          ),
                        ),
                        if (meta.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            meta,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: t.inkMuted,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                        if (items.length > 1) ...[
                          const SizedBox(height: 16),
                          _dots(t),
                        ],
                      ],
                    ),
                  ),
                ),
                if (active.progress != null)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      height: 4,
                      color: Colors.black.withValues(alpha: 0.35),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: active.progress,
                          child: Container(color: t.danger),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _dots(HarborTokens t) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var i = 0; i < widget.items.length; i++) ...[
        if (i > 0) const SizedBox(width: 8),
        Focusable(
          tokens: t,
          borderRadius: 6,
          scale: 1.2,
          onPressed: () => _go(i),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            height: 6,
            width: i == _idx ? 28 : 16,
            decoration: BoxDecoration(
              color: i == _idx ? t.accent : t.inkSubtle.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ),
      ],
    ],
  );
}
