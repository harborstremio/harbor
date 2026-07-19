/// A short relative-time label ("just now", "5m ago", "3d ago", …) for the
/// epoch-milliseconds [tsMs], measured against [now]. Empty for a null or zero
/// time. Ported 1:1 from `relativeTime` in `src/lib/dates.ts` (English-only,
/// matching the web).
String relativeTime(int? tsMs, DateTime now) {
  if (tsMs == null || tsMs == 0) return '';
  final sec = ((now.millisecondsSinceEpoch - tsMs) / 1000).round();
  if (sec < 45) return 'just now';
  final min = (sec / 60).round();
  if (min < 60) return '${min}m ago';
  final hr = (min / 60).round();
  if (hr < 24) return '${hr}h ago';
  final day = (hr / 24).round();
  if (day < 7) return '${day}d ago';
  final wk = (day / 7).round();
  if (wk < 5) return '${wk}w ago';
  final mo = (day / 30).round();
  if (mo < 12) return '${mo}mo ago';
  return '${(day / 365).round()}y ago';
}
