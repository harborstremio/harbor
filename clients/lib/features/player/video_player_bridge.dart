import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../../design/layout/idiom.dart';
import '../../domain/player/local_source.dart';
import '../../domain/player/playback_clock.dart';
import '../../domain/player/player_capabilities.dart';
import '../../domain/player/player_models.dart';
import '../../domain/player/subtitle_style.dart';
import 'flutter_player_bridge.dart';
import 'player_host_os.dart';

/// The default player engine, ported from the html5 bridge role in
/// `src/lib/player/html5/bridge.ts` (`docs/50` §1). Backed by `video_player`
/// (ExoPlayer/media3 on Android & Android TV, AVPlayer on iOS/tvOS). Handles the
/// common web-ready containers; exotic codecs / ASS subs / HDR are the advanced
/// engine's job. Position/buffer flow through the [clock]; only non-clock
/// changes push a heavy snapshot.
class VideoPlayerBridge extends FlutterPlayerBridge {
  VideoPlayerBridge({
    VideoPlayerController Function(PlayerSource)? controllerFactory,
  }) : _controllerFactory = controllerFactory ?? _defaultController;

  final VideoPlayerController Function(PlayerSource) _controllerFactory;

  static VideoPlayerController _defaultController(PlayerSource source) {
    // A finished download plays back from an on-device file: its `url` is a raw
    // absolute path (or a file: URI), not an http(s) stream. `networkUrl` fails
    // on such paths — on iOS/AVPlayer a path containing a space (the app's
    // "Harbor Downloads" dir) makes `URL(string:)` return nil, so offline
    // playback never starts. Route local sources through `.file` instead.
    if (isLocalMediaUrl(source.url)) {
      final uri = Uri.tryParse(source.url);
      return VideoPlayerController.file(
        File(uri?.scheme == 'file' ? uri!.toFilePath() : source.url),
      );
    }
    return VideoPlayerController.networkUrl(
      Uri.parse(source.url),
      httpHeaders: source.headers ?? const {},
    );
  }

  final PlaybackClock _clock = PlaybackClock();
  final List<void Function(PlayerSnapshot)> _listeners = [];
  VideoPlayerController? _controller;
  PlayerSnapshot _snap = PlayerSnapshot.empty;
  double _preMuteVolume = 1;

  @override
  PlaybackClock get clock => _clock;

  @override
  PlayerSnapshot get snapshot => _snap;

  @override
  PlayerCapabilities capabilities() => computePlayerCapabilities(
    PlayerEngine.defaultEngine,
    currentPlayerHostOs(),
    isTv: kPlatformIsTv ?? false,
  );

