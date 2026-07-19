import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../design/layout/idiom.dart';

/// The rotate-to-landscape + immersive-bars behaviour shared by the player and
/// the instant-play connecting screen, so the two are visually seamless. A no-op
/// on the TV (already landscape, must not rotate) and the desktop.

const _orientationChannel = MethodChannel('harbor/orientation');

/// True on iOS/Android handhelds — where rotate-to-landscape is meaningful. The
/// TV ([kPlatformIsTv]) is excluded (already landscape); the desktop has no such
/// concept.
bool get isMobileOs =>
    kPlatformIsTv != true &&
    (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.android);

/// Whether a "re-allow every orientation" pass is queued for a later frame, so a
/// player/connecting hand-off (exit → enter in quick succession) doesn't widen
/// the incoming screen out of its landscape lock. Module-scoped so it carries
/// across the exiting widget's disposal.
bool _orientationRestorePending = false;

/// iOS also needs an app-level lock (via the native `harbor/orientation`
/// channel + `UIRequiresFullScreen`), because a multitasking-capable iPad
/// ignores `setPreferredOrientations` alone. A no-op on other platforms.
void _setNativeLandscapeLock(bool lock) {
  if (defaultTargetPlatform != TargetPlatform.iOS) return;
  unawaited(
    _orientationChannel
        .invokeMethod<void>(lock ? 'lockLandscape' : 'unlock')
        .catchError((Object _) {}),
  );
}

/// Rotates to landscape (so the video fills the wider axis) and hides the
/// status/nav bars.
void enterImmersiveLandscape() {
  if (!isMobileOs) return;
  _orientationRestorePending = false;
  SystemChrome.setPreferredOrientations(const [
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  _setNativeLandscapeLock(true);
}

/// Restores portrait and the normal bars — symmetric with [enterImmersiveLandscape].
void exitImmersiveLandscape() {
  if (!isMobileOs) return;
  // Force portrait first (only portrait allowed) so the interface actually
  // rotates back — merely *allowing* every orientation never drives a rotation
  // without a device-motion event (so it would stay landscape, notably on the
  // Simulator, which has no accelerometer). Once portrait has been requested,
  // re-allow every orientation on the next frame (a post-frame callback, not a
  // Timer, so nothing dangles), unless a new screen has meanwhile re-locked
  // landscape.
  SystemChrome.setPreferredOrientations(const [DeviceOrientation.portraitUp]);
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  _setNativeLandscapeLock(false);
  _orientationRestorePending = true;
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!_orientationRestorePending) return;
    _orientationRestorePending = false;
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
  });
}
