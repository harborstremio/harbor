import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/iptv_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/channel_hydration.dart';
import '../../domain/iptv/m3u.dart';
import '../../domain/iptv/xmltv.dart';

/// The "{h}h {m}m left" / "{m}m left" copy for a program's remaining time.
String formatChannelTimeLeft(int ms) {
  final totalMin = (ms / 60000).ceil();
  if (totalMin >= 60) {
    final h = totalMin ~/ 60;
    final m = totalMin % 60;
    return m != 0 ? '${h}h ${m}m left' : '${h}h left';
  }
  return '${totalMin < 1 ? 1 : totalMin}m left';
}

/// A channel poster card — the logo (or hydrated Cinemeta poster fallback) over
/// the channel name and its now/next EPG strip with a progress bar. Shared by
/// the Live grid and the Live Home rails. Extracted from the live view's
/// `_ChannelCard`.
class LiveChannelCard extends StatelessWidget {
  const LiveChannelCard({
    super.key,
    required this.tokens,
    required this.channel,
    required this.current,
    required this.next,
    required this.nowMs,
    required this.onPressed,
    required this.onLongPress,
    required this.tr,
    this.autofocus = false,
  });

  final HarborTokens tokens;
  final IptvChannel channel;
  final EpgProgram? current;
  final EpgProgram? next;
  final int nowMs;
  final VoidCallback onPressed;
  final VoidCallback onLongPress;
  final Translations tr;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      autofocus: autofocus,
      onPressed: onPressed,
      onLongPress: onLongPress,
      child: Container(
        color: t.surface,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _LiveLogo(tokens: t, channel: channel)),
            Padding(
              padding: const EdgeInsets.fromLTRB(11, 8, 11, 10),
              child: _info(t),
            ),
          ],
        ),
      ),
    );
  }

  Widget _info(HarborTokens t) {
    final cur = current;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          channel.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: t.ink,
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 3),
        if (cur != null)
          ..._epgStrip(t, cur)
        else
          Text(
            channel.group ?? tr.t('No program info'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: t.inkSubtle, fontSize: 12),
          ),
      ],
    );
  }

  List<Widget> _epgStrip(HarborTokens t, EpgProgram cur) {
    final progress = cur.endMs > cur.startMs
        ? ((nowMs - cur.startMs) / (cur.endMs - cur.startMs)).clamp(0.0, 1.0)
        : null;
    final timeLeft = cur.endMs > nowMs
        ? formatChannelTimeLeft(cur.endMs - nowMs)
        : null;
    final nextProg = next;
    return [
      Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Text(
              cur.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: t.inkMuted, fontSize: 12, height: 1.1),
            ),
          ),
          if (timeLeft != null) ...[
            const SizedBox(width: 6),
            Text(
              timeLeft,
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 10.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
      if (progress != null) ...[
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: Container(
            height: 3,
            color: t.canvas.withValues(alpha: 0.55),
            child: Align(
              alignment: Alignment.centerLeft,
              child: FractionallySizedBox(
                widthFactor: progress,
                child: Container(color: t.danger),
              ),
            ),
          ),
        ),
      ],
      if (nextProg != null) ...[
        const SizedBox(height: 3),
        Text(
          'Next: ${nextProg.title}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: t.inkSubtle, fontSize: 11, height: 1.1),
        ),
      ],
    ];
  }
}

class _LiveLogo extends ConsumerWidget {
  const _LiveLogo({required this.tokens, required this.channel});
  final HarborTokens tokens;
  final IptvChannel channel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fallback = Center(
      child: Icon(Icons.live_tv_outlined, color: tokens.inkSubtle, size: 32),
    );
    final logo = channel.logo;
    if (logo != null && logo.isNotEmpty) return _image(logo, fallback);
    // No logo — fall back to a hydrated Cinemeta poster for named channels.
    if (!isHydratableChannel(channel)) return fallback;
    final poster = ref
        .watch(channelHydrationProvider(channel.name))
        .asData
        ?.value
        ?.poster;
    return (poster != null && poster.isNotEmpty)
        ? _image(poster, fallback)
        : fallback;
  }

  Widget _image(String url, Widget fallback) => Padding(
    padding: const EdgeInsets.all(10),
    child: Image.network(
      url,
      fit: BoxFit.contain,
      errorBuilder: (_, _, _) => fallback,
      loadingBuilder: (ctx, child, progress) =>
          progress == null ? child : fallback,
    ),
  );
}
