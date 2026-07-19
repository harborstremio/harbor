import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/iptv/channel_headers.dart';
import 'multiview_channel_picker.dart';

/// The multiview grid layout — how many live players show at once. Ports the web
/// `Layout` ("1"/"2"/"3"/"2x2"); the native build renders the players itself
/// (the web overlays Tauri windows, which are Windows-desktop only).
enum MultiviewLayout {
  single(1, '1', 'Single'),
  dual(2, '2', 'Side by side'),
  triple(3, '3', 'Triple'),
  quad(4, '2x2', 'Quad');

  const MultiviewLayout(this.slots, this.id, this.label);
  final int slots;
  final String id;
  final String label;

  static MultiviewLayout fromId(String? id) => MultiviewLayout.values
      .firstWhere((l) => l.id == id, orElse: () => MultiviewLayout.quad);
}

/// A channel assigned to a multiview slot.
class SlotChannel {
  const SlotChannel({required this.name, required this.url, this.headers});
  final String name;
  final String url;

  /// The player HTTP headers the channel needs (spoofed UA / referer / cookie).
  final Map<String, String>? headers;
}

/// Watch up to four live channels at once in a grid. One slot holds audio focus
/// (the rest are muted); tap a slot to (re)assign its channel, the speaker to
/// move audio to it, or the ✕ to clear it. Ported in spirit from the web
/// multiview — reimplemented with real per-slot [Player]s.
class MultiviewView extends ConsumerStatefulWidget {
  const MultiviewView({super.key});

  @override
  ConsumerState<MultiviewView> createState() => _MultiviewViewState();
}

class _MultiviewViewState extends ConsumerState<MultiviewView> {
  static const _layoutKey = 'multiview.layout';

  final List<SlotChannel?> _slots = List<SlotChannel?>.filled(4, null);
  MultiviewLayout _layout = MultiviewLayout.quad;
  int _audioFocus = 0;

  @override
  void initState() {
    super.initState();
    final saved = ref.read(settingsProvider).getString(_layoutKey);
    if (saved.isNotEmpty) _layout = MultiviewLayout.fromId(saved);
  }

  void _setLayout(MultiviewLayout l) {
    setState(() {
      _layout = l;
      // Keep audio focus on a filled, still-visible slot so sound doesn't vanish
      // when the layout shrinks past (or off) the focused slot.
      if (_audioFocus >= l.slots || _slots[_audioFocus] == null) {
        final firstFilled = _slots
            .take(l.slots)
            .toList()
            .indexWhere((s) => s != null);
        _audioFocus = firstFilled < 0 ? 0 : firstFilled;
      }
    });
    ref.read(settingsProvider.notifier).setValue(_layoutKey, l.id);
  }

  Future<void> _pick(int slot) async {
    final channel = await showMultiviewChannelPicker(context, ref);
    if (channel == null || !mounted) return;
    setState(() {
      _slots[slot] = SlotChannel(
        name: channel.name,
        url: channel.url,
        headers: headersFromChannel(channel),
      );
      // A freshly-filled slot takes audio focus when the current audio slot is
      // empty, so there is always a channel with sound.
      if (_slots[_audioFocus] == null) _audioFocus = slot;
    });
  }