  @override
  void Function() subscribe(void Function(PlayerSnapshot) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  void _emit(PlayerSnapshot next) {
    _snap = next;
    for (final l in List.of(_listeners)) {
      l(next);
    }
  }

  @override
  Future<void> load(PlayerSource source) async {
    await _controller?.dispose();
    _clock.reset();
    _emit(_snap.copyWith(status: PlayerStatus.loading, clearError: true));

    final c = _controllerFactory(source);
    _controller = c;
    c.addListener(_onValue);
    try {
      await c.initialize();
    } catch (e) {
      _emit(
        _snap.copyWith(
          status: PlayerStatus.error,
          errorMessage: e.toString(),
          errorCode: PlayerErrorCode.source,
        ),
      );
      return;
    }
    if (source.startAtSec != null && source.startAtSec! > 0) {
      await c.seekTo(
        Duration(milliseconds: (source.startAtSec! * 1000).round()),
      );
    }
    _emit(
      _snap.copyWith(
        status: PlayerStatus.ready,
        durationSec: c.value.duration.inMilliseconds / 1000,
        videoWidth: c.value.size.width.toInt(),
        videoHeight: c.value.size.height.toInt(),
      ),
    );
  }

  void _onValue() {
    final c = _controller;
    if (c == null) return;
    final v = c.value;
    final posSec = v.position.inMilliseconds / 1000;
    final bufSec = v.buffered.isNotEmpty
        ? v.buffered.last.end.inMilliseconds / 1000
        : 0.0;
    _clock.set(posSec, bufSec);

    final PlayerStatus status;
    if (v.hasError) {
      status = PlayerStatus.error;
    } else if (!v.isInitialized) {
      status = PlayerStatus.loading;
    } else if (v.isCompleted) {
      status = PlayerStatus.ended;
    } else if (v.isPlaying) {
      status = PlayerStatus.playing;
    } else {
      status = posSec <= 0 ? PlayerStatus.ready : PlayerStatus.paused;
    }

    final next = _snap.copyWith(
      status: status,
      positionSec: posSec,
      durationSec: v.duration.inMilliseconds / 1000,
      bufferedSec: bufSec,
      buffering: v.isBuffering,
      volume: v.volume,
      rate: v.playbackSpeed,
      videoWidth: v.size.width.toInt(),
      videoHeight: v.size.height.toInt(),
      errorMessage: v.hasError ? v.errorDescription : null,
      errorCode: v.hasError ? PlayerErrorCode.decode : null,
    );
    if (next.differsIgnoringClock(_snap)) {
      _emit(next);
    } else {
      _snap = next; // keep clock fields current without a heavy re-render
    }
  }

  @override
  Future<void> play() async => _controller?.play();

  @override
  Future<void> pause() async => _controller?.pause();

  @override
  void seek(double sec) {
    final clamped = sec < 0 ? 0.0 : sec;
    _controller?.seekTo(Duration(milliseconds: (clamped * 1000).round()));
  }

  @override
  void frameStep(int dir) {
    // The default engine has no frame API, so step by a nominal frame and pause
    // — ported 1:1 from the html5 engine's `frameStep` in `player/html5/bridge`.
    final c = _controller;
    if (c == null) return;
    c.pause();
    const frame = 1 / 24;
    final pos = c.value.position.inMilliseconds / 1000;
    final durSec = c.value.duration.inMilliseconds / 1000;
    final hi = durSec > 0 ? durSec - 0.05 : pos + frame;
    final target = (pos + dir * frame).clamp(0.0, hi);
    c.seekTo(Duration(milliseconds: (target * 1000).round()));
  }

  @override
  void setVolume(double v) {
    final clamped = v < 0 ? 0.0 : (v > 1 ? 1.0 : v);
    _controller?.setVolume(clamped);
  }

  @override
  void setMuted(bool m) {
    if (m) {
      _preMuteVolume = _controller?.value.volume ?? 1;
      _controller?.setVolume(0);
    } else {
      _controller?.setVolume(_preMuteVolume);
    }
    _emit(_snap.copyWith(muted: m));
  }

  @override
  void setRate(double r) {
    final clamped = r < 0.25 ? 0.25 : (r > 3 ? 3.0 : r);
    _controller?.setPlaybackSpeed(clamped);
  }

  // The default engine does not expose per-track selection (advanced engine's
  // job), so track selection is a no-op and track lists stay empty.
  @override
  void setAudioTrack(String id) {}

  @override
  void setSubtitleTrack(String? id) {}

  @override
  Widget buildView(SubtitleStyle subtitleStyle) {
    // The default engine has no custom subtitle overlay; the style applies to
    // the advanced (media_kit) engine.
    final c = _controller;
    if (c == null || !c.value.isInitialized) {
      return const ColoredBox(color: Color(0xFF000000));
    }
    return Center(
      child: AspectRatio(
        aspectRatio: c.value.aspectRatio,
        child: VideoPlayer(c),
      ),
    );
  }

  @override
  Future<void> destroy() async {
    _controller?.removeListener(_onValue);
    await _controller?.dispose();
    _controller = null;
    _listeners.clear();
    _clock.dispose();
  }
}
