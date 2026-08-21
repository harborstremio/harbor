import '../../core/http/json_transport.dart';

/// The MDBList aggregate + per-source scores for a title, ported from
/// `MdblistScores` in `src/lib/providers/mdblist.ts`.
class MdblistScores {
  const MdblistScores({
    this.score,
    this.letterboxd,
    this.trakt,
    this.metacritic,
    this.rtAudience,
    this.simkl,
  });

  final double? score;
  final double? letterboxd;
  final double? trakt;
  final double? metacritic;
  final double? rtAudience;
  final double? simkl;
}

double? _positive(List<Object?> vals) {
  for (final v in vals) {
    if (v is num && v > 0) return v.toDouble();
  }
  return null;
}

/// Parses an MDBList API payload into [MdblistScores], ported 1:1 from `parse`:
/// per-source rows plus the aggregate `score_average`/`scoreaverage`/`score`,
/// with RT-audience source aliases and Simkl scaled to /10.
MdblistScores parseMdblistScores(Map<String, dynamic> json) {
  final rows = ((json['ratings'] as List?) ?? const [])
      .whereType<Map>()
      .toList();
  double? val(String source) {
    for (final r in rows) {
      if (r['source'] == source) {
        final v = r['value'];
        return (v is num && v > 0) ? v.toDouble() : null;
      }
    }
    return null;
  }

  final simkl = val('simkl');
  return MdblistScores(
    score: _positive([
      json['score_average'],
      json['scoreaverage'],
      json['score'],
    ]),
    letterboxd: val('letterboxd'),
    trakt: val('trakt'),
    metacritic: val('metacritic'),
    rtAudience: val('tomatoesaudience') ?? val('audience') ?? val('popcorn'),
    simkl: simkl == null ? null : (simkl > 10 ? simkl / 10 : simkl),
  );
}

/// The MDBList scores provider, ported from `mdblist.ts`: fetches a title's
/// cross-site scores (the v2 `api.mdblist.com` endpoint, falling back to the
/// legacy `mdblist.com/api`), keyed + cached by `type:imdbId`. Null results are
/// cached too, matching the web's memoization.
class MdblistStore {
  MdblistStore(this._transport);

  final JsonTransport _transport;
  final Map<String, MdblistScores?> _cache = {};

  Future<MdblistScores?> scores(
    String key,
    String imdbId, {
    String type = 'movie',
  }) async {
    if (key.isEmpty || !imdbId.startsWith('tt')) return null;
    final ck = '$type:$imdbId';
    if (_cache.containsKey(ck)) return _cache[ck];
    final result = await _fetch(key, imdbId, type);
    _cache[ck] = result;
    return result;
  }

  Future<MdblistScores?> _fetch(String key, String imdbId, String type) async {
    // v2 endpoint.
    final v2 = Uri.https('api.mdblist.com', '/imdb/$type/$imdbId', {
      'apikey': key,
    });
    final primary = await _tryParse(v2.toString());
    if (primary != null) return primary;

    // Legacy endpoint.
    final legacy = Uri.https('mdblist.com', '/api/', {
      'apikey': key,
      'i': imdbId,
    });
    return _tryParse(legacy.toString());
  }

  Future<MdblistScores?> _tryParse(String url) async {
    try {
      final res = await _transport.getJson(url);
      if (!res.ok || res.data is! Map) return null;
      final json = (res.data as Map).cast<String, dynamic>();
      if (json['ratings'] is! List) return null;
      return parseMdblistScores(json);
    } on TransportException {
      return null;
    }
  }
}
