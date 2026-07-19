/// The Shows hero's day-part, ported 1:1 from `dayBucket` in
/// `views/shows/hero-curation.ts`.
enum DayBucket { morning, afternoon, evening, night }

DayBucket dayBucket(DateTime now) {
  final h = now.hour;
  if (h >= 5 && h < 12) return DayBucket.morning;
  if (h >= 12 && h < 17) return DayBucket.afternoon;
  if (h >= 17 && h < 22) return DayBucket.evening;
  return DayBucket.night;
}

const _bucketIndex = {
  DayBucket.morning: 0,
  DayBucket.afternoon: 1,
  DayBucket.evening: 2,
  DayBucket.night: 3,
};

/// The rotating eyebrow ("kicker") variants per day-part, ported 1:1 from
/// `BUCKET_VARIANTS` (the kicker of each variant).
const _kickers = <DayBucket, List<String>>{
  DayBucket.morning: [
    'Morning Lineup',
    'Good Morning',
    'Daybreak',
    'AM Picks',
    'Open the Day',
    'Quiet Hours',
    'This Morning',
  ],
  DayBucket.afternoon: [
    'Afternoon Picks',
    'Midday Lineup',
    'Afternoon Roll',
    'The Long Lunch',
    'Daylight Watching',
    'Holdover Picks',
    'PM Picks',
  ],
  DayBucket.evening: [
    'Tonight',
    'Prime Time',
    'Sundown',
    'Press Play',
    "Tonight's Slate",
    'Showtime',
    'Saved for Now',
  ],
  DayBucket.night: [
    'Late Night',
    'Past Midnight',
    'Witching Hour',
    'Lights Out',
    'Insomnia Lineup',
    'Late Show',
    'Night Owl',
  ],
};

// 1-based day-of-year, matching web's `new Date(year, 0, 0)` start (Dec 31 of
// the previous year; `DateTime(year, 1, 0)` normalizes to the same day).
int _dayOfYear(DateTime d) => d.difference(DateTime(d.year, 1, 0)).inDays;

/// The Shows hero eyebrow — the day-part kicker that rotates by day-of-year.
/// Ported 1:1 from `bucketCopy().kicker` (Shows uses this day-bucketed copy
/// where Movies uses a fixed "Featured tonight").
String showHeroKicker([DateTime? now]) {
  final d = now ?? DateTime.now();
  final bucket = dayBucket(d);
  final variants = _kickers[bucket]!;
  final idx = (_dayOfYear(d) + _bucketIndex[bucket]! * 3) % variants.length;
  return variants[idx];
}
