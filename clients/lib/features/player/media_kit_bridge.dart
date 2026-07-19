import 'dart:async';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../design/layout/idiom.dart';
import '../../domain/player/audio_filters.dart';
import '../../domain/player/hwdec.dart';
import '../../domain/player/playback_clock.dart';
import '../../domain/player/player_bridge.dart';
import '../../domain/player/player_capabilities.dart';
import '../../domain/player/player_models.dart';
import '../../domain/player/resolution_label.dart';
import '../../domain/player/subtitle_style.dart';
import 'flutter_player_bridge.dart';
import 'player_host_os.dart';

/// The advanced player engine, ported from the mpv bridge role in
/// `src/lib/player/mpv.ts` (`docs/50` §1). Backed by `media_kit` (libmpv):
/// plays exotic containers/codecs (mkv, HEVC, AV1), HDR, and ASS subtitles that
/// the default engine cannot. Position/buffer flow through the [clock]; the
/// heavier stream events push a snapshot.
class MediaKitBridge extends FlutterPlayerBridge {
  MediaKitBridge() {
    _controller = VideoController(_player);
  }

  final Player _player = Player();
  late final VideoController _controller;
  final PlaybackClock _clock = PlaybackClock();
  final List<void Function(PlayerSnapshot)> _listeners = [];
  final List<StreamSubscription<dynamic>> _subs = [];

  PlayerSnapshot _snap = PlayerSnapshot.empty;
  bool _loaded = false;
  bool _muted = false;
  double _preMuteVolume = 1;

  /// The HDR transfer badge (`PQ`/`HLG`/`''`) derived from mpv's
  /// `video-params/gamma`, refreshed whenever the frame dimensions change.
  String _hdrGamma = '';

  @override
  PlaybackClock get clock => _clock;

  @override
  PlayerSnapshot get snapshot => _snap;

  @override
  PlayerCapabilities capabilities() => computePlayerCapabilities(
    PlayerEngine.advanced,
    currentPlayerHostOs(),
    isTv: kPlatformIsTv ?? false,
  );

