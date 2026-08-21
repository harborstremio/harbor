import 'dart:convert';

import '../../core/http/json_transport.dart';
import '../../core/storage/kv_store.dart';

/// Award tallies parsed from an OMDB `Awards` string, ported from `OmdbAwards`.
class OmdbAwards {
  const OmdbAwards({
    required this.oscarsWon,
    required this.oscarsNominated,
    required this.emmysWon,
    required this.emmysNominated,
    required this.baftasWon,
    required this.baftasNominated,
    required this.globesWon,
    required this.globesNominated,
    required this.totalWins,
    required this.totalNominations,
  });

  final int oscarsWon;
  final int oscarsNominated;
  final int emmysWon;
  final int emmysNominated;
  final int baftasWon;
  final int baftasNominated;
  final int globesWon;
  final int globesNominated;
  final int totalWins;
  final int totalNominations;

  Map<String, dynamic> toJson() => {
    'oscarsWon': oscarsWon,
    'oscarsNominated': oscarsNominated,
    'emmysWon': emmysWon,
    'emmysNominated': emmysNominated,
    'baftasWon': baftasWon,
    'baftasNominated': baftasNominated,
    'globesWon': globesWon,
    'globesNominated': globesNominated,
    'totalWins': totalWins,
    'totalNominations': totalNominations,
  };

  factory OmdbAwards.fromJson(Map<String, dynamic> j) => OmdbAwards(
    oscarsWon: (j['oscarsWon'] as num?)?.toInt() ?? 0,
    oscarsNominated: (j['oscarsNominated'] as num?)?.toInt() ?? 0,
    emmysWon: (j['emmysWon'] as num?)?.toInt() ?? 0,
    emmysNominated: (j['emmysNominated'] as num?)?.toInt() ?? 0,
    baftasWon: (j['baftasWon'] as num?)?.toInt() ?? 0,
    baftasNominated: (j['baftasNominated'] as num?)?.toInt() ?? 0,
    globesWon: (j['globesWon'] as num?)?.toInt() ?? 0,
    globesNominated: (j['globesNominated'] as num?)?.toInt() ?? 0,
    totalWins: (j['totalWins'] as num?)?.toInt() ?? 0,
    totalNominations: (j['totalNominations'] as num?)?.toInt() ?? 0,
  );
}

/// The OMDB score bundle for a title, ported from `OmdbScores`.
class OmdbScores {
  const OmdbScores({
    this.imdbRating,
    this.imdbVotes,
    this.rtCritics,
    this.metascore,
    this.certifiedFresh = false,
    this.awards,
    required this.fetchedAt,
  });

  final String? imdbRating;
  final int? imdbVotes;
  final int? rtCritics;
  final int? metascore;
  final bool certifiedFresh;
  final OmdbAwards? awards;
  final int fetchedAt;

  Map<String, dynamic> toJson() => {
    if (imdbRating != null) 'imdbRating': imdbRating,
    if (imdbVotes != null) 'imdbVotes': imdbVotes,
    if (rtCritics != null) 'rtCritics': rtCritics,
    if (metascore != null) 'metascore': metascore,
    'certifiedFresh': certifiedFresh,
    if (awards != null) 'awards': awards!.toJson(),
    'fetchedAt': fetchedAt,
  };

  factory OmdbScores.fromJson(Map<String, dynamic> j) => OmdbScores(
    imdbRating: j['imdbRating'] as String?,
    imdbVotes: (j['imdbVotes'] as num?)?.toInt(),
    rtCritics: (j['rtCritics'] as num?)?.toInt(),
    metascore: (j['metascore'] as num?)?.toInt(),
    certifiedFresh: j['certifiedFresh'] == true,
    awards: j['awards'] is Map
        ? OmdbAwards.fromJson((j['awards'] as Map).cast<String, dynamic>())
        : null,
    fetchedAt: (j['fetchedAt'] as num?)?.toInt() ?? 0,
  );
}

/// The daily OMDB request budget (the free tier is 1000/day), ported from
/// `OmdbBudget`.
class OmdbBudget {
  const OmdbBudget({
    required this.used,
    required this.limit,
    required this.resetAt,
    required this.exhausted,
    required this.keyInvalid,
  });

  final int used;
  final int limit;
  final int resetAt;
  final bool exhausted;
  final bool keyInvalid;

  OmdbBudget copyWith({int? used, bool? exhausted, bool? keyInvalid}) =>
      OmdbBudget(
        used: used ?? this.used,
        limit: limit,
        resetAt: resetAt,
        exhausted: exhausted ?? this.exhausted,
        keyInvalid: keyInvalid ?? this.keyInvalid,
      );

