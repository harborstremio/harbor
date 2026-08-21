import '../../domain/i18n/translations.dart';

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// Whole days from today to [date] (a `YYYY-MM-DD…` string), or null when it
/// can't be parsed. Negative in the past. Ports the web `daysFromTodayLocal`.
int? daysFromToday(String? date, {DateTime? now}) {
  if (date == null) return null;
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(date);
  if (m == null) return null;
  final air = DateTime(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
  final n = now ?? DateTime.now();
  final today = DateTime(n.year, n.month, n.day);
  return air.difference(today).inDays;
}

/// Whether [date] is in the future (unaired) — the episode "Upcoming" cue.
bool isFutureDate(String? date, {DateTime? now}) {
  final d = daysFromToday(date, now: now);
  return d != null && d > 0;
}

/// Whether [date] aired within the last [withinDays] days — the episode "New"
/// cue. Ports the web `airedWithinDays` / `isNewEpisode`.
bool airedWithinDays(String? date, int withinDays, {DateTime? now}) {
  final d = daysFromToday(date, now: now);
  return d != null && d <= 0 && d >= -withinDays;
}

/// Whether a title has not been released yet — ports the web `isTitleUpcoming`.
/// With a [detail], the movie release / series first-air date wins (future =
/// upcoming); failing a date, an upcoming/unreleased/tba/planned/rumored status
/// counts. Without a detail, a `releaseInfo` year beyond the current one counts.
bool titleUpcoming({
  required bool hasDetail,
  String? kind,
  String? releaseDate,
  String? firstAirDate,
  String? status,
  String? metaReleaseInfo,
  DateTime? now,
}) {
  final n = now ?? DateTime.now();
  if (hasDetail) {
    final date = kind == 'movie' ? releaseDate : firstAirDate;
    if (date != null && date.isNotEmpty) {
      final d = daysFromToday(date, now: n);
      return d != null && d > 0;
    }
    final s = (status ?? '').toLowerCase();
    return s.contains('upcoming') ||
        s.contains('unreleased') ||
        s.contains('tba') ||
        s == 'planned' ||
        s == 'rumored';
  }
  if (metaReleaseInfo == null) return false;
  final m = RegExp(r'^(\d{4})').firstMatch(metaReleaseInfo);
  final year = m == null ? null : int.tryParse(m.group(1)!);
  return year != null && year > n.year;
}

/// The friendly countdown suffix for an upcoming [date] ("tomorrow", "in 3
/// days", "next week", "in 4wks", or a formatted date), or empty when the date
/// is today/past/unknown. Ports the web `upcomingDateLabel`.
String upcomingDateLabel(Translations tr, String? date, {DateTime? now}) {
  final d = daysFromToday(date, now: now);
  if (d == null || d <= 0) return '';
  if (d == 1) return tr.t('tomorrow');
  if (d < 7) return tr.t('in {d} days', {'d': d});
  if (d < 14) return tr.t('next week');
  if (d < 60) return tr.t('in {n}wks', {'n': (d / 7).round()});
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(date!);
  if (m == null) return '';
  final mo = int.parse(m[2]!);
  return '${_months[mo - 1]} ${int.parse(m[3]!)}, ${m[1]}';
}
