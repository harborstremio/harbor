import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The live AirPlay output state, streamed from the iOS audio route: whether a
/// route is engaged and, if so, the device's name.
class AirPlayState {
  const AirPlayState({required this.active, required this.deviceName});

  final bool active;
  final String deviceName;

  static const inactive = AirPlayState(active: false, deviceName: '');

  @override
  bool operator ==(Object other) =>
      other is AirPlayState &&
      other.active == active &&
      other.deviceName == deviceName;

  @override
  int get hashCode => Object.hash(active, deviceName);
}

/// Parses a `{active, name}` event from the native `harbor/airplay_state`
/// channel into an [AirPlayState]; anything malformed reads as [inactive].
AirPlayState parseAirPlayEvent(Object? event) {
  if (event is Map) {
    return AirPlayState(
      active: event['active'] == true,
      deviceName: (event['name'] ?? '').toString(),
    );
  }
  return AirPlayState.inactive;
}

const _airPlayStateChannel = EventChannel('harbor/airplay_state');

/// The stream of AirPlay states — the native EventChannel on iOS, a single
/// inactive value elsewhere (no AirPlay concept off Apple).
Stream<AirPlayState> airPlayStateStream() {
  if (defaultTargetPlatform != TargetPlatform.iOS) {
    return Stream.value(AirPlayState.inactive);
  }
  return _airPlayStateChannel.receiveBroadcastStream().map(parseAirPlayEvent);
}

/// The current AirPlay connection state for the player chrome.
final airPlayStateProvider = StreamProvider<AirPlayState>(
  (ref) => airPlayStateStream(),
);
