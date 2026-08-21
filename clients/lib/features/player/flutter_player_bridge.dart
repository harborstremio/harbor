import 'package:flutter/widgets.dart';

import '../../domain/player/playback_clock.dart';
import '../../domain/player/player_bridge.dart';
import '../../domain/player/subtitle_style.dart';

/// A [PlayerBridge] that renders through a Flutter widget (rather than the web
/// DOM host of the reference `attach(host)`). Both native engines — the
/// platform-video default and the libmpv advanced engine — expose their video
/// surface as a widget and carry the lightweight [clock].
abstract class FlutterPlayerBridge extends PlayerBridge {
  /// The lightweight position store this bridge feeds (~4×/sec).
  PlaybackClock get clock;

  /// The video surface widget to mount in the player view. [subtitleStyle]
  /// configures the engine's subtitle rendering from the `sub*` settings.
  Widget buildView(SubtitleStyle subtitleStyle);
}
