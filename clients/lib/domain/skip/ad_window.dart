/// The injected-ad window, ported 1:1 from web `src/lib/ad-report/window.ts`.
/// Ad reporting and the (unprompted) corpus fetch are only offered for recent
/// releases, since injected ads appear on fresh cam/web rips.
library;

const int _adWindowDays = 150;
const int _dayMs = 24 * 60 * 60 * 1000;

/// Whether a title is inside the injected-ad window: released within the last
/// 150 days (by [releaseDate]), or — lacking a parseable date — [releaseInfo]
/// carries a year no older than last year. [now] is injectable for tests.
bool withinAdWindow({String? releaseDate, String? releaseInfo, DateTime? now}) {
  final clock = now ?? DateTime.now();
  if (releaseDate != null && releaseDate.isNotEmpty) {
    final t = DateTime.tryParse(releaseDate);
    if (t != null) {
      return clock.difference(t).inMilliseconds <= _adWindowDays * _dayMs;
    }
  }
  final m = RegExp(r'\d{4}').firstMatch(releaseInfo ?? '');
  if (m == null) return false;
  return int.parse(m.group(0)!) >= clock.year - 1;
}
