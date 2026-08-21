// IPTV preference readers over the settings blob. Ports `iptv/settings-bridge.ts`.

/// The preferred Xtream live-stream container. Ports `liveContainerPref`.
String iptvLiveContainerPref(Object? value) => value == 'm3u8' ? 'm3u8' : 'ts';

/// The global EPG time offset in hours (0 when unset/invalid). Ports
/// `epgOffsetHoursPref`.
double iptvEpgOffsetHoursPref(Object? value) =>
    value is num && value.isFinite ? value.toDouble() : 0;