  Map<String, dynamic> toJson() => {
    'used': used,
    'limit': limit,
    'resetAt': resetAt,
    'exhausted': exhausted,
    'keyInvalid': keyInvalid,
  };

  factory OmdbBudget.fromJson(Map<String, dynamic> j) => OmdbBudget(
    used: (j['used'] as num?)?.toInt() ?? 0,
    limit: (j['limit'] as num?)?.toInt() ?? _defaultLimit,
    resetAt: (j['resetAt'] as num?)?.toInt() ?? 0,
    exhausted: j['exhausted'] == true,
    keyInvalid: j['keyInvalid'] == true,
  );
}

const _defaultLimit = 1000;
const _certifiedFreshMinVotes = 50000;
const _staleMs = 90 * 24 * 60 * 60 * 1000;
const _cacheMax = 1500;

/// Parses a leading percentage (`"91%"` → 91), ported from `parsePercent`.
int? parseOmdbPercent(String? v) {
  if (v == null) return null;
  final m = RegExp(r'(\d+)').firstMatch(v);
  return m == null ? null : int.tryParse(m.group(1)!);
}

/// Parses an IMDb vote count (`"1,234,567"` → 1234567), ported from `parseVotes`.
int? parseOmdbVotes(String? v) {
  if (v == null) return null;
  return int.tryParse(v.replaceAll(',', ''));
}

/// Parses an OMDB `Awards` sentence into structured tallies, ported 1:1 from
/// `parseAwards` (returns null when nothing matches or the string is `N/A`).
OmdbAwards? parseOmdbAwards(String? s) {
  if (s == null || s.isEmpty || s == 'N/A') return null;
  final lower = s.toLowerCase();
  int grab(RegExp re) {
    final m = re.firstMatch(lower);
    return m == null ? 0 : (int.tryParse(m.group(1)!) ?? 0);
  }

  final oscarsWon = grab(RegExp(r'won\s+(\d+)\s+oscar'));
  final oscarsNominated = grab(RegExp(r'nominated for\s+(\d+)\s+oscar'));
  final emmysWon = grab(RegExp(r'won\s+(\d+)\s+(?:primetime\s+)?emmy'));
  final emmysNominated = grab(
    RegExp(r'nominated for\s+(\d+)\s+(?:primetime\s+)?emmy'),
  );
  final baftasWon = grab(RegExp(r'won\s+(\d+)\s+bafta'));
  final baftasNominated = grab(RegExp(r'nominated for\s+(\d+)\s+bafta'));
  final globesWon = grab(RegExp(r'won\s+(\d+)\s+golden globe'));
  final globesNominated = grab(RegExp(r'nominated for\s+(\d+)\s+golden globe'));
  final totalWins = grab(RegExp(r'(\d+)\s+wins?(?:\s+&|\.|\s|$)'));
  final totalNominations = grab(RegExp(r'(\d+)\s+nominations?'));

  final has =
      oscarsWon != 0 ||
      oscarsNominated != 0 ||
      emmysWon != 0 ||
      emmysNominated != 0 ||
      baftasWon != 0 ||
      baftasNominated != 0 ||
      globesWon != 0 ||
      globesNominated != 0 ||
      totalWins != 0 ||
      totalNominations != 0;
  if (!has) return null;
  return OmdbAwards(
    oscarsWon: oscarsWon,
    oscarsNominated: oscarsNominated,
    emmysWon: emmysWon,
    emmysNominated: emmysNominated,
    baftasWon: baftasWon,
    baftasNominated: baftasNominated,
    globesWon: globesWon,
    globesNominated: globesNominated,
    totalWins: totalWins,
    totalNominations: totalNominations,
  );
}

/// Maps a successful OMDB JSON response into [OmdbScores], ported from the
/// success branch of `performFetch`.
OmdbScores parseOmdbScores(Map<String, dynamic> j, {required int fetchedAt}) {
  final ratings = ((j['Ratings'] as List?) ?? const [])
      .whereType<Map>()
      .toList();
  Map? source(String name) {
    for (final r in ratings) {
      if (r['Source'] == name) return r;
    }
    return null;
  }

  final rtCritics = parseOmdbPercent(
    source('Rotten Tomatoes')?['Value'] as String?,
  );
  final imdbVotes = parseOmdbVotes(j['imdbVotes'] as String?);
  final imdbRating = (j['imdbRating'] != null && j['imdbRating'] != 'N/A')
      ? j['imdbRating'] as String
      : null;
  return OmdbScores(
    imdbRating: imdbRating,
    imdbVotes: imdbVotes,
    rtCritics: rtCritics,
    metascore: parseOmdbPercent(source('Metacritic')?['Value'] as String?),
    certifiedFresh:
        rtCritics != null &&
        rtCritics >= 75 &&
        imdbVotes != null &&
        imdbVotes >= _certifiedFreshMinVotes,
    awards: parseOmdbAwards(j['Awards'] as String?),
    fetchedAt: fetchedAt,
  );
}

