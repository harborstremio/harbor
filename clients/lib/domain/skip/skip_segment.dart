/// Skip-segment model + merge/filter/active logic, ported from
/// `src/lib/skip-intro/index.ts` + `types.ts` (`docs/50` §15).
library;

enum SkipKind { intro, outro, recap, ad }

enum SkipSource { aniskip, introdb, chapters, adcorpus }

/// A skippable span (intro/recap/outro/ad) with its source.
class SkipSegment {
  const SkipSegment({
    required this.kind,
    required this.startSec,
    required this.endSec,
    required this.source,
  });

  final SkipKind kind;
  final double startSec;
  final double endSec;
  final SkipSource source;

  SkipSegment copyWith({double? endSec}) => SkipSegment(
    kind: kind,
    startSec: startSec,
    endSec: endSec ?? this.endSec,
    source: source,
  );
}

const double kMinOutroStartFraction = 0.5;
const double kMaxSegmentSec = 360;

/// The current segment ends 0.75s early so it doesn't immediately re-trigger.
const double kActiveEndGuardSec = 0.75;

/// Merges prioritized source lists, dropping any segment that overlaps an
/// already-accepted one, then sorts by start.
List<SkipSegment> mergeSegments(List<List<SkipSegment>> sourcesInPriority) {
  final merged = <SkipSegment>[];
  for (final list in sourcesInPriority) {
    for (final segment in list) {
      final overlaps = merged.any(
        (e) => segment.startSec < e.endSec && segment.endSec > e.startSec,
      );
      if (!overlaps) merged.add(segment);
    }
  }
  merged.sort((a, b) => a.startSec.compareTo(b.startSec));
  return merged;
}

/// Applies the length (2..360s), start-in-bounds, end-clamp, and
/// outro-after-50% filters to [merged].
List<SkipSegment> filterSegments(List<SkipSegment> merged, double durationSec) {
  if (durationSec <= 0) return merged;
  final minOutroStart = durationSec * kMinOutroStartFraction;
  return merged
      .where((s) => s.startSec < durationSec)
      .map((s) => s.endSec > durationSec ? s.copyWith(endSec: durationSec) : s)
      .where((s) {
        final len = s.endSec - s.startSec;
        return len >= 2 && len <= kMaxSegmentSec;
      })
      .where((s) => s.kind != SkipKind.outro || s.startSec >= minOutroStart)
      .toList();
}

/// The currently-active segment at [positionSec], or null. Ends
/// [kActiveEndGuardSec] early to avoid re-triggering right after a skip.
SkipSegment? activeSegment(List<SkipSegment> segments, double positionSec) {
  for (final s in segments) {
    if (positionSec >= s.startSec &&
        positionSec < s.endSec - kActiveEndGuardSec) {
      return s;
    }
  }
  return null;
}

/// The skip segment whose pill should be on screen at [positionSec], or null.
/// A pill shows only when the feature is on ([showButton]), a segment is active,
/// it has not auto-hidden after [hideSec] (0 = never), and it has not been
/// [dismissed]. The player renders it and lets the TV remote's OK act on it.
SkipSegment? visibleSkipSegment(
  List<SkipSegment> segments,
  double positionSec, {
  required bool showButton,
  required int hideSec,
  required bool Function(SkipSegment) dismissed,
}) {
  if (segments.isEmpty || !showButton) return null;
  final seg = activeSegment(segments, positionSec);
  if (seg == null) return null;
  if (hideSec > 0 && positionSec >= seg.startSec + hideSec) return null;
  if (dismissed(seg)) return null;
  return seg;
}
