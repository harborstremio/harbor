import '../../core/http/json_transport.dart';

/// A TheTVDB episode (the fields the season grid and anime thumbnail index
/// enrich from), ported from `TvdbEpisode`.
class TvdbEpisode {
  const TvdbEpisode({
    required this.number,
    required this.seasonNumber,
    this.name,
    this.overview,
    this.aired,
    this.runtime,
    this.image,
    this.absoluteNumber,
  });
  final int number;
  final int seasonNumber;
  final String? name;
  final String? overview;
  final String? aired;
  final int? runtime;
  final String? image;
  final int? absoluteNumber;
}

/// Resolves a TVDB image reference to an absolute URL, ported from `tvdbImg`.
/// A relative path is hung off the artworks host; an absolute URL passes
/// through; anything empty or non-string is null.
String? _tvdbImg(Object? v) {
  if (v is! String || v.isEmpty) return null;
  if (v.startsWith('http')) return v;
  return 'https://artworks.thetvdb.com${v.startsWith('/') ? '' : '/'}$v';
}

int? _seriesIdFromRemote(List<dynamic> data) {
  final hits = data.whereType<Map>().toList();
  Map? hit;
  for (final h in hits) {
    if ((h['series'] as Map?)?['id'] != null) {
      hit = h;
      break;
    }
  }
  hit ??= hits.cast<Map?>().firstWhere(
    (h) => h?['type'] == 'series',
    orElse: () => null,
  );
  hit ??= hits.isNotEmpty ? hits.first : null;
  final raw = (hit?['series'] as Map?)?['id'] ?? hit?['tvdb_id'];
  final id = raw is num
      ? raw.toInt()
      : (raw is String ? int.tryParse(raw) : null);
  return (id != null && id > 0) ? id : null;
}

/// A minimal TheTVDB v4 client for episode enrichment, ported from
/// `src/lib/providers/tvdb.ts`: a login-token flow (cached with a 23h TTL,
/// re-authing once on a 401) over the injected transport, plus series-by-imdb
/// resolution and per-season episodes. Gated by the user's `tvdbKey`.
class TvdbClient {
  TvdbClient(this._transport, {DateTime Function()? clock})
    : _clock = clock ?? DateTime.now;

  static const _base = 'https://api4.thetvdb.com/v4';
  static const _tokenTtlMs = 23 * 60 * 60 * 1000;

  final JsonTransport _transport;
  final DateTime Function() _clock;

  String? _token;
  int _tokenAt = 0;
  String _tokenKey = '';

  int get _now => _clock().millisecondsSinceEpoch;

  Future<String?> _getToken(String apiKey) async {
    if (apiKey.isEmpty) return null;
    if (_token != null &&
        _tokenKey == apiKey &&
        _now - _tokenAt < _tokenTtlMs) {
      return _token;
    }
    try {
      final res = await _transport.postJson(
        '$_base/login',
        body: {'apikey': apiKey},
        headers: const {
          'content-type': 'application/json',
          'accept': 'application/json',
        },
      );
      if (!res.ok) return null;
      final token = (res.data is Map)
          ? ((res.data['data'] as Map?)?['token'])
          : null;
      if (token is! String || token.isEmpty) return null;
      _token = token;
      _tokenAt = _now;
      _tokenKey = apiKey;
      return token;
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _get(String apiKey, String path) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      final token = await _getToken(apiKey);
      if (token == null) return null;
      try {
        final res = await _transport.getJson(
          '$_base$path',
          headers: {
            'authorization': 'Bearer $token',
            'accept': 'application/json',
          },
        );
        if (res.statusCode == 401) {
          _token = null;
          if (attempt == 0) continue;
          return null;
        }
        if (!res.ok) return null;
        return (res.data is Map) ? res.data['data'] : null;
      } catch (_) {
        if (attempt == 0) continue;
        return null;
      }
    }
    return null;
  }

  /// Resolves a series' TVDB id from its imdb id via `search/remoteid`, ported
  /// from `tvdbSeriesByImdb`.
  Future<int?> seriesByImdb(String apiKey, String imdbId) async {
    if (apiKey.isEmpty || !imdbId.startsWith('tt')) return null;
    final data = await _get(apiKey, '/search/remoteid/$imdbId');
    return data is List ? _seriesIdFromRemote(data) : null;
  }

  /// Per-season episodes (default order), ported from `tvdbEpisodes`.
  Future<List<TvdbEpisode>> episodes(
    String apiKey,
    int seriesId,
    int season,
  ) async {
    if (apiKey.isEmpty || seriesId == 0) return const [];
    final data = await _get(
      apiKey,
      '/series/$seriesId/episodes/default?season=$season',
    );
    final arr = (data is Map) ? data['episodes'] : null;
    if (arr is! List) return const [];
    return [
      for (final e in arr.whereType<Map>())
        if (e['number'] is num && e['seasonNumber'] is num)
          TvdbEpisode(
            number: (e['number'] as num).toInt(),
            seasonNumber: (e['seasonNumber'] as num).toInt(),
            name: e['name'] as String?,
            overview: e['overview'] as String?,
            aired: e['aired'] as String?,
            runtime: (e['runtime'] as num?)?.toInt(),
            image: _tvdbImg(e['image']),
          ),
    ];
  }

  /// Every episode in absolute order, paged, ported from
  /// `tvdbEpisodesAbsolute`. Used to build the anime thumbnail index — the
  /// absolute list numbers episodes positionally across seasons.
  Future<List<TvdbEpisode>> episodesAbsolute(
    String apiKey,
    int seriesId,
  ) async {
    if (apiKey.isEmpty || seriesId == 0) return const [];
    final out = <TvdbEpisode>[];
    for (var page = 0; page < 12; page++) {
      final data = await _get(
        apiKey,
        '/series/$seriesId/episodes/absolute?page=$page',
      );
      final arr = (data is Map) ? data['episodes'] : null;
      if (arr is! List || arr.isEmpty) break;
      for (final e in arr.whereType<Map>()) {
        if (e['number'] is! num) continue;
        out.add(
          TvdbEpisode(
            number: (e['number'] as num).toInt(),
            seasonNumber: e['seasonNumber'] is num
                ? (e['seasonNumber'] as num).toInt()
                : 0,
            absoluteNumber: (e['absoluteNumber'] as num?)?.toInt(),
            name: e['name'] as String?,
            overview: e['overview'] as String?,
            aired: e['aired'] as String?,
            runtime: (e['runtime'] as num?)?.toInt(),
            image: _tvdbImg(e['image']),
          ),
        );
      }
      if (arr.length < 500) break;
    }
    return out;
  }
}
