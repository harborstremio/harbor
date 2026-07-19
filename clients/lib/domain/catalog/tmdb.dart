import '../../core/http/json_transport.dart';
import '../addons/models.dart';
import '../language/language_names.dart';

/// The TMDB v3 API base and image CDN, per `docs/30` / `src/lib/providers/tmdb`.
const String tmdbBase = 'https://api.themoviedb.org/3';
const String tmdbImg = 'https://image.tmdb.org/t/p';

/// A stable in-place sort. Dart's `List.sort` is not guaranteed stable (it uses
/// introsort for larger ranges), whereas JS `Array.prototype.sort` is — so ties
/// keep their original relative order, matching the source's image/logo/poster
/// tie-break behavior exactly.
void stableSort<T>(List<T> list, int Function(T a, T b) compare) {
  final indexed = <(int, T)>[
    for (var i = 0; i < list.length; i++) (i, list[i]),
  ];
  indexed.sort((a, b) {
    final c = compare(a.$2, b.$2);
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });
  for (var i = 0; i < list.length; i++) {
    list[i] = indexed[i].$2;
  }
}

/// Upsizes a `w780` TMDB backdrop URL to `w1280` (or `original` when [full]),
/// ported 1:1 from `upsizeTmdb` (used by the hero/backdrops). Non-TMDB or
/// non-`w780` URLs pass through unchanged.
String? upsizeTmdb(String? url, {bool full = false}) {
  if (url == null) return url;
  final size = full ? 'original' : 'w1280';
  return url.replaceFirst('/t/p/w780/', '/t/p/$size/');
}

/// Upgrades any sized TMDB image url (`/t/p/w780/`, `/t/p/w1280/`, …) to the
/// original resolution. Ported 1:1 from web `toHiResBackdrop`; non-TMDB urls
/// (Cinemeta backgrounds, etc.) that don't match the pattern pass through.
final _tmdbSizeRe = RegExp(r'/t/p/w\d+/');
String? toHiResBackdrop(String? url) {
  if (url == null || url.isEmpty) return url;
  return url.replaceFirst(_tmdbSizeRe, '/t/p/original/');
}

/// TMDB movie genre-id map, ported 1:1 from `MOVIE_GENRES` in
/// `src/lib/feed/tags.ts`.
const Map<String, int> kMovieGenres = {
  'Action': 28,
  'Adventure': 12,
  'Animation': 16,
  'Comedy': 35,
  'Crime': 80,
  'Documentary': 99,
  'Drama': 18,
  'Family': 10751,
  'Fantasy': 14,
  'History': 36,
  'Horror': 27,
  'Music': 10402,
  'Mystery': 9648,
  'Romance': 10749,
  'Sci-Fi': 878,
  'Thriller': 53,
  'War': 10752,
  'Western': 37,
};

/// TMDB TV genre-id map, ported 1:1 from `TV_GENRES` in `src/lib/feed/tags.ts`.
const Map<String, int> kTvGenres = {
  'Action & Adventure': 10759,
  'Animation': 16,
  'Comedy': 35,
  'Crime': 80,
  'Documentary': 99,
  'Drama': 18,
  'Mystery': 9648,
  'Sci-Fi & Fantasy': 10765,
  'War': 10768,
};

/// The companion TV genre id for each movie genre id, ported 1:1 from
/// `GENRE_MOVIE_TO_TV` (used by the genre browse filter's companion rails).
const Map<int, int> kGenreMovieToTv = {
  28: 10759,
  12: 10759,
  878: 10765,
  14: 10765,
  10752: 10768,
  16: 16,
  35: 35,
  80: 80,
  99: 99,
  18: 18,
  10751: 10751,
  9648: 9648,
  37: 37,
};

/// The companion movie genre id for each TV genre id, ported 1:1 from
/// `GENRE_TV_TO_MOVIE`.
const Map<int, int> kGenreTvToMovie = {
  10759: 28,
  10765: 878,
  10768: 10752,
  16: 16,
  35: 35,
  80: 80,
  99: 99,
  18: 18,
  10751: 10751,
  9648: 9648,
  37: 37,
};

final Map<int, String> _movieGenreName = {
  for (final e in kMovieGenres.entries) e.value: e.key,
};
final Map<int, String> _tvGenreName = {
  for (final e in kTvGenres.entries) e.value: e.key,
};

/// The Harbor genre name for a TMDB genre [id] (the inverse of [kMovieGenres] /
/// [kTvGenres]), or null when it is not a browsable genre. Used to normalise a
/// title's raw TMDB genre (e.g. `Science Fiction` → `Sci-Fi`) so it opens the
/// right genre browse.
String? genreNameById(int id, {required bool series}) =>
    (series ? _tvGenreName : _movieGenreName)[id];

