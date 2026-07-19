/// Derives skip segments from media chapters by classifying their titles,
/// ported from `src/lib/skip-intro/chapters.ts`.
library;

import '../player/player_models.dart';
import 'skip_segment.dart';

final List<RegExp> _introPatterns = [
  RegExp(r'\b(opening|op)\b', caseSensitive: false),
  RegExp(r'\bintro\b', caseSensitive: false),
  RegExp(r'\bopening\s*credits\b', caseSensitive: false),
  RegExp(r'\btheme\s*song\b', caseSensitive: false),
];
final List<RegExp> _outroPatterns = [
  RegExp(r'\b(ending|ed)\b', caseSensitive: false),
  RegExp(r'\b(outro|outtro)\b', caseSensitive: false),
  RegExp(r'\bend\s*credits?\b', caseSensitive: false),
  RegExp(r'\bclosing\s*credits?\b', caseSensitive: false),
  RegExp(r'\bcredits?\b', caseSensitive: false),
];
final List<RegExp> _recapPatterns = [
  RegExp(r'\b(recap|previously)\b', caseSensitive: false),
];

SkipKind? _classify(String? title) {
  if (title == null || title.isEmpty) return null;
  for (final r in _recapPatterns) {
    if (r.hasMatch(title)) return SkipKind.recap;
  }
  for (final r in _introPatterns) {
    if (r.hasMatch(title)) return SkipKind.intro;
  }
  for (final r in _outroPatterns) {
    if (r.hasMatch(title)) return SkipKind.outro;
  }
  return null;
}

/// Converts classified chapters into skip segments (a chapter runs until the
/// next chapter, or +90s / duration for the last).
List<SkipSegment> chaptersToSegments(
  List<Chapter> chapters,
  double durationSec,
) {
  if (chapters.isEmpty) return const [];
  final sorted = [...chapters]
    ..sort((a, b) => a.startSec.compareTo(b.startSec));
  final out = <SkipSegment>[];
  for (var i = 0; i < sorted.length; i++) {
    final c = sorted[i];
    final kind = _classify(c.title);
    if (kind == null) continue;
    final endSec = i + 1 < sorted.length
        ? sorted[i + 1].startSec
        : (durationSec > 0 ? durationSec : c.startSec + 90);
    if (endSec <= c.startSec) continue;
    out.add(
      SkipSegment(
        kind: kind,
        startSec: c.startSec,
        endSec: endSec,
        source: SkipSource.chapters,
      ),
    );
  }
  return out;
}
