import 'dart:io';

import '../../domain/player/player_capabilities.dart';

/// The [PlayerHostOs] the app is running on, from `dart:io`. `Platform.isIOS`
/// covers iOS / iPadOS / tvOS (all the Apple mobile family), so they share
/// [PlayerHostOs.iosFamily]. Only reached on the native (non-web) engines.
PlayerHostOs currentPlayerHostOs() {
  if (Platform.isIOS) return PlayerHostOs.iosFamily;
  if (Platform.isAndroid) return PlayerHostOs.android;
  if (Platform.isMacOS) return PlayerHostOs.macos;
  if (Platform.isWindows) return PlayerHostOs.windows;
  if (Platform.isLinux) return PlayerHostOs.linux;
  return PlayerHostOs.unknown;
}