/// The ordered image-language priority, ported from `imageLangPriority` in
/// `src/lib/providers/tmdb/tmdb-image-lang.ts`: each configured name resolves to
/// an ISO code, `Original` maps to `null`, and an empty result falls back to
/// `[en, null]`.
List<String?> imageLangPriority(List<String> names) {
  final out = <String?>[];
  for (final name in names) {
    if (name.trim().toLowerCase() == 'original') {
      if (!out.contains(null)) out.add(null);
      continue;
    }
    final code = normalizeLang(name);
    if (code.isNotEmpty && !out.contains(code)) out.add(code);
  }
  return out.isEmpty ? const ['en', null] : out;
}

/// The top non-original image language, used as the request `language` when no
/// explicit TMDB UI language is set (`imageRequestLang`).
String imageRequestLang(List<String> names) {
  for (final c in imageLangPriority(names)) {
    if (c != null && c.isNotEmpty) return c;
  }
  return '';
}

/// The resolved image-language order for a title, ported from `effectiveOrder`:
/// the configured priority, with the title's original language substituted for
/// each `Original` slot and appended as a final fallback before `null` (any).
List<String?> imageLangOrder(List<String> names, {String? originalLang}) {
  final orig = (originalLang != null && originalLang.isNotEmpty)
      ? (normalizeLang(originalLang).isNotEmpty
            ? normalizeLang(originalLang)
            : originalLang)
      : null;
  final order = <String?>[];
  void add(String? c) {
    if (!order.contains(c)) order.add(c);
  }

  for (final c in imageLangPriority(names)) {
    if (c == null) {
      if (orig != null) add(orig);
      add(null);
    } else {
      add(c);
    }
  }
  if (orig != null) add(orig);
  add(null);
  return order;
}

/// The `include_image_language` param (`en,null,…`), ported from `imageLangParam`.
String imageLangParam(List<String> names, {String? originalLang}) =>
    imageLangOrder(
      names,
      originalLang: originalLang,
    ).map((c) => c ?? 'null').join(',');

/// Ranks an image's language against the effective order (higher is better, -1
/// when absent), ported from `imageLangRank`.
int imageLangRank(String? iso, List<String> names, {String? originalLang}) {
  final order = imageLangOrder(names, originalLang: originalLang);
  final idx = order.indexOf(iso);
  return idx == -1 ? -1 : order.length - idx;
}

/// The TMDB client, ported from `tmdb-client.ts` + `tmdb-catalogs.ts` +
/// `tmdb-meta-mappers.ts`. All calls are keyless-safe (return empty/null without
/// an [apiKey]); retries on 429/5xx are handled by the injected [JsonTransport].
class TmdbClient {
  TmdbClient({
    required JsonTransport transport,
    required this.apiKey,
    this.language = '',
    this.imageLang = '',
    this.imageLangNames = const [],
    this.translateTitles = true,
    this.translateDescriptions = true,
    this.posterBaseUrl = '',
    DateTime Function() clock = DateTime.now,
  }) : _transport = transport,
       _clock = clock;

  final JsonTransport _transport;
  final DateTime Function() _clock;

  /// The TMDB v3 API key (`settings.tmdbKey`).
  final String apiKey;

  /// The effective TMDB UI language (`settings.tmdbLanguage`), or empty.
  final String language;

  /// The top image language, used when [language] is empty (`imageRequestLang`).
  final String imageLang;

  /// The configured image-language priority names (`settings.tmdbImageLangs`),
  /// used for logo/poster localization on the detail payload.
  final List<String> imageLangNames;

  /// When false, catalog titles use the original-language title.
  final bool translateTitles;

  /// When false, the detail overview/tagline prefer the English translation.
  final bool translateDescriptions;

  /// A custom RPDB-style poster base (`settings.posterBaseUrl`); when set, the
  /// detail payload keeps TMDB's default poster rather than a localized one.
  final String posterBaseUrl;

  bool get hasKey => apiKey.isNotEmpty;

