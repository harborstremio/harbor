import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// The metadata pushed to the OS media session (lock screen / Control Center /
/// Now Playing). Position is a snapshot; the OS interpolates from [playing] +
/// the elapsed time, so it need only be pushed on state changes and seeks.
class NowPlayingInfo {
  const NowPlayingInfo({
    required this.title,
    this.subtitle,
    this.durationSec = 0,
    this.positionSec = 0,
    this.playing = true,
    this.artworkUrl,
  });

  final String title;
  final String? subtitle;
  final double durationSec;
  final double positionSec;
  final bool playing;
  final String? artworkUrl;

  Map<String, dynamic> toArgs() => {
    'title': title,
    if (subtitle != null && subtitle!.isNotEmpty) 'subtitle': subtitle,
    'durationSec': durationSec,
    'positionSec': positionSec,
    'playing': playing,
    if (artworkUrl != null && artworkUrl!.isNotEmpty) 'artworkUrl': artworkUrl,
  };
}

/// A transport command originating from the OS media session.
enum RemoteCommand {
  play,
  pause,
  toggle,
  seekForward,
  seekBackward,
  next,
  previous,
  seekTo,
}

/// A parsed remote command, carrying the target position for [RemoteCommand.seekTo].
class RemoteCommandEvent {
  const RemoteCommandEvent(this.command, {this.positionSec});
  final RemoteCommand command;
  final double? positionSec;
}

const _commandByType = <String, RemoteCommand>{
  'play': RemoteCommand.play,
  'pause': RemoteCommand.pause,
  'toggle': RemoteCommand.toggle,
  'seekForward': RemoteCommand.seekForward,
  'seekBackward': RemoteCommand.seekBackward,
  'next': RemoteCommand.next,
  'previous': RemoteCommand.previous,
  'seekTo': RemoteCommand.seekTo,
};

/// Parses a `{type, position?}` message from the native `harbor/now_playing`
/// channel into a [RemoteCommandEvent], or null when the type is unknown.
RemoteCommandEvent? parseRemoteCommand(Object? args) {
  if (args is! Map) return null;
  final cmd = _commandByType[args['type']?.toString()];
  if (cmd == null) return null;
  return RemoteCommandEvent(
    cmd,
    positionSec: (args['position'] as num?)?.toDouble(),
  );
}

/// Bridges the player to the OS media session: pushes now-playing metadata and
/// relays lock-screen / notification / hardware-remote transport commands back
/// to the player. Backed by `MPNowPlayingInfoCenter`/`MPRemoteCommandCenter` on
/// iOS and `MediaSessionCompat` on Android. A no-op on platforms without the
/// native channel, so callers wire it unconditionally.
class NowPlayingService {
  NowPlayingService({MethodChannel? channel})
    : _channel = channel ?? const MethodChannel('harbor/now_playing');

  final MethodChannel _channel;

  /// Invoked when the OS media session issues a transport command.
  void Function(RemoteCommandEvent)? onCommand;

  bool get _supported =>
      defaultTargetPlatform == TargetPlatform.iOS ||
      defaultTargetPlatform == TargetPlatform.android;

  /// Begins relaying remote commands from the OS to [onCommand].
  void start() {
    if (!_supported) return;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'command') {
        final event = parseRemoteCommand(call.arguments);
        if (event != null) onCommand?.call(event);
      }
      return null;
    });
  }

  /// Pushes the current [info] to the OS now-playing center.
  Future<void> update(NowPlayingInfo info) async {
    if (!_supported) return;
    try {
      await _channel.invokeMethod('update', info.toArgs());
    } catch (_) {}
  }

  /// Tears down the now-playing entry and stops relaying commands.
  Future<void> clear() async {
    if (!_supported) return;
    try {
      await _channel.invokeMethod('clear');
    } catch (_) {}
    _channel.setMethodCallHandler(null);
  }
}
