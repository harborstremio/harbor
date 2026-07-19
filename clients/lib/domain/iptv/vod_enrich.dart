import '../catalog/tmdb.dart';

/// TMDB metadata for a VOD title (poster/backdrop/overview/year/id). Ports
/// `iptv/vod-enrich.ts` `VodEnrichment`.
class VodEnrichment {
  const VodEnrichment({
    this.poster,
    this.backdrop,
    this.overview,
    this.year,
    this.tmdbId,
  });
  final String? poster;
  final String? backdrop;
  final String? overview;
  final int? year;
  final int? tmdbId;
}

String _pick(Object? a, Object? b) {
  final sa = (a ?? '').toString();
  return sa.isNotEmpty ? sa : (b ?? '').toString();
}

/// Enriches VOD movie/series titles with TMDB metadata, de-duplicating requests
/// by (kind, lowercased title, year). Ports `enrichVod` into an injectable
/// object over the shared [TmdbClient].
class VodEnricher {
  VodEnricher(this._tmdb);

  final TmdbClient _tmdb;
  final Map<String, Future<VodEnrichment?>> _cache = {};

  String _cacheKey(String kind, String title, int? year) =>
      '$kind|${title.toLowerCase()}|${year ?? ''}';

  /// Resolves TMDB metadata for a title, or null (no key, blank title, or no
  /// match). [kind] is `'movie'` or `'series'`.
  Future<VodEnrichment?> enrich(String kind, String title, int? year) {
    if (!_tmdb.hasKey || title.trim().isEmpty) return Future.value();
    final key = _cacheKey(kind, title, year);
    final existing = _cache[key];
    if (existing != null) return existing;
    final promise = _run(kind, title, year);
    _cache[key] = promise;
    return promise;
  }

  Future<VodEnrichment?> _run(String kind, String title, int? year) async {
    final path = kind == 'series' ? 'search/tv' : 'search/movie';
    final params = <String, String>{'query': title, 'include_adult': 'false'};
    if (year != null) {
      params[kind == 'series' ? 'first_air_date_year' : 'year'] = '$year';
    }
    final data = await _tmdb.get(path, params);
    final results = data?['results'];
    if (results is! List || results.isEmpty || results.first is! Map) {
      return null;
    }
    final hit = (results.first as Map).cast<String, dynamic>();
    final date = _pick(hit['release_date'], hit['first_air_date']);
    final hitYear = date.isNotEmpty
        ? int.tryParse(date.length >= 4 ? date.substring(0, 4) : date)
        : null;
    final posterPath = hit['poster_path'];
    final backdropPath = hit['backdrop_path'];
    final overview = (hit['overview'] ?? '').toString().trim();
    final id = hit['id'];
    return VodEnrichment(
      poster: posterPath is String && posterPath.isNotEmpty
          ? '$tmdbImg/w342$posterPath'
          : null,
      backdrop: backdropPath is String && backdropPath.isNotEmpty
          ? '$tmdbImg/w780$backdropPath'
          : null,
      overview: overview.isEmpty ? null : overview,
      year: hitYear,
      tmdbId: id is num ? id.toInt() : null,
    );
  }
}
