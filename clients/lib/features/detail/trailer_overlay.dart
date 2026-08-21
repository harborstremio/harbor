import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../app/trailer_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/trailer/trailer.dart';

/// Opens the trailer for [ytId]: plays the extracted stream in-window where the
/// platform supports it, otherwise opens YouTube externally — the native analog
/// of the web `TrailerOverlay` and its YouTube fallback.
Future<void> showTrailerOverlay(
  BuildContext context,
  WidgetRef ref, {
  required String ytId,
  required String title,
}) async {
  // Pause the hero autoplay trailer while the overlay is open.
  ref.read(trailerOverlayOpenProvider.notifier).set(true);
  try {
    await showGeneralDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.92),
      barrierDismissible: true,
      barrierLabel: 'trailer',
      transitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (_, _, _) => _TrailerOverlay(ytId: ytId, title: title),
      transitionBuilder: (_, anim, _, child) =>
          FadeTransition(opacity: anim, child: child),
    );
  } finally {
    ref.read(trailerOverlayOpenProvider.notifier).set(false);
  }
}

/// Whether this platform can play an extracted stream in-window (media_kit).
/// A 10-foot Apple TV target without a viable surface would fall through to
/// YouTube; the current targets all play in-window.
bool _canPlayInWindow() =>
    Platform.isAndroid ||
    Platform.isIOS ||
    Platform.isMacOS ||
    Platform.isWindows ||
    Platform.isLinux;

class _TrailerOverlay extends ConsumerStatefulWidget {
  const _TrailerOverlay({required this.ytId, required this.title});

  final String ytId;
  final String title;

  @override
  ConsumerState<_TrailerOverlay> createState() => _TrailerOverlayState();
}

class _TrailerOverlayState extends ConsumerState<_TrailerOverlay> {
  Player? _player;
  VideoController? _controller;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  Future<void> _resolve() async {
    // No in-window surface → open YouTube and dismiss.
    if (!_canPlayInWindow()) {
      await _openYoutube();
      if (mounted) Navigator.of(context).maybePop();
      return;
    }
    final quality = TrailerQuality.fromWire(
      ref.read(settingsProvider).getString('trailerQuality'),
    );
    final stream = await ref
        .read(trailerResolverProvider)
        .resolve(widget.ytId, quality);
    if (!mounted) return;
    if (stream == null) {
      setState(() {
        _loading = false;
        _failed = true;
      });
      return;
    }
    final player = Player();
    final controller = VideoController(player);
    await player.open(Media(stream.url.toString()));
    if (!mounted) {
      await player.dispose();
      return;
    }
    setState(() {
      _player = player;
      _controller = controller;
      _loading = false;
    });
  }

  Future<void> _openYoutube() => launchUrl(
    youtubeWatchUrl(widget.ytId),
    mode: LaunchMode.externalApplication,
  );

  @override
  void dispose() {
    _player?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          Positioned.fill(child: Center(child: _body(t))),
          Positioned(
            top: 16 + MediaQuery.paddingOf(context).top,
            right: 16,
            child: Focusable(
              tokens: t,
              borderRadius: 24,
              // Close is the only control during the async loading state, so it
              // autofocuses at first mount (the flag can't be derived from the
              // controller, which is still null then) and holds focus through
              // both the in-window and YouTube-fallback transitions — the remote
              // always has a visible target.
              autofocus: true,
              onPressed: () => Navigator.of(context).maybePop(),
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                  border: Border.all(color: t.edgeSoft),
                ),
                child: Icon(Icons.close_rounded, size: 22, color: t.ink),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(HarborTokens t) {
    if (_loading) {
      return CircularProgressIndicator(color: t.accent, strokeWidth: 2);
    }
    if (_failed || _controller == null) {
      return _fallback(t);
    }
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Video(controller: _controller!, fit: BoxFit.contain),
    );
  }

  Widget _fallback(HarborTokens t) {
    final tr = ref.watch(translationsProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            widget.title,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: t.ink,
              fontSize: 22,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            tr.t('This trailer plays on YouTube.'),
            textAlign: TextAlign.center,
            style: TextStyle(color: t.inkMuted, fontSize: 14),
          ),
          const SizedBox(height: 20),
          Focusable(
            tokens: t,
            // The always-present Close button already holds focus from first
            // mount, so this button doesn't claim autofocus (which would be a
            // no-op anyway and reads as a competing intent).
            borderRadius: 999,
            onPressed: () {
              _openYoutube();
              Navigator.of(context).maybePop();
            },
            child: Container(
              decoration: BoxDecoration(
                color: t.ink,
                borderRadius: BorderRadius.circular(999),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
              child: Text(
                tr.t('Watch on YouTube'),
                style: TextStyle(
                  color: t.canvas,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
