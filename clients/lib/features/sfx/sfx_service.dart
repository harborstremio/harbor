import 'dart:async';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';

import '../../design/focus/ui_sound.dart';
import 'sfx_catalog.dart';

/// Plays Harbor's UI/volume sound effects — a Flutter port of the web
/// `SoundEffects` singleton. Renders each themed tone once (via [SfxCatalog]),
/// then retriggers cheaply through a small ring of [AudioPlayer]s.
///
/// The audio context is configured so the SFX **never request Android audio
/// focus** (`AndroidAudioFocus.none`) and share the app's `.playback` iOS
/// session with `mixWithOthers` — so tones layer over the video player's audio
/// without ducking or interrupting it (media_kit / native ExoPlayer/AVPlayer).
/// Every audio call is guarded: a platform that can't play (or an
/// AVR-passthrough TV that drops the secondary stream) degrades to silence,
/// never a crash.
class SfxService implements UiSoundSink {
  SfxService({SfxCatalog? catalog, int ringSize = 4})
    : _catalog = catalog ?? SfxCatalog(),
      _ringSize = ringSize;

  final SfxCatalog _catalog;
  final int _ringSize;
  final List<AudioPlayer> _ring = [];
  final List<String?> _loaded = [];
  int _next = 0;
  bool _inited = false;

  // Web lifecycle parity: activeTheme default 'none', currentVolume 0.5, muted.
  String _theme = 'none';
  double _volume = 0.5;
  bool _muted = false;

  static final AudioContext _audioContext = AudioContext(
    iOS: AudioContextIOS(
      category: AVAudioSessionCategory.playback,
      options: const {AVAudioSessionOptions.mixWithOthers},
    ),
    android: const AudioContextAndroid(
      contentType: AndroidContentType.sonification,
      usageType: AndroidUsageType.assistanceSonification,
      audioFocus: AndroidAudioFocus.none, // never steal focus → video never ducks
    ),
  );

  /// Builds the player ring + applies the mixing audio context. Idempotent and
  /// safe to call before any theme is set. No user gesture is required on native
  /// (unlike the browser AudioContext unlock the web version needs).
  Future<void> init() async {
    if (_inited) return;
    _inited = true;
    try {
      await AudioPlayer.global.setAudioContext(_audioContext);
    } catch (_) {
      /* global context set is best-effort */
    }
    for (var i = 0; i < _ringSize; i++) {
      final p = AudioPlayer();
      try {
        await p.setReleaseMode(ReleaseMode.stop);
        await p.setPlayerMode(PlayerMode.mediaPlayer);
        await p.setAudioContext(_audioContext);
      } catch (_) {
        /* a player that won't configure just won't be used successfully */
      }
      _ring.add(p);
      _loaded.add(null);
    }
  }

  String get theme => _theme;
  double get volume => _volume;
  bool get muted => _muted;

  void setTheme(String theme) {
    _theme = kSfxThemes.contains(theme) ? theme : 'none';
  }

  void setVolume(double v) {
    _volume = v.clamp(0.0, 1.0);
  }

  void setMuted(bool m) {
    _muted = m;
  }

  // Event sounds — each is a no-op when the theme is 'none' or muted, matching
  // the web per-method `if (activeTheme === 'none') return` guards.
  void volumeChange(bool isUp) => _play(SfxEvent.volumeChange, up: isUp);
  @override
  void click() => _play(SfxEvent.click);
  void hover() => _play(SfxEvent.hover);
  @override
  void open() => _play(SfxEvent.open);
  @override
  void close() => _play(SfxEvent.close);
  @override
  void navigate(String dir, {String soundType = 'light'}) => _play(
    SfxEvent.navigate,
    up: dir == 'up' || dir == 'left',
    soundType: soundType,
  );

  void _play(SfxEvent event, {bool up = true, String soundType = 'light'}) {
    if (!_inited || _theme == 'none' || _muted || _ring.isEmpty) return;
    final id = _catalog.idFor(_theme, event, up: up, soundType: soundType);
    if (id == null) return;
    final bytes = _catalog.wav(_theme, event, up: up, soundType: soundType);
    if (bytes == null) return;
    unawaited(_fire(id, bytes, _muted ? 0.0 : _volume));
  }

  Future<void> _fire(String id, Uint8List bytes, double gain) async {
    final i = _next;
    _next = (_next + 1) % _ring.length;
    final p = _ring[i];
    try {
      if (_loaded[i] != id) {
        await p.setSource(BytesSource(bytes));
        _loaded[i] = id;
      }
      await p.setVolume(gain);
      await p.seek(Duration.zero);
      await p.resume();
    } catch (_) {
      _loaded[i] = null; // a failed load/play resets so the slot retries later
    }
  }

  Future<void> dispose() async {
    for (final p in _ring) {
      try {
        await p.dispose();
      } catch (_) {
        /* ignore */
      }
    }
    _ring.clear();
    _loaded.clear();
    _inited = false;
  }
}