/// The OMDB scores provider, ported from `omdb.ts`: a KvStore-backed score cache
/// with a persisted daily request budget (1000/day, UTC-midnight rollover) that
/// stops fetching when exhausted or when the key is rejected.
class OmdbStore {
  OmdbStore(this._kv, this._transport, {DateTime Function()? clock})
    : _clock = clock ?? DateTime.now;

  static const _cacheKey = 'harbor.omdb.v1';
  static const _budgetKey = 'harbor.omdb.budget';

  final KvStore _kv;
  final JsonTransport _transport;
  final DateTime Function() _clock;

  final Map<String, OmdbScores> _cache = {};
  final Map<String, Map<int, double>> _seasonCache = {};
  OmdbBudget? _budget;
  bool _loaded = false;

  int get _now => _clock().millisecondsSinceEpoch;

  int _nextUtcMidnight() {
    final n = _clock().toUtc();
    final next = DateTime.utc(n.year, n.month, n.day + 1);
    return next.millisecondsSinceEpoch;
  }

  OmdbBudget _freshBudget() => OmdbBudget(
    used: 0,
    limit: _defaultLimit,
    resetAt: _nextUtcMidnight(),
    exhausted: false,
    keyInvalid: false,
  );

  void _load() {
    if (_loaded) return;
    _loaded = true;
    final rawCache = _kv.getString(_cacheKey);
    if (rawCache != null && rawCache.isNotEmpty) {
      try {
        final map = jsonDecode(rawCache);
        if (map is Map) {
          for (final e in map.entries) {
            if (e.value is Map) {
              _cache[e.key.toString()] = OmdbScores.fromJson(
                (e.value as Map).cast<String, dynamic>(),
              );
            }
          }
        }
      } catch (_) {}
    }
    final rawBudget = _kv.getString(_budgetKey);
    if (rawBudget != null && rawBudget.isNotEmpty) {
      try {
        final parsed = OmdbBudget.fromJson(
          (jsonDecode(rawBudget) as Map).cast<String, dynamic>(),
        );
        if (parsed.resetAt != 0 && _now < parsed.resetAt) {
          _budget = parsed;
        }
      } catch (_) {}
    }
    _budget ??= _freshBudget();
  }

  Future<void> _persistCache() {
    final entries = _cache.entries.toList();
    if (entries.length > _cacheMax) {
      entries.sort((a, b) => a.value.fetchedAt.compareTo(b.value.fetchedAt));
      _cache.clear();
      for (final e in entries.sublist(entries.length - _cacheMax)) {
        _cache[e.key] = e.value;
      }
    }
    return _kv.setString(
      _cacheKey,
      jsonEncode(_cache.map((k, v) => MapEntry(k, v.toJson()))),
    );
  }

  Future<void> _persistBudget() =>
      _kv.setString(_budgetKey, jsonEncode(_budget!.toJson()));

  void _rolloverIfStale() {
    if (_now >= _budget!.resetAt) {
      _budget = OmdbBudget(
        used: 0,
        limit: _defaultLimit,
        resetAt: _nextUtcMidnight(),
        exhausted: false,
        keyInvalid: _budget!.keyInvalid,
      );
    }
  }

  /// The current budget (rolls over at UTC midnight).
  OmdbBudget budget() {
    _load();
    _rolloverIfStale();
    return _budget!;
  }

  /// A cached score, if present (no fetch).
  OmdbScores? cached(String? imdbId) {
    if (imdbId == null) return null;
    _load();
    return _cache[imdbId];
  }

  /// Fetches (or serves cached) OMDB scores for an imdb id. Returns null without
  /// a key, for a non-`tt` id, when the budget is exhausted / the key is
  /// invalid, or on any error.
  Future<OmdbScores?> scores(String key, String? imdbId, {String? type}) async {
    if (key.isEmpty || imdbId == null || !imdbId.startsWith('tt')) return null;
    _load();
    final hit = _cache[imdbId];
    if (hit != null && _now - hit.fetchedAt < _staleMs) return hit;
    _rolloverIfStale();
    if (_budget!.exhausted || _budget!.keyInvalid) return null;
    return _performFetch(key, imdbId, type);
  }