  @override
  void Function() subscribe(void Function(PlayerSnapshot) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  void _emit(PlayerSnapshot next) {
    if (next.differsIgnoringClock(_snap)) {
      _snap = next;
      for (final l in List.of(_listeners)) {
        l(next);
      }
    } else {
      _snap = next;
    }
  }

  @override
  Future<void> load(PlayerSource source) async {
    _clock.reset();
    _loaded = false;
    _emit(_snap.copyWith(status: PlayerStatus.loading, clearError: true));

    for (final s in _subs) {
      unawaited(s.cancel());
    }
    _subs.clear();
    _wireStreams();

    await _player.open(
      Media(source.url, httpHeaders: source.headers),
      play: false,
    );
    if (source.startAtSec != null && source.startAtSec! > 0) {
      await _player.seek(
        Duration(milliseconds: (source.startAtSec! * 1000).round()),
      );
    }
  }

  void _wireStreams() {
    final st = _player.stream;
    _subs.add(
      st.position.listen((p) {
        _clock.set(p.inMilliseconds / 1000, _clock.bufferedSec);
      }),
    );
    _subs.add(
      st.buffer.listen((b) {
        _clock.set(_clock.positionSec, b.inMilliseconds / 1000);
      }),
    );
    _subs.add(
      st.duration.listen((d) {
        if (d > Duration.zero) _loaded = true;
        _rebuild();
      }),
    );
    _subs.add(st.playing.listen((_) => _rebuild()));
    _subs.add(st.completed.listen((_) => _rebuild()));
    _subs.add(st.buffering.listen((_) => _rebuild()));
    _subs.add(st.volume.listen((_) => _rebuild()));
    _subs.add(st.rate.listen((_) => _rebuild()));
    _subs.add(st.width.listen((_) => _refreshHdrGamma()));
    _subs.add(st.height.listen((_) => _rebuild()));
    _subs.add(st.tracks.listen((_) => _rebuild()));
    _subs.add(st.track.listen((_) => _rebuild()));
    _subs.add(
      st.error.listen((e) {
        // Once the file has opened (a duration is known), a libmpv error is a
        // per-track/codec warning — an undecodable audio track like TrueHD on a
        // device without that decoder — and playback continues on the video and
        // the remaining tracks. Only a pre-load error means the file itself
        // cannot play, so only that is surfaced as fatal.
        if (_loaded) return;
        _emit(
          _snap.copyWith(
            status: PlayerStatus.error,
            errorMessage: e,
            errorCode: PlayerErrorCode.decode,
          ),
        );
      }),
    );
  }

  void _rebuild() {
    final s = _player.state;
    // A prior error only stays fatal while nothing has loaded; once the file
    // opens (a duration is known) it was a non-fatal track/codec warning, so
    // playback status takes over and the error overlay clears.
    final recovered = _snap.status == PlayerStatus.error && _loaded;
    final PlayerStatus status;
    if (_snap.status == PlayerStatus.error && !_loaded) {
      status = PlayerStatus.error;
    } else if (s.completed) {
      status = PlayerStatus.ended;
    } else if (s.playing) {
      status = PlayerStatus.playing;
    } else {
      status = _loaded ? PlayerStatus.paused : PlayerStatus.loading;
    }
    _emit(
      _snap.copyWith(
        status: status,
        clearError: recovered,
        durationSec: s.duration.inMilliseconds / 1000,
        buffering: s.buffering,
        volume: (s.volume / 100).clamp(0.0, 1.0),
        muted: _muted,
        rate: s.rate,
        videoWidth: s.width ?? 0,
        videoHeight: s.height ?? 0,
        hdrGamma: _hdrGamma,
        audioTracks: _mapAudio(s),
        subtitleTracks: _mapSubtitle(s),
      ),
    );
  }

  /// Reads mpv's `video-params/gamma` transfer function (async) into the cached
  /// HDR badge, then rebuilds — so the stats overlay shows PQ/HLG for real HDR.
  Future<void> _refreshHdrGamma() async {
    final platform = _player.platform;
    if (platform is NativePlayer) {
      try {
        _hdrGamma = hdrTransferLabel(
          await platform.getProperty('video-params/gamma'),
        );
      } catch (_) {
        _hdrGamma = '';
      }
    }
    _rebuild();
  }

  List<TrackInfo> _mapAudio(PlayerState s) => s.tracks.audio
      .where((a) => a.id != 'auto' && a.id != 'no')
      .map(
        (a) => TrackInfo(
          id: a.id,
          label: _trackLabel(a.title, a.language, 'Audio ${a.id}'),
          kind: 'audio',
          selected: a.id == s.track.audio.id,
          lang: a.language,
          title: a.title,
        ),
      )
      .toList();

  List<TrackInfo> _mapSubtitle(PlayerState s) => s.tracks.subtitle
      .where((t) => t.id != 'auto' && t.id != 'no')
      .map(
        (t) => TrackInfo(
          id: t.id,
          label: _trackLabel(t.title, t.language, 'Subtitle ${t.id}'),
          kind: 'subtitle',
          selected: t.id == s.track.subtitle.id,
          lang: t.language,
          title: t.title,
        ),
      )
      .toList();

  String _trackLabel(String? title, String? lang, String fallback) {
    final parts = [
      if (lang != null && lang.isNotEmpty) lang,
      if (title != null && title.isNotEmpty) title,
    ];
    return parts.isEmpty ? fallback : parts.join(' · ');
  }

  @override
  Future<void> play() async => _player.play();

  @override
  Future<void> pause() async => _player.pause();

  @override
  void seek(double sec) {
    final clamped = sec < 0 ? 0.0 : sec;
    _player.seek(Duration(milliseconds: (clamped * 1000).round()));
  }

  @override
  void setVolume(double v) {
    final clamped = v < 0 ? 0.0 : (v > 1 ? 1.0 : v);
    _muted = false;
    _player.setVolume(clamped * 100);
  }

  @override
  void setMuted(bool m) {
    if (m) {
      _preMuteVolume = _player.state.volume / 100;
      _player.setVolume(0);
    } else {
      _player.setVolume(_preMuteVolume * 100);
    }
    _muted = m;
    _rebuild();
  }

  @override
  void setRate(double r) {
    final clamped = r < 0.25 ? 0.25 : (r > 3 ? 3.0 : r);
    _player.setRate(clamped);
  }

  @override
  void setAudioTrack(String id) {
    final track = _player.state.tracks.audio.firstWhere(
      (a) => a.id == id,
      orElse: () => AudioTrack.auto(),
    );
    _player.setAudioTrack(track);
  }

  @override
  void setSubtitleTrack(String? id) {
    if (id == null) {
      _player.setSubtitleTrack(SubtitleTrack.no());
      return;
    }
    final track = _player.state.tracks.subtitle.firstWhere(
      (t) => t.id == id,
      orElse: () => SubtitleTrack.no(),
    );
    _player.setSubtitleTrack(track);
  }

  @override
  void setSubDelay(double sec) => _setMpvProperty('sub-delay', '$sec');

  @override
  void setAudioDelay(double sec) => _setMpvProperty('audio-delay', '$sec');

  @override
  void setSubVisible(bool on) =>
      _setMpvProperty('sub-visibility', on ? 'yes' : 'no');

  @override
  void setAbLoop(double? a, double? b) {
    // mpv loops natively between ab-loop-a/ab-loop-b ('no' clears the mark),
    // matching the web mpv-forward bridge.
    _setMpvProperty('ab-loop-a', a == null ? 'no' : '$a');
    _setMpvProperty('ab-loop-b', b == null ? 'no' : '$b');
  }

  @override
  void setVideoZoom(double log2) => _setMpvProperty('video-zoom', '$log2');

  @override
  void setPanscan(double value) => _setMpvProperty('panscan', '$value');

  @override
  void setAspectOverride(double? ratio) =>
      // -1 disables the override so mpv uses the source aspect.
      _setMpvProperty('video-aspect-override', ratio == null ? '-1' : '$ratio');

  @override
  void setStretch(bool on) =>
      // Stretch fills the window, so keepaspect must be off.
      _setMpvProperty('keepaspect', on ? 'no' : 'yes');

  // The loudness normalizer and the shaping profile share the mpv `af` chain,
  // so both are recombined and re-applied whenever either changes (mirroring
  // mpv.ts applyAudioFilters).
  bool _audioNormalize = false;
  String _audioProfile = 'off';

  void _applyAudioFilters() => _setMpvProperty(
    'af',
    compileAudioFilters(normalize: _audioNormalize, profile: _audioProfile),
  );

  @override
  void setAudioNormalize(bool on) {
    _audioNormalize = on;
    _applyAudioFilters();
  }

  @override
  void setAudioProfile(String profile) {
    _audioProfile = profile;
    _applyAudioFilters();
  }

  @override
  void setAnime4kShaders(List<String> shaders) {
    // mpv's `glsl-shaders` is an OS-path list: `;`-joined on Windows, `:`
    // elsewhere (matches mpv.ts). An empty value clears the chain.
    final sep = Platform.isWindows ? ';' : ':';
    final value = shaders.where((s) => s.isNotEmpty).join(sep);
    _setMpvProperty('glsl-shaders', value);
  }

  @override
  void setHwdec(String mode) {
    // Only "on"/"off" pin the property; "auto" leaves libmpv's own default.
    final value = hwdecMpvValue(mode);
    if (value != null) _setMpvProperty('hwdec', value);
  }

  @override
  void setMpvOptions(Map<String, String> options) {
    options.forEach(_setMpvProperty);
  }

  void _setMpvProperty(String name, String value) {
    final platform = _player.platform;
    if (platform is NativePlayer) {
      unawaited(platform.setProperty(name, value));
    }
  }

  void _command(List<String> cmd) {
    final platform = _player.platform;
    if (platform is NativePlayer) {
      unawaited(platform.command(cmd));
    }
  }

  @override
  void frameStep(int dir) =>
      // mpv's frame-accurate step-and-pause commands (the web `mpv.frameStep`).
      _command([dir > 0 ? 'frame-step' : 'frame-back-step']);

  @override
  Future<bool> addSubtitle(
    String url, {
    String? lang,
    String? title,
    bool select = false,
  }) async {
    await _player.setSubtitleTrack(
      SubtitleTrack.uri(url, title: title, language: lang),
    );
    return true;
  }

  @override
  Future<ScreenshotResult> screenshot(String path) async {
    try {
      // Video only, no burned-in subtitles — the web `playerScreenshot`.
      final bytes = await _player.screenshot(
        format: 'image/png',
        includeLibassSubtitles: false,
      );
      if (bytes == null) {
        return const ScreenshotResult(ok: false, error: 'no-frame');
      }
      final file = File(path);
      await file.parent.create(recursive: true);
      await file.writeAsBytes(bytes, flush: true);
      return ScreenshotResult(ok: true, path: path);
    } catch (e) {
      return ScreenshotResult(ok: false, error: e.toString());
    }
  }

  @override
  Widget buildView(SubtitleStyle style) => Video(
    controller: _controller,
    // Harbor draws its own player chrome (seek bar, timer, control row). Without
    // this, media_kit renders its built-in AdaptiveVideoControls on top, so the
    // seek bar + timer appear TWICE (stacked). NoVideoControls leaves only
    // Harbor's overlay.
    controls: NoVideoControls,
    fit: BoxFit.contain,
    subtitleViewConfiguration: _subtitleConfig(style),
  );

  SubtitleViewConfiguration _subtitleConfig(SubtitleStyle st) {
    Color? bg;
    List<Shadow>? shadows;
    switch (st.mode) {
      case 'box':
        bg = Color(st.boxArgb);
      case 'outline':
        final edge = Color(st.edgeArgb);
        final d = st.edgeSize > 0 ? st.edgeSize : 1.0;
        shadows = [
          Shadow(color: edge, offset: Offset(-d, -d)),
          Shadow(color: edge, offset: Offset(d, -d)),
          Shadow(color: edge, offset: Offset(-d, d)),
          Shadow(color: edge, offset: Offset(d, d)),
        ];
      case 'shadow':
        shadows = [
          Shadow(
            color: Color(st.edgeArgb),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ];
    }
    return SubtitleViewConfiguration(
      style: TextStyle(
        fontSize: st.fontSize,
        color: Color(st.colorArgb),
        fontWeight: st.bold ? FontWeight.w700 : FontWeight.w400,
        height: st.lineHeight,
        letterSpacing: st.letterSpacing,
        backgroundColor: bg,
        shadows: shadows,
      ),
      textAlign: switch (st.align) {
        'left' => TextAlign.left,
        'right' => TextAlign.right,
        _ => TextAlign.center,
      },
      padding: EdgeInsets.fromLTRB(16, 0, 16, st.marginBottom),
    );
  }

  @override
  Future<void> destroy() async {
    for (final s in _subs) {
      unawaited(s.cancel());
    }
    _subs.clear();
    _listeners.clear();
    _clock.dispose();
    await _player.dispose();
  }
}
