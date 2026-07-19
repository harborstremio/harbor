import '../catalog/tmdb.dart';
import 'calendar.dart';

/// A person tracked for their upcoming credits. Ported from `TrackedPerson`.
class TrackedPerson {
  const TrackedPerson({required this.id, this.name = '', this.role = 'any'});
  final int id;
  final String name;
  final String role; // 'any' | 'acting' | 'directing'
}

/// A genre filter scoped to a media type.
class CustomGenre {
  const CustomGenre({
    required this.id,
    this.name = '',
    required this.mediaType,
  });
  final int id;
  final String name;
  final String mediaType; // 'movie' | 'tv'
}

/// A watch-provider filter.
class CustomProvider {
  const CustomProvider({required this.id, this.name = ''});
  final int id;
  final String name;
}

/// The custom-calendar filter set. Ported from `CustomCalendarFilters`.
class CustomCalendarFilters {
  const CustomCalendarFilters({
    this.trackedPeople = const [],
    this.genres = const [],
    this.watchProviders = const [],
    this.originCountries = const [],
    this.wantMovie = true,
    this.wantTv = true,
    this.wantAnime = true,
  });

  final List<TrackedPerson> trackedPeople;
  final List<CustomGenre> genres;
  final List<CustomProvider> watchProviders;
  final List<String> originCountries;
  final bool wantMovie;
  final bool wantTv;
  final bool wantAnime;
}

List<Map<String, dynamic>> _rows(Map<String, dynamic>? data) =>
    ((data?['results'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => e.cast<String, dynamic>())
        .toList();

Future<List<Map<String, dynamic>>> _personCredits(
  TmdbClient tmdb,
  int personId,
  String kind,
) async {
  final data = await tmdb.get('person/$personId/${kind}_credits');
  final cast = (data?['cast'] as List?) ?? const [];
  final crew = (data?['crew'] as List?) ?? const [];
  return [
    for (final r in [...cast, ...crew])
      if (r is Map) r.cast<String, dynamic>(),
  ];
}

/// A tracked person's movie + tv credits releasing within `[start, end]`.
/// Ports `fetchPersonUpcoming`.
Future<List<CalendarItem>> fetchPersonUpcoming(
  TmdbClient tmdb,
  TrackedPerson person,
  String start,
  String end,
) async {
  if (!tmdb.hasKey) return const [];
  final results = await Future.wait([
    _personCredits(tmdb, person.id, 'movie'),
    _personCredits(tmdb, person.id, 'tv'),
  ]);
  final items = <CalendarItem>[];
  final seen = <String>{};
  for (final m in results[0]) {
    if (!calendarInRange(m['release_date'], start, end)) continue;
    final item = calendarMovieRowToItem(m);
    if (seen.add(item.id)) items.add(item);
  }
  for (final s in results[1]) {
    if (!calendarInRange(s['first_air_date'], start, end)) continue;
    final item = calendarTvRowToItem(s);
    if (seen.add(item.id)) items.add(item);
  }
  return items;
}

/// A filtered TMDB discover query (genres / watch providers / origin
/// countries). Empty when no filter is set. Ports `discoverFiltered`.
Future<List<CalendarItem>> _discoverFiltered(
  TmdbClient tmdb, {
  required String start,
  required String end,
  required String region,
  required String kind, // 'movie' | 'tv'
  required List<int> genreIds,
  required List<int> providerIds,
  required List<String> countryCodes,
}) async {
  if (genreIds.isEmpty && providerIds.isEmpty && countryCodes.isEmpty) {
    return const [];
  }
  final params = <String, String>{
    'sort_by': 'popularity.desc',
    'include_adult': 'false',
    if (kind == 'movie') ...{
      'primary_release_date.gte': start,
      'primary_release_date.lte': end,
      if (region.isNotEmpty) 'region': region,
      'with_runtime.gte': '30',
    } else ...{
      'first_air_date.gte': start,
      'first_air_date.lte': end,
    },
    if (genreIds.isNotEmpty) 'with_genres': genreIds.join(','),
    if (providerIds.isNotEmpty) ...{
      'with_watch_providers': providerIds.join('|'),
      'watch_region': region.isNotEmpty ? region : 'US',
    },
    if (countryCodes.isNotEmpty) 'with_origin_country': countryCodes.join('|'),
  };
  final data = await tmdb.get('discover/$kind', params);
  return [
    for (final r in _rows(data))
      kind == 'movie' ? calendarMovieRowToItem(r) : calendarTvRowToItem(r),
  ];
}

/// The custom calendar: tracked-people credits + filtered discover, unioned
/// with any [extra] items (e.g. Trakt watchlist/anticipated), filtered by the
/// enabled media types, de-duped and sorted. Ports `fetchCustomCalendar`.
Future<List<CalendarItem>> fetchCustomCalendar(
  TmdbClient tmdb, {
  required String region,
  required CustomCalendarFilters filters,
  required String start,
  required String end,
  List<CalendarItem> extra = const [],
}) async {
  final movieGenres = [
    for (final g in filters.genres)
      if (g.mediaType == 'movie') g.id,
  ];
  final tvGenres = [
    for (final g in filters.genres)
      if (g.mediaType == 'tv') g.id,
  ];
  final providerIds = [for (final p in filters.watchProviders) p.id];

  final tasks = <Future<List<CalendarItem>>>[
    for (final p in filters.trackedPeople)
      fetchPersonUpcoming(tmdb, p, start, end),
  ];
  if (filters.wantMovie || filters.wantAnime) {
    tasks.add(
      _discoverFiltered(
        tmdb,
        start: start,
        end: end,
        region: region,
        kind: 'movie',
        genreIds: movieGenres,
        providerIds: providerIds,
        countryCodes: filters.originCountries,
      ),
    );
  }
  if (filters.wantTv || filters.wantAnime) {
    tasks.add(
      _discoverFiltered(
        tmdb,
        start: start,
        end: end,
        region: region,
        kind: 'tv',
        genreIds: tvGenres,
        providerIds: providerIds,
        countryCodes: filters.originCountries,
      ),
    );
  }
  final batches = await Future.wait(tasks);
  final all = [extra, ...batches].expand((b) => b);

  bool matches(CalendarItem i) {
    if (i.isAnime) return filters.wantAnime;
    if (i.type == 'movie') return filters.wantMovie;
    if (i.type == 'tv') return filters.wantTv;
    return false;
  }

  final seen = <String>{};
  final deduped = <CalendarItem>[];
  for (final item in all) {
    if (!matches(item) || !seen.add(item.id)) continue;
    deduped.add(item);
  }
  deduped.sort((a, b) => a.releaseDate.compareTo(b.releaseDate));
  return deduped;
}