  Future<OmdbScores?> _performFetch(
    String key,
    String imdbId,
    String? type,
  ) async {
    final params = {'i': imdbId, 'apikey': key, 'type': ?type};
    final uri = Uri.https('www.omdbapi.com', '/', params);
    JsonResponse res;
    try {
      res = await _transport.getJson(uri.toString());
    } on TransportException {
      return null;
    }
    if (res.statusCode == 401) {
      await _mark(keyInvalid: true);
      return null;
    }
    if (!res.ok || res.data is! Map) return null;
    final j = (res.data as Map).cast<String, dynamic>();
    if (j['Response'] == 'False') {
      final err = (j['Error'] ?? '').toString();
      if (RegExp(
        r'invalid api key|no api key|not activated',
        caseSensitive: false,
      ).hasMatch(err)) {
        await _mark(keyInvalid: true);
        return null;
      }
      if (RegExp(
        r'limit|exceeded|daily|reached',
        caseSensitive: false,
      ).hasMatch(err)) {
        await _mark(exhausted: true);
        return null;
      }
      await _bump();
      return null;
    }
    await _bump(valid: true);
    final scores = parseOmdbScores(j, fetchedAt: _now);
    _cache[imdbId] = scores;
    await _persistCache();
    return scores;
  }

  /// Per-episode IMDb ratings for a whole season (keyed by episode number),
  /// ported from `omdbSeasonRatings`. Empty without a key, for a non-`tt` id, an
  /// invalid season, an exhausted budget / rejected key, or any error.
  Future<Map<int, double>> seasonRatings(
    String key,
    String? imdbId,
    int? season,
  ) async {
    const empty = <int, double>{};
    if (key.isEmpty ||
        imdbId == null ||
        !imdbId.startsWith('tt') ||
        season == null ||
        season < 1) {
      return empty;
    }
    _load();
    final cacheKey = '$imdbId:$season';
    final cached = _seasonCache[cacheKey];
    if (cached != null) return cached;
    _rolloverIfStale();
    if (_budget!.exhausted || _budget!.keyInvalid) return empty;
    return _performSeasonFetch(key, imdbId, season, cacheKey);
  }

  Future<Map<int, double>> _performSeasonFetch(
    String key,
    String imdbId,
    int season,
    String cacheKey,
  ) async {
    final out = <int, double>{};
    final uri = Uri.https('www.omdbapi.com', '/', {
      'i': imdbId,
      'Season': '$season',
      'apikey': key,
    });
    JsonResponse res;
    try {
      res = await _transport.getJson(uri.toString());
    } on TransportException {
      return out;
    }
    if (res.statusCode == 401) {
      await _mark(keyInvalid: true);
      return out;
    }
    if (!res.ok || res.data is! Map) return out;
    final j = (res.data as Map).cast<String, dynamic>();
    if (j['Response'] == 'False') {
      final err = (j['Error'] ?? '').toString();
      if (RegExp(
        r'invalid api key|no api key|not activated',
        caseSensitive: false,
      ).hasMatch(err)) {
        await _mark(keyInvalid: true);
        return out;
      }
      if (RegExp(
        r'limit|exceeded|daily|reached',
        caseSensitive: false,
      ).hasMatch(err)) {
        await _mark(exhausted: true);
        return out;
      }
      await _bump();
      return out;
    }
    await _bump(valid: true);
    for (final e in ((j['Episodes'] as List?) ?? const []).whereType<Map>()) {
      final num = int.tryParse((e['Episode'] ?? '').toString());
      final raw = e['imdbRating'];
      final rating = (raw is String && raw != 'N/A')
          ? double.tryParse(raw)
          : null;
      if (num != null && rating != null && rating.isFinite && rating > 0) {
        out[num] = rating;
      }
    }
    _seasonCache[cacheKey] = out;
    return out;
  }

  Future<void> _bump({bool valid = false}) async {
    _rolloverIfStale();
    _budget = _budget!.copyWith(
      used: _budget!.used + 1,
      keyInvalid: valid ? false : null,
      exhausted: valid ? false : null,
    );
    await _persistBudget();
  }

  Future<void> _mark({bool? exhausted, bool? keyInvalid}) async {
    _budget = _budget!.copyWith(
      used: exhausted == true ? _budget!.limit : null,
      exhausted: exhausted,
      keyInvalid: keyInvalid,
    );
    await _persistBudget();
  }
}