  /// `GET {TMDB}/{path}` with the api key + effective language injected, decoded
  /// to a JSON map. Returns null without a key, on a non-2xx response, or on a
  /// transport failure — mirroring the web `get`'s null-on-failure contract.
  Future<Map<String, dynamic>?> get(
    String path, [
    Map<String, String> params = const {},
  ]) async {
    if (apiKey.isEmpty) return null;
    final qp = <String, String>{'api_key': apiKey};
    final lang = language.isNotEmpty ? language : imageLang;
    if (lang.isNotEmpty && !params.containsKey('language')) {
      qp['language'] = lang;
    }
    qp.addAll(params);
    final uri = Uri.parse('$tmdbBase/$path').replace(queryParameters: qp);
    try {
      final res = await _transport.getJson(uri.toString());
      if (!res.ok) return null;
      final data = res.data;
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return data.cast<String, dynamic>();
      return null;
    } on TransportException {
      return null;
    }
  }

  List<Map<String, dynamic>> _results(Map<String, dynamic>? data) =>
      ((data?['results'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();

  /// A movie catalog endpoint (`popular` / `top_rated` / `now_playing` /
  /// `upcoming`); `now_playing` routes through the in-theaters discover query.
  Future<List<MetaPreview>> movieRow(
    String endpoint, {
    String region = 'US',
    int page = 1,
  }) async {
    if (endpoint == 'now_playing') return _inCinema(region, page);
    final data = await get('movie/$endpoint', {
      'region': region,
      'page': '$page',
    });
    return _results(data).map(movieMeta).toList();
  }

  Future<List<MetaPreview>> _inCinema(String region, int page) async {
    const day = 24 * 60 * 60 * 1000;
    final nowMs = _clock().millisecondsSinceEpoch;
    String fmt(int t) => DateTime.fromMillisecondsSinceEpoch(
      t,
      isUtc: true,
    ).toIso8601String().substring(0, 10);
    final data = await get('discover/movie', {
      'region': region,
      'with_release_type': '3',
      'release_date.gte': fmt(nowMs - 75 * day),
      'release_date.lte': fmt(nowMs + 7 * day),
      'with_runtime.gte': '60',
      'sort_by': 'popularity.desc',
      'page': '$page',
    });
    return _results(
      data,
    ).map((m) => movieMeta({...m, 'inTheaters': true})).toList();
  }

  /// A series catalog endpoint (`popular` / `top_rated` / `airing_today` /
  /// `on_the_air`).
  Future<List<MetaPreview>> seriesRow(String endpoint, {int page = 1}) async {
    final data = await get('tv/$endpoint', {'page': '$page'});
    return _results(data).map(seriesMeta).toList();
  }

  /// The trending movies/tv feed for a `day`/`week` window.
  Future<List<MetaPreview>> trending(
    String type, {
    String window = 'week',
    int page = 1,
  }) async {
    final data = await get('trending/$type/$window', {'page': '$page'});
    final results = _results(data);
    return (type == 'movie' ? results.map(movieMeta) : results.map(seriesMeta))
        .toList();
  }

  /// A `discover/{movie,tv}` query with caller-supplied params.
  Future<List<MetaPreview>> discover(
    String type,
    Map<String, String> params,
  ) async {
    if (apiKey.isEmpty) return const [];
    final data = await get('discover/$type', params);
    final results = _results(data);
    return (type == 'movie' ? results.map(movieMeta) : results.map(seriesMeta))
        .toList();
  }

  /// A single best-match title search (`search/{movie,tv}`), optionally by year.
  Future<MetaPreview?> searchTitle(
    String type,
    String query, {
    int? year,
  }) async {
    if (apiKey.isEmpty || query.trim().isEmpty) return null;
    if (type == 'movie') {
      final params = <String, String>{'query': query, 'include_adult': 'false'};
      if (year != null) params['year'] = '$year';
      final data = await get('search/movie', params);
      final hit = _results(data).isNotEmpty ? _results(data).first : null;
      return hit != null ? movieMeta(hit) : null;
    }
    final params = <String, String>{'query': query, 'include_adult': 'false'};
    if (year != null) params['first_air_date_year'] = '$year';
    final data = await get('search/tv', params);
    final hit = _results(data).isNotEmpty ? _results(data).first : null;
    return hit != null ? seriesMeta(hit) : null;
  }

  /// Resolves a person's TMDB id by name, picking the most popular match.
  /// Ported from `tmdbPersonIdByName` — used by award-recipient links. Null
  /// without a key or when nothing matches.
  Future<int?> personIdByName(String name) async {
    if (apiKey.isEmpty || name.trim().isEmpty) return null;
    final data = await get('search/person', {
      'query': name.trim(),
      'include_adult': 'false',
    });
    final results = _results(data);
    if (results.isEmpty) return null;
    results.sort((a, b) {
      final pa = (a['popularity'] as num?)?.toDouble() ?? 0;
      final pb = (b['popularity'] as num?)?.toDouble() ?? 0;
      return pb.compareTo(pa);
    });
    final id = results.first['id'];
    return id is int ? id : (id is num ? id.toInt() : null);
  }

  /// Resolves a keyword's TMDB id by name via `search/keyword`, preferring an
  /// exact (case-insensitive) name match, else the first result. Ported from
  /// `tmdbKeywordIdByName` — used by the Kids franchise rail. Null without a key
  /// or when nothing matches.
  Future<int?> keywordId(String name) async {
    final want = name.trim().toLowerCase();
    if (apiKey.isEmpty || want.isEmpty) return null;
    final data = await get('search/keyword', {'query': name.trim()});
    final results = _results(data);
    if (results.isEmpty) return null;
    for (final r in results) {
      if ((r['name'] ?? '').toString().trim().toLowerCase() == want) {
        final id = r['id'];
        return id is int ? id : (id is num ? id.toInt() : null);
      }
    }
    final id = results.first['id'];
    return id is int ? id : (id is num ? id.toInt() : null);
  }

  /// Maps a raw TMDB movie into a `tmdb:movie:{id}` [MetaPreview].
  MetaPreview movieMeta(Map<String, dynamic> m) {
    final title = (m['title'] ?? '').toString();
    final original = (m['original_title'] ?? '').toString();
    return MetaPreview({
      'id': 'tmdb:movie:${m['id']}',
      'type': 'movie',
      'name': translateTitles
          ? title
          : (original.isNotEmpty ? original : title),
      if (_poster(m['poster_path']) != null)
        'poster': _poster(m['poster_path']),
      if (_back(m['backdrop_path']) != null)
        'background': _back(m['backdrop_path']),
      if (m['overview'] != null) 'description': m['overview'],
      if (m['original_language'] != null)
        'originalLanguage': m['original_language'],
      if (_year(m['release_date']) != null)
        'releaseInfo': _year(m['release_date']),
      if (m['release_date'] != null) 'releaseDate': m['release_date'],
      if (_rating(m['vote_average']) != null)
        'imdbRating': _rating(m['vote_average']),
      if (_genres(m['genre_ids'], 'movie') != null)
        'genres': _genres(m['genre_ids'], 'movie'),
      if (m['inTheaters'] == true) 'inTheaters': true,
    });
  }

  /// Maps a raw TMDB series into a `tmdb:tv:{id}` [MetaPreview].
  MetaPreview seriesMeta(Map<String, dynamic> s) {
    final name = (s['name'] ?? '').toString();
    final original = (s['original_name'] ?? '').toString();
    return MetaPreview({
      'id': 'tmdb:tv:${s['id']}',
      'type': 'series',
      'name': translateTitles ? name : (original.isNotEmpty ? original : name),
      if (_poster(s['poster_path']) != null)
        'poster': _poster(s['poster_path']),
      if (_back(s['backdrop_path']) != null)
        'background': _back(s['backdrop_path']),
      if (s['overview'] != null) 'description': s['overview'],
      if (s['original_language'] != null)
        'originalLanguage': s['original_language'],
      if (_year(s['first_air_date']) != null)
        'releaseInfo': _year(s['first_air_date']),
      if (s['first_air_date'] != null) 'releaseDate': s['first_air_date'],
      if (_rating(s['vote_average']) != null)
        'imdbRating': _rating(s['vote_average']),
      if (_genres(s['genre_ids'], 'tv') != null)
        'genres': _genres(s['genre_ids'], 'tv'),
    });
  }

  static String? _poster(Object? p) =>
      p is String && p.isNotEmpty ? '$tmdbImg/w342$p' : null;
  static String? _back(Object? p) =>
      p is String && p.isNotEmpty ? '$tmdbImg/w780$p' : null;
  static String? _year(Object? s) {
    if (s is! String || s.isEmpty) return null;
    return s.length >= 4 ? s.substring(0, 4) : s;
  }

  static String? _rating(Object? v) {
    final n = v is num ? v : (v is String ? num.tryParse(v) : null);
    return (n != null && n > 0) ? n.toStringAsFixed(1) : null;
  }

  static List<String>? _genres(Object? ids, String kind) {
    if (ids is! List || ids.isEmpty) return null;
    final lookup = kind == 'movie' ? _movieGenreName : _tvGenreName;
    final names = <String>[];
    for (final id in ids) {
      final n = id is num ? lookup[id.toInt()] : null;
      if (n != null) names.add(n);
    }
    return names.isEmpty ? null : names;
  }
}
