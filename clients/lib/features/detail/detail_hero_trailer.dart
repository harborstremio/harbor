import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../app/trailer_providers.dart';
import '../../domain/trailer/trailer.dart';

/// The muted, looping trailer that plays behind the detail hero backdrop when
/// `detailTrailerAutoplay` is on. Fed the already-resolved [stream] so it does
/// not re-extract; it loops, follows the [muted] flag, and pauses while the
/// trailer overlay is open or the app is backgrounded — the native counterpart
/// of the web `DetailHeroTrailer`. Sits below the hero scrims so the title stays
/// readable.
class DetailHeroVideo extends ConsumerStatefulWidget {
  const DetailHeroVideo({super.key, required this.stream, required this.muted});

  final TrailerStream stream;
  final bool muted;

  @override
  ConsumerState<DetailHeroVideo> createState() => _DetailHeroVideoState();
}

class _DetailHeroVideoState extends ConsumerState<DetailHeroVideo>
    with WidgetsBindingObserver {
  final Player _player = Player();
  late final VideoController _controller = VideoController(_player);
  bool _ready = false;
  bool _backgrounded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _player.setPlaylistMode(PlaylistMode.loop);
    _player.setVolume(widget.muted ? 0 : 100);
    _player.stream.buffering.listen((buffering) {
      if (!buffering && mounted && !_ready) setState(() => _ready = true);
    });
    _player.open(Media(widget.stream.url.toString()));
  }

  @override
  void didUpdateWidget(DetailHeroVideo old) {
    super.didUpdateWidget(old);
    if (old.muted != widget.muted) {
      _player.setVolume(widget.muted ? 0 : 100);
    }
    if (old.stream.url != widget.stream.url) {
      _ready = false;
      _player.open(Media(widget.stream.url.toString()));
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _backgrounded = state != AppLifecycleState.resumed;
    _apply();
  }

  bool get _wantsPlayback =>
      !_backgrounded && !ref.read(trailerOverlayOpenProvider);

  void _apply() => _wantsPlayback ? _player.play() : _player.pause();

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Pause/resume as the fullscreen overlay opens and closes.
    ref.listen(trailerOverlayOpenProvider, (_, _) => _apply());
    return AnimatedOpacity(
      opacity: _ready && _wantsPlayback ? 1 : 0,
      duration: const Duration(milliseconds: 700),
      child: Video(
        controller: _controller,
        fit: BoxFit.cover,
        controls: NoVideoControls,
      ),
    );
  }
}
