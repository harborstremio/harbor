import '../catalog/tmdb.dart';

/// A dated release on the calendar. Ported from `lib/calendar.ts` `CalendarItem`.
class CalendarItem {
  const CalendarItem({
    required this.id,
    this.imdbId,
    required this.type,
    required this.name,
    this.poster,
    this.background,
    required this.releaseDate,
    required this.isAnime,
    this.overview = '',
    this.voteAverage = 0,
  });

  final String id;
  final String? imdbId;
  final String type; // 'movie' | 'tv'
  final String name;
  final String? poster;
  final String? background;

  /// `YYYY-MM-DD`.
  final String releaseDate;
  final bool isAnime;
  final String overview;
  final double voteAverage;
}

enum CalendarFilter { all, movie, tv, anime }

const _animationGenre = 16;

String? _poster(Object? path) =>
    path is String && path.isNotEmpty ? '$tmdbImg/w342$path' : null;

String? _backdrop(Object? path) =>
    path is String && path.isNotEmpty ? '$tmdbImg/w780$path' : null;

/// A TMDB discover row is anime when it's animated **and** Japanese. Ports
/// `isAnimeRow`.
bool _isAnimeRow(Map<String, dynamic> row) {
  final genres = (row['genre_ids'] as List?)?.whereType<num>().map(
    (n) => n.toInt(),
  );
  final animation = genres?.contains(_animationGenre) ?? false;
  final japanese =
      row['original_language'] == 'ja' ||
      ((row['origin_country'] as List?)?.contains('JP') ?? false);
  return animation && japanese;
}

