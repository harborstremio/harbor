import 'package:flutter/foundation.dart';

/// The lightweight position store, ported from `src/lib/player/playback-clock.ts`
/// (`docs/50` §2, "Position clock"). Position/buffer update ~4×/sec; routing
/// them through this store — instead of the heavy snapshot — lets only the
/// widgets that listen (the seek bar) rebuild, not the whole player tree.
///
/// Each field is a separate [ValueNotifier] so a listener rebuilds only when the
/// value it watches changes.
class PlaybackClock {
  final ValueNotifier<double> position = ValueNotifier(0);
  final ValueNotifier<double> buffered = ValueNotifier(0);

  /// P2P/download progress, 0..1.
  final ValueNotifier<double> downloaded = ValueNotifier(0);

  /// Updates the play position and buffered-ahead point (seconds).
  void set(double positionSec, double bufferedSec) {
    if (position.value != positionSec) position.value = positionSec;
    if (buffered.value != bufferedSec) buffered.value = bufferedSec;
  }

  void setDownloaded(double fraction) {
    final clamped = fraction < 0 ? 0.0 : (fraction > 1 ? 1.0 : fraction);
    if (downloaded.value != clamped) downloaded.value = clamped;
  }

  double get positionSec => position.value;
  double get bufferedSec => buffered.value;
  double get downloadedFraction => downloaded.value;

  /// Resets all fields to zero (on load of a new source).
  void reset() {
    position.value = 0;
    buffered.value = 0;
    downloaded.value = 0;
  }

  void dispose() {
    position.dispose();
    buffered.dispose();
    downloaded.dispose();
  }
}
