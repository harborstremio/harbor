import 'package:flutter/services.dart';

/// Native Picture-in-Picture: asks the Android Activity to shrink into a PiP
/// window so playback continues while the viewer uses other apps. Backed by the
/// `harbor/pip` MethodChannel (see MainActivity). iOS PiP needs the native
/// player layer and is not wired yet — the channel returns false there, so the
/// player only surfaces the control where it truly works. A thin wrapper so the
/// channel can be overridden in tests.
class PipService {
  const PipService([this.channel = const MethodChannel('harbor/pip')]);

  final MethodChannel channel;

  /// Whether this device can enter PiP (Android 8+ with the PiP system feature).
  Future<bool> isSupported() async {
    try {
      return await channel.invokeMethod<bool>('isSupported') ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Requests PiP; returns whether the Activity actually entered it.
  Future<bool> enterPip() async {
    try {
      return await channel.invokeMethod<bool>('enterPip') ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Tells the Activity whether the player is actively playing, so leaving the
  /// app (Home / recents) auto-enters PiP instead of pausing in the background.
  Future<void> setPlaying(bool playing) async {
    try {
      await channel.invokeMethod<void>('setPlaying', playing);
    } catch (_) {}
  }
}