/// The `YYYY-MM-DD` prefix of a date string (the web `.slice(0, 10)`).
String calendarDate10(Object? v) {
  final s = (v ?? '').toString();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

/// The ISO date [iso] falls in [month] (1-12) of [year]. Ports `inMonth`.
bool calendarInMonth(String iso, int year, int month) {
  if (iso.isEmpty) return false;
  final parts = iso.split('-');
  if (parts.length < 2) return false;
  return int.tryParse(parts[0]) == year && int.tryParse(parts[1]) == month;
}

List<Map<String, dynamic>> _rows(Map<String, dynamic>? data) =>
    ((data?['results'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => e.cast<String, dynamic>())
        .toList();

/// Maps a TMDB discover/credit movie row to a [CalendarItem].
CalendarItem calendarMovieRowToItem(Map<String, dynamic> m) => CalendarItem(
  id: 'tmdb:movie:${m['id']}',
  type: 'movie',
  name: (m['title'] ?? m['original_title'] ?? 'Untitled').toString(),
  poster: _poster(m['poster_path']),
  background: _backdrop(m['backdrop_path']),
  releaseDate: calendarDate10(m['release_date']),
  isAnime: _isAnimeRow(m),
  overview: (m['overview'] ?? '').toString(),
  voteAverage: (m['vote_average'] as num?)?.toDouble() ?? 0,
);

/// Maps a TMDB discover/credit tv row to a [CalendarItem].
CalendarItem calendarTvRowToItem(Map<String, dynamic> s) => CalendarItem(
  id: 'tmdb:tv:${s['id']}',
  type: 'tv',
  name: (s['name'] ?? s['original_name'] ?? 'Untitled').toString(),
  poster: _poster(s['poster_path']),
  background: _backdrop(s['backdrop_path']),
  releaseDate: calendarDate10(s['first_air_date']),
  isAnime: _isAnimeRow(s),
  overview: (s['overview'] ?? '').toString(),
  voteAverage: (s['vote_average'] as num?)?.toDouble() ?? 0,
);

/// Whether [date] (a `YYYY-MM-DD…` string) falls within `[start, end]`.
bool calendarInRange(Object? date, String start, String end) {
  final d = calendarDate10(date);
  return d.isNotEmpty && d.compareTo(start) >= 0 && d.compareTo(end) <= 0;
}

/// Fetches the calendar for a `[start, end]` date window (`YYYY-MM-DD`) from
/// TMDB discover — two pages of movies + one page of `movie/upcoming` (filtered
/// into range) + two pages of TV — deduped by id and sorted by date. Ports
/// `fetchCalendarRange`.
Future<List<CalendarItem>> fetchCalendarRange(
  TmdbClient tmdb, {
  required String start,
  required String end,
  String region = '',
}) async {
  if (!tmdb.hasKey) return const [];

  Map<String, String> movieParams(int page) => {
    'primary_release_date.gte': start,
    'primary_release_date.lte': end,
    if (region.isNotEmpty) 'region': region,
    'sort_by': 'popularity.desc',
    'include_adult': 'false',
    'with_runtime.gte': '30',
    'page': '$page',
  };
  Map<String, String> tvParams(int page) => {
    'first_air_date.gte': start,
    'first_air_date.lte': end,
    'sort_by': 'popularity.desc',
    'include_adult': 'false',
    'page': '$page',
  };

  final results = await Future.wait([
    tmdb.get('discover/movie', movieParams(1)),
    tmdb.get('discover/movie', movieParams(2)),
    tmdb.get('movie/upcoming', {
      if (region.isNotEmpty) 'region': region,
      'page': '1',
    }),
    tmdb.get('discover/tv', tvParams(1)),
    tmdb.get('discover/tv', tvParams(2)),
  ]);

  final movieRows = [
    ..._rows(results[0]),
    ..._rows(results[1]),
    ..._rows(
      results[2],
    ).where((m) => calendarInRange(m['release_date'], start, end)),
  ];
  final tvRows = [..._rows(results[3]), ..._rows(results[4])];

  final items = <CalendarItem>[
    for (final m in movieRows)
      if (m['release_date'] != null && m['title'] != null)
        calendarMovieRowToItem(m),
    for (final s in tvRows)
      if (s['first_air_date'] != null && s['name'] != null)
        calendarTvRowToItem(s),
  ];

  final seen = <String>{};
  final deduped = <CalendarItem>[];
  for (final item in items) {
    if (seen.add(item.id)) deduped.add(item);
  }
  deduped.sort((a, b) => a.releaseDate.compareTo(b.releaseDate));
  return deduped;
}

/// Filters by the tab: `all`, `anime`, or non-anime `movie`/`tv`. Ports
/// `applyCalendarFilter`.
List<CalendarItem> applyCalendarFilter(
  List<CalendarItem> items,
  CalendarFilter filter,
) => switch (filter) {
  CalendarFilter.all => items,
  CalendarFilter.anime => [
    for (final i in items)
      if (i.isAnime) i,
  ],
  CalendarFilter.movie => [
    for (final i in items)
      if (i.type == 'movie' && !i.isAnime) i,
  ],
  CalendarFilter.tv => [
    for (final i in items)
      if (i.type == 'tv' && !i.isAnime) i,
  ],
};

/// The `(first, last)` ISO dates (`YYYY-MM-DD`) of [month] (1-12) in [year].
/// Ports `monthRangeISO`.
(String, String) monthRange(int year, int month) {
  final lastDay = DateTime(year, month + 1, 0).day;
  String pad(int n) => n.toString().padLeft(2, '0');
  final ym = '$year-${pad(month)}';
  return ('$ym-01', '$ym-${pad(lastDay)}');
}

/// Groups items by their `releaseDate`, preserving insertion order. Ports
/// `groupByDate`.
Map<String, List<CalendarItem>> groupByDate(List<CalendarItem> items) {
  final out = <String, List<CalendarItem>>{};
  for (final item in items) {
    if (item.releaseDate.isEmpty) continue;
    (out[item.releaseDate] ??= []).add(item);
  }
  return out;
}

const calendarMonthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const _weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/// The weekday header labels, rotated so Monday leads when [weekStartsMonday].
/// Ports `orderedWeekdayNames`.
List<String> orderedWeekdayNames(bool weekStartsMonday) => weekStartsMonday
    ? [..._weekdayNames.sublist(1), _weekdayNames.first]
    : _weekdayNames;

/// One day cell of the month grid.
class CalendarCell {
  const CalendarCell({
    required this.date,
    required this.iso,
    required this.inMonth,
  });
  final DateTime date;
  final String iso;
  final bool inMonth;
}

String _p2(int n) => n.toString().padLeft(2, '0');

/// The `YYYY-MM-DD` of a date.
String calendarIso(DateTime d) => '${d.year}-${_p2(d.month)}-${_p2(d.day)}';

/// The 42 cells (6 weeks) of a month grid for [month] (1-12) in [year], with
/// leading/trailing days from the neighbouring months. Ports `buildMonthCells`.
List<CalendarCell> buildMonthCells(
  int year,
  int month, {
  bool weekStartsMonday = false,
}) {
  final first = DateTime(year, month, 1);
  // Dart weekday is 1=Mon..7=Sun; the web uses 0=Sun..6=Sat.
  final firstDow = first.weekday % 7;
  final weekStart = weekStartsMonday ? 1 : 0;
  final leadOffset = (firstDow - weekStart + 7) % 7;
  final start = DateTime(year, month, 1 - leadOffset);
  return [
    for (var i = 0; i < 42; i++)
      if (DateTime(start.year, start.month, start.day + i) case final d)
        CalendarCell(date: d, iso: calendarIso(d), inMonth: d.month == month),
  ];
}

/// The base meta id for detail nav — strips a trailing `:season:episode` and
/// `:premiere`. Ports `calendarBaseId`.
String calendarBaseId(String id) => id
    .replaceFirst(RegExp(r':(\d+):(\d+)$'), '')
    .replaceFirst(RegExp(r':premiere$'), '');
