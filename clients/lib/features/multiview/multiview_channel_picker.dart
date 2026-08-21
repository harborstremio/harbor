import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/iptv_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_text_field.dart';
import '../../design/tokens.dart';
import '../../domain/iptv/m3u.dart';

/// Opens a modal to pick a live channel for a multiview slot, drawn from the
/// cached IPTV playlists. Resolves with the chosen channel, or null on dismiss.
Future<IptvChannel?> showMultiviewChannelPicker(
  BuildContext context,
  WidgetRef ref,
) {
  final t = ref.read(tokensProvider);
  return showDialog<IptvChannel>(
    context: context,
    barrierDismissible: true,
    builder: (_) => _ChannelPicker(tokens: t),
  );
}

class _ChannelPicker extends ConsumerStatefulWidget {
  const _ChannelPicker({required this.tokens});
  final HarborTokens tokens;

  @override
  ConsumerState<_ChannelPicker> createState() => _ChannelPickerState();
}

class _ChannelPickerState extends ConsumerState<_ChannelPicker> {
  String _query = '';

  List<IptvChannel> _channels() {
    final playlists = ref.watch(iptvCachedPlaylistsProvider);
    final seen = <String>{};
    final out = <IptvChannel>[];
    for (final p in playlists) {
      for (final ch in p.channels) {
        if (ch.url.isEmpty || !seen.add(ch.url)) continue;
        out.add(ch);
      }
    }
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return out;
    return [
      for (final ch in out)
        if (ch.name.toLowerCase().contains(q) ||
            (ch.group ?? '').toLowerCase().contains(q))
          ch,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final channels = _channels();
    return Dialog(
      backgroundColor: t.elevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 520,
          maxHeight: MediaQuery.sizeOf(context).height * 0.8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Text(
                    'Pick a channel',
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Focusable(
                    tokens: t,
                    borderRadius: 999,
                    onPressed: () => Navigator.of(context).pop(),
                    child: Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      child: Icon(Icons.close, color: t.inkMuted, size: 20),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TvTextField(
                autofocus: true,
                onChanged: (v) => setState(() => _query = v),
                style: TextStyle(color: t.ink, fontSize: 14),
                cursorColor: t.accent,
                decoration: InputDecoration(
                  isDense: true,
                  hintText: 'Search channels…',
                  hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
                  prefixIcon: Icon(Icons.search, color: t.inkSubtle, size: 18),
                  filled: true,
                  fillColor: t.canvas,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: t.edge),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: t.edge),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: t.accent, width: 2),
                  ),
                ),
              ),
            ),
            Flexible(
              child: channels.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(32),
                      child: Text(
                        'No channels. Add an IPTV playlist in Live TV first.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: t.inkMuted, fontSize: 13),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                      itemCount: channels.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 4),
                      itemBuilder: (_, i) => _row(t, channels[i]),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(HarborTokens t, IptvChannel ch) => Focusable(
    tokens: t,
    borderRadius: 10,
    onPressed: () => Navigator.of(context).pop(ch),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: t.raised,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          Icon(Icons.live_tv, size: 16, color: t.inkSubtle),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ch.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if ((ch.group ?? '').isNotEmpty)
                  Text(
                    ch.group!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                  ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
