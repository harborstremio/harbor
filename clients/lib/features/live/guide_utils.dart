// Layout math for the Live TV guide (EPG timeline). Ported from
// `views/live/guide/guide-utils.ts`.

/// Horizontal pixels per minute of programme time.
const double pxPerMin = 5;

/// Horizontal pixels per millisecond of programme time.
const double pxPerMs = pxPerMin / 60000;

/// The channel-name column width.
const double channelColPx = 200;

/// The height of one channel row.
const double rowHeightPx = 76;

/// The time-ruler header height.
const double rulerHeightPx = 52;

/// How many hours the guide window spans.
const int windowHours = 8;

/// The total width of the time grid.
const double windowPx = windowHours * 60 * pxPerMin;

/// The visible window's start: [nowMs] minus [paddingBeforeMinutes], floored to
/// a 30-minute slot. Ports `startOfWindow`.
int startOfWindow(int nowMs, {int paddingBeforeMinutes = 60}) {
  const slotMs = 30 * 60000;
  return ((nowMs - paddingBeforeMinutes * 60000) / slotMs).floor() * slotMs;
}

/// Clips a programme's span to the visible window, or null if it falls entirely
/// outside. Ports `clampDuration`.
({int visibleStart, int visibleEnd})? clampDuration(
  int startMs,
  int endMs,
  int windowStart,
  int windowEnd,
) {
  final visibleStart = startMs > windowStart ? startMs : windowStart;
  final visibleEnd = endMs < windowEnd ? endMs : windowEnd;
  if (visibleEnd <= visibleStart) return null;
  return (visibleStart: visibleStart, visibleEnd: visibleEnd);
}

/// The left offset (px) of a time within the grid.
double offsetPxFor(int ms, int windowStart) => (ms - windowStart) * pxPerMs;

/// A local-time `h:mm AM/PM` label for a ruler tick. Ports the intent of
/// `formatTimeLabel` (hour numeric, minute 2-digit).
String formatTimeLabel(int ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms);
  final hour12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final minute = d.minute.toString().padLeft(2, '0');
  final period = d.hour < 12 ? 'AM' : 'PM';
  return '$hour12:$minute $period';
}