  void _close(int slot) => setState(() {
    _slots[slot] = null;
    if (_audioFocus == slot) {
      final firstFilled = _slots.indexWhere((s) => s != null);
      _audioFocus = firstFilled < 0 ? 0 : firstFilled;
    }
  });

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            _bar(t),
            Expanded(
              child: Padding(padding: const EdgeInsets.all(8), child: _grid(t)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bar(HarborTokens t) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
    child: Row(
      children: [
        Focusable(
          tokens: t,
          borderRadius: 999,
          onPressed: () => ref.read(navControllerProvider.notifier).back(),
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            child: const Icon(Icons.arrow_back, color: Colors.white),
          ),
        ),
        const SizedBox(width: 8),
        const Text(
          'Multiview',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const Spacer(),
        for (final l in MultiviewLayout.values) ...[
          _layoutChip(t, l),
          const SizedBox(width: 8),
        ],
      ],
    ),
  );

  Widget _layoutChip(HarborTokens t, MultiviewLayout l) {
    final active = _layout == l;
    return Focusable(
      tokens: t,
      borderRadius: 10,
      autofocus: active,
      onPressed: () => _setLayout(l),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? t.accentSoft : Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: active ? t.accent : t.edgeSoft),
        ),
        child: Text(
          l.label,
          style: TextStyle(
            color: active ? t.ink : Colors.white70,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _cell(int i, HarborTokens t) => _MultiviewCell(
    key: ValueKey('mv-cell-$i'),
    channel: _slots[i],
    focused: _audioFocus == i,
    tokens: t,
    onPick: () => _pick(i),
    onClose: () => _close(i),
    onFocusAudio: () => setState(() => _audioFocus = i),
  );

  Widget _grid(HarborTokens t) {
    Widget row(List<int> idx) => Row(
      children: [
        for (var k = 0; k < idx.length; k++) ...[
          if (k > 0) const SizedBox(width: 8),
          Expanded(child: _cell(idx[k], t)),
        ],
      ],
    );
    switch (_layout) {
      case MultiviewLayout.single:
        return _cell(0, t);
      case MultiviewLayout.dual:
        return row([0, 1]);
      case MultiviewLayout.triple:
        return row([0, 1, 2]);
      case MultiviewLayout.quad:
        return Column(
          children: [
            Expanded(child: row([0, 1])),
            const SizedBox(height: 8),
            Expanded(child: row([2, 3])),
          ],
        );
    }
  }
}

/// One multiview slot: an empty "add channel" prompt, or a live player with a
/// name/audio/close overlay. Owns its own [Player] so slots run independently;
/// the player is disposed when the cell leaves the tree (e.g. the layout shrinks
/// past this slot), so hidden slots stop decoding.
class _MultiviewCell extends StatefulWidget {
  const _MultiviewCell({
    super.key,
    required this.channel,
    required this.focused,
    required this.tokens,
    required this.onPick,
    required this.onClose,
    required this.onFocusAudio,
  });

  final SlotChannel? channel;
  final bool focused;
  final HarborTokens tokens;
  final VoidCallback onPick;
  final VoidCallback onClose;
  final VoidCallback onFocusAudio;

  @override
  State<_MultiviewCell> createState() => _MultiviewCellState();
}

class _MultiviewCellState extends State<_MultiviewCell> {
  Player? _player;
  VideoController? _controller;
  String? _openedUrl;
  // Every (re)open bumps the generation; a stale in-flight open (superseded by a
  // channel swap, or by dispose) checks this after its await and bails, so no
  // code ever touches a player another open already tore down.
  int _gen = 0;
  bool _disposed = false;
  bool _loading = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    if (widget.channel != null) _open();
  }

  @override
  void didUpdateWidget(_MultiviewCell old) {
    super.didUpdateWidget(old);
    if (widget.channel?.url != _openedUrl) {
      _open();
    } else if (widget.focused != old.focused) {
      _applyVolume();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _gen++; // invalidate any in-flight open
    _player?.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final myGen = ++_gen;
    final ch = widget.channel;
    // Always tear the current player down before (re)opening, so two streams
    // never run concurrently on one Player (a rapid swap race).
    final old = _player;
    _player = null;
    _controller = null;
    await old?.dispose();
    if (_disposed || myGen != _gen) return;

    if (ch == null) {
      _openedUrl = null;
      if (mounted) {
        setState(() {
          _loading = false;
          _error = false;
        });
      }
      return;
    }

    _openedUrl = ch.url;
    final player = Player();
    final controller = VideoController(player);
    if (_disposed || myGen != _gen) {
      await player.dispose();
      return;
    }
    _player = player;
    _controller = controller;
    if (mounted) {
      setState(() {
        _loading = true;
        _error = false;
      });
    }
    try {
      await player.open(Media(ch.url, httpHeaders: ch.headers), play: true);
      if (_disposed || myGen != _gen) return; // superseded / disposed mid-open
      player.setVolume(widget.focused ? 100 : 0);
      if (mounted) setState(() => _loading = false);
    } catch (_) {
      // A dead link / geo-block / decoder exhaustion — surface a retry instead
      // of a permanently black tile or an unhandled async error.
      if (_disposed || myGen != _gen) return;
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  void _applyVolume() {
    if (!_disposed) _player?.setVolume(widget.focused ? 100 : 0);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final ch = widget.channel;
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(
            color: widget.focused ? t.accent : t.edgeSoft,
            width: widget.focused ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: ch == null ? _empty(t) : _filled(t, ch),
      ),
    );
  }

  Widget _empty(HarborTokens t) => Focusable(
    tokens: t,
    borderRadius: 10,
    onPressed: widget.onPick,
    child: ColoredBox(
      color: const Color(0xFF0B0D10),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.add_circle_outline, color: t.inkSubtle, size: 34),
            const SizedBox(height: 8),
            Text(
              'Add channel',
              style: TextStyle(color: t.inkMuted, fontSize: 13),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _filled(HarborTokens t, SlotChannel ch) => Stack(
    fit: StackFit.expand,
    children: [
      if (_controller != null)
        Video(controller: _controller!, fit: BoxFit.contain)
      else
        const ColoredBox(color: Colors.black),
      // A dead link / decoder failure surfaces a retry instead of a black tile.
      if (_error)
        Positioned.fill(
          child: ColoredBox(
            color: const Color(0xE60B0D10),
            child: Center(
              child: Focusable(
                tokens: t,
                borderRadius: 999,
                onPressed: _open,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline, color: t.inkSubtle, size: 28),
                    const SizedBox(height: 8),
                    Text(
                      "Couldn't play",
                      style: TextStyle(color: t.inkMuted, fontSize: 12.5),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: t.raised,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: t.edgeSoft),
                      ),
                      child: Text(
                        'Retry',
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        )
      else if (_loading)
        Center(
          child: SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: t.inkSubtle,
            ),
          ),
        ),
      // Bottom gradient + channel name.
      Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: Container(
          padding: const EdgeInsets.fromLTRB(10, 20, 10, 8),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [Colors.black87, Colors.transparent],
            ),
          ),
          child: Text(
            ch.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
      // Top-right controls: audio focus, swap channel, close.
      Positioned(
        top: 6,
        right: 6,
        child: Row(
          children: [
            _iconBtn(
              t,
              widget.focused ? Icons.volume_up : Icons.volume_off,
              widget.focused ? t.accent : Colors.white,
              widget.onFocusAudio,
            ),
            const SizedBox(width: 6),
            _iconBtn(t, Icons.swap_horiz, Colors.white, widget.onPick),
            const SizedBox(width: 6),
            _iconBtn(t, Icons.close, Colors.white, widget.onClose),
          ],
        ),
      ),
    ],
  );

  Widget _iconBtn(
    HarborTokens t,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 16, color: color),
    ),
  );
}
