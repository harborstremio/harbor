import '../addons/models.dart';
import '../catalog/tmdb.dart';

/// One Arabic home row: a label plus its paged TMDB fetcher. Ported 1:1 from the
/// web `ArabicRowDef` set (`src/lib/arabic/rows.ts` + `classics.ts` + `index.ts`).
class ArabicRowSpec {
  const ArabicRowSpec({
    required this.id,
    required this.title,
    required this.type,
    required this.fetcher,
  });

  final String id;

  /// The English display label (the web keys these off i18n `titleKey`; the
  /// Arabic UI shows the localized "Arabic …" phrasing).
  final String title;

  /// The row's content type — `movie` or `series`.
  final String type;
  final Future<List<MetaPreview>> Function(int page) fetcher;
}

const String _arLang = 'ar-SA';
const List<int> _ramadanYears = [2026, 2025];
const String _gulfCountries = 'SA|AE|KW|QA|BH|OM';
const int _tmdbGenreDrama = 18; // TMDB Drama (movie + tv)
const int _tmdbGenreComedy = 35; // TMDB Comedy (movie + tv)

/// The shared `discover` params for Arabic-original content, ported from the web
/// `arParams`: Arabic language + original-language filter, popularity-sorted.
Map<String, String> _arParams(Map<String, String> extra) => {
  'language': _arLang,
  'with_original_language': 'ar',
  'sort_by': 'popularity.desc',
  ...extra,
};

/// 18 months before [now] as `YYYY-MM-DD` — the recency floor for the trending
/// row (ports the web `trendingSince`).
String _trendingSince(DateTime now) {
  final d = DateTime(now.year, now.month - 18, now.day);
  return d.toIso8601String().substring(0, 10);
}

/// The curated Egyptian film classics, resolved by title+year search (they
/// predate reliable original-language tagging). Ported from `EGYPTIAN_CLASSICS`.
const List<({String title, int year})> egyptianClassics = [
  (title: 'Cairo Station', year: 1958),
  (title: 'The Land', year: 1969),
  (title: 'The Beginning and the End', year: 1960),
  (title: 'The Night of Counting the Years', year: 1969),
  (title: "The Nightingale's Prayer", year: 1959),
  (title: 'Struggle in the Valley', year: 1954),
  (title: 'Cairo 30', year: 1966),
  (title: 'The Sin', year: 1965),
  (title: 'The Yacoubian Building', year: 2006),
  (title: 'The Blue Elephant', year: 2014),
];

Future<List<MetaPreview>> _fetchEgyptianClassics(TmdbClient client) async {
  final resolved = await Future.wait(
    egyptianClassics.map(
      (c) => client
          .searchTitle('movie', c.title, year: c.year)
          .catchError((_) => null),
    ),
  );
  final seen = <String>{};
  final out = <MetaPreview>[];
  for (final m in resolved) {
    if (m == null || !seen.add(m.id)) continue;
    out.add(m);
  }
  return out;
}

/// The Arabic home rows, bound to a TMDB [client]. Order and queries port
/// `ARABIC_ROWS` 1:1. Inject [clock] for tests.
List<ArabicRowSpec> arabicRowSpecs(
  TmdbClient client, {
  DateTime Function() clock = DateTime.now,
}) => [
  ArabicRowSpec(
    id: 'ramadan',
    type: 'series',
    title: 'Ramadan 2026 Series',
    fetcher: (page) {
      // Page walks the Ramadan years, then deeper TMDB pages within each.
      final year = _ramadanYears[(page - 1) % _ramadanYears.length];
      final cycle = ((page - 1) ~/ _ramadanYears.length) + 1;
      return client.discover(
        'tv',
        _arParams({'first_air_date_year': '$year', 'page': '$cycle'}),
      );
    },
  ),
  ArabicRowSpec(
    id: 'drama',
    type: 'series',
    title: 'Arabic Drama',
    fetcher: (page) => client.discover(
      'tv',
      _arParams({'with_genres': '$_tmdbGenreDrama', 'page': '$page'}),
    ),
  ),
  ArabicRowSpec(
    id: 'movies',
    type: 'movie',
    title: 'Arabic Movies',
    fetcher: (page) => client.discover('movie', _arParams({'page': '$page'})),
  ),
  ArabicRowSpec(
    id: 'classics',
    type: 'movie',
    title: 'Egyptian Cinema Classics',
    fetcher: (page) =>
        page > 1 ? Future.value(const []) : _fetchEgyptianClassics(client),
  ),
  ArabicRowSpec(
    id: 'khaleeji',
    type: 'series',
    title: 'Gulf / Khaleeji',
    fetcher: (page) => client.discover(
      'tv',
      _arParams({'with_origin_country': _gulfCountries, 'page': '$page'}),
    ),
  ),
  ArabicRowSpec(
    id: 'comedy',
    type: 'movie',
    title: 'Arabic Comedy',
    fetcher: (page) => client.discover(
      'movie',
      _arParams({'with_genres': '$_tmdbGenreComedy', 'page': '$page'}),
    ),
  ),
  ArabicRowSpec(
    id: 'trending',
    type: 'movie',
    title: 'Trending in Arabic',
    fetcher: (page) => client.discover(
      'movie',
      _arParams({
        'vote_count.gte': '50',
        'primary_release_date.gte': _trendingSince(clock()),
        'page': '$page',
      }),
    ),
  ),
];
