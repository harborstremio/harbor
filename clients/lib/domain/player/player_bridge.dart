import 'player_models.dart';

/// The result of a screenshot request.
class ScreenshotResult {
  const ScreenshotResult({required this.ok, this.path, this.error});
  final bool ok;
  final String? path;
  final String? error;
}

/// Media-session metadata for the OS now-playing surface.
class MediaInfo {
  const MediaInfo({required this.title, this.artist, this.artwork});
  final String title;
  final String? artist;
  final String? artwork;
}

/// A parsed subtitle cue (html5/default engine).
class SubCue {
  const SubCue({
    required this.startSec,
    required this.endSec,
    required this.text,
  });
  final double startSec;
  final double endSec;
  final String text;
}

/// The engine-agnostic player contract, ported from `PlayerBridge` in
/// `src/lib/player/bridge.ts` (`docs/50` §2). Core transport/track methods are
/// abstract; the advanced (mpv-only) operations default to no-ops so an engine
/// that cannot do them — the platform-video default engine — simply inherits the
/// correct "unsupported" behavior rather than stubbing each one.
abstract class PlayerBridge {
  /// The current snapshot (also pushed to [subscribe] listeners).
  PlayerSnapshot get snapshot;

  PlayerCapabilities capabilities();

  /// Subscribe to snapshot updates; returns an unsubscribe callback.
  void Function() subscribe(void Function(PlayerSnapshot) listener);

  Future<void> load(PlayerSource source);
  Future<void> play();
  Future<void> pause();
  void seek(double sec);
  void setVolume(double v);
  void setMuted(bool m);
  void setRate(double r);
  void setAudioTrack(String id);
  void setSubtitleTrack(String? id);

  Future<void> destroy();

  // --- advanced / optional operations (default engine inherits no-ops) -------

  /// Frame-accurate step + pause. Advanced engines override.
  void frameStep(int dir) {}

  /// Subtitle visibility (mpv `sub-visibility`).
  void setSubVisible(bool on) {}

  void setSubDelay(double sec) {}
  void setAudioDelay(double sec) {}
  void setPanscan(double value) {}
  void setVideoZoom(double log2) {}
  void setAspectOverride(double? ratio) {}
  void setStretch(bool on) {}
  void setVideoEq(String name, double value) {}
  void setAnime4kShaders(List<String> shaders) {}
  void setAudioNormalize(bool on) {}
  void setAudioProfile(String profile) {}
  void setAudioDevice(String name) {}

  /// Hardware decoding mode (`mpvHwdec`: on | off | auto). Advanced engines map
  /// it to the mpv `hwdec` property; the default engine decodes natively.
  void setHwdec(String mode) {}

  /// The compiled mpv `key=value` options (quality preset, buffer, downmix,
  /// tweaks…). Advanced engines set each property; the default engine ignores
  /// them.
  void setMpvOptions(Map<String, String> options) {}
  void setMediaInfo(MediaInfo info) {}
  void setAbLoop(double? a, double? b) {}

  /// Add an external subtitle track; returns whether it was added.
  Future<bool> addSubtitle(
    String url, {
    String? lang,
    String? title,
    bool select = false,
  }) async => false;

  /// Parsed cues of the selected external subtitle (default engine) or null.
  List<SubCue>? getSelectedTrackCues() => null;

  /// URL of the selected external subtitle, or null.
  String? getSelectedTrackUrl() => null;

  Future<ScreenshotResult> screenshot(String path) async =>
      const ScreenshotResult(ok: false, error: 'unsupported');

  Future<void> requestPiP() async {}
  Future<void> exitPiP() async {}
  Future<void> requestFullscreen() async {}
  Future<void> exitFullscreen() async {}
}
