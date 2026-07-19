import 'dart:async';
import 'dart:convert';

import '../../core/http/json_transport.dart';
import '../../core/storage/kv_store.dart';
import '../addons/models.dart';
import 'jikan.dart';

/// A resolved ARM id mapping (MyAnimeList → Kitsu / AniList), with its fetch
/// time and a negative-cache flag.
class _ArmEntry {
  const _ArmEntry({
    required this.at,
    this.kitsu,
    this.anilist,
    this.neg = false,
  });
  final int at;
  final int? kitsu;
  final int? anilist;
  final bool neg;
}

/// The Jikan (MyAnimeList) network client — rate-limited, cached queries that
/// resolve into catalog metas, with a MAL→Kitsu id resolver (relations.yuna.moe)
/// so anime line up with the Kitsu addon. Ported from the network half of
/// `lib/providers/jikan.ts`. Inject [clock] and [minInterval] for tests. Raw
/// direct HTTP — no proxy.
class JikanClient {
  JikanClient(
    this._transport, {
    DateTime Function() clock = DateTime.now,
    bool Function() adultHidden = _notHidden,
    this.minInterval = const Duration(milliseconds: 400),
    this.cacheTtl = const Duration(hours: 6),
    this.armTtl = const Duration(days: 30),
    this.armNegTtl = const Duration(days: 1),
    Duration Function(int attempt)? retryBackoff,
    KvStore? kv,
  }) : _clock = clock,
       _adultHidden = adultHidden,
       _kv = kv,
       _retryBackoff =
           retryBackoff ??
           ((attempt) => Duration(milliseconds: 2000 * (1 << attempt)));

  static bool _notHidden() => false;

  static const _jikan = 'https://api.jikan.moe/v4';
  static const _arm = 'https://relations.yuna.moe/api/ids';

  final JsonTransport _transport;
  final DateTime Function() _clock;
  final bool Function() _adultHidden;
  final KvStore? _kv;
  final Duration minInterval;
  final Duration cacheTtl;
  final Duration armTtl;
  final Duration armNegTtl;
  final Duration Function(int attempt) _retryBackoff;

  /// The persisted browse-row cache. Jikan's `/anime` search endpoint routinely
  /// 504s (MyAnimeList upstream) and the API rate-limits the ~16 per-visit
  /// queries, so once a row loads we keep it on disk (within [cacheTtl]) — the
  /// tab then shows real posters instantly on the next launch instead of a
  /// blank grid while Jikan is busy. The web keeps this cache only in memory.
  static const _cacheLsKey = 'harbor.anime.rows.v1';
  static const _cacheCap = 60;
  bool _cacheLoaded = false;

  final Map<String, ({int at, List<MetaPreview> metas})> _cache = {};
  final Map<String, Future<List<MetaPreview>>> _inflight = {};
  final Map<int, _ArmEntry> _armMem = {};
  final Map<int, Future<_ArmEntry?>> _armInflight = {};

  Future<void> _queue = Future.value();

  int get _now => _clock().millisecondsSinceEpoch;

  // ── Query builders ─────────────────────────────────────────────────────────

  Future<List<MetaPreview>> airingNow([int page = 1]) =>
      jikanQuery('/seasons/now', {'page': page});

  Future<List<MetaPreview>> upcoming([int page = 1]) =>
      jikanQuery('/seasons/upcoming', {'page': page});

  Future<List<MetaPreview>> topAnime([int page = 1]) =>
      jikanQuery('/top/anime', {'page': page});

  Future<List<MetaPreview>> topAiring([int page = 1]) =>
      jikanQuery('/top/anime', {'filter': 'airing', 'page': page});

  Future<List<MetaPreview>> topPopular([int page = 1]) =>
      jikanQuery('/top/anime', {'filter': 'bypopularity', 'page': page});

  Future<List<MetaPreview>> topMovies([int page = 1]) =>
      jikanQuery('/top/anime', {'type': 'movie', 'page': page});

  Future<List<MetaPreview>> topTv([int page = 1]) =>
      jikanQuery('/top/anime', {'type': 'tv', 'page': page});

  Future<List<MetaPreview>> newReleases([int page = 1]) =>
      jikanQuery('/anime', {
        'order_by': 'start_date',
        'sort': 'desc',
        'status': 'airing',
        'min_score': 6,
        'page': page,
      });

  Future<List<MetaPreview>> byGenre(int genreId, [int page = 1]) =>
      jikanQuery('/anime', {
        'genres': genreId,
        'order_by': 'score',
        'sort': 'desc',
        'min_score': 7,
        'sfw': 'true',
        'page': page,
      });

  Future<List<MetaPreview>> searchByTitle(String title, [int limit = 1]) =>
      jikanQuery('/anime', {
        'q': title,
        'limit': limit,
        'order_by': 'popularity',
        'sort': 'desc',
        'sfw': 'true',
      });

  Future<List<MetaPreview>> byEra(String start, String end, [int page = 1]) =>
      jikanQuery('/anime', {
        'start_date': start,
        'end_date': end,
        'order_by': 'score',
        'sort': 'desc',
        'min_score': 7.5,
        'sfw': 'true',
        'page': page,
      });

  static const _gemMemberCeiling = 350000;
  static const _gemScoredByFloor = 4000;

  final Map<int, ({int at, List<MetaPreview> metas})> _gemCache = {};

  /// Resolves a title to its MyAnimeList id (the most popular match), or null.
  /// Ported 1:1 from `jikanResolveMalId`.
  Future<int?> resolveMalId(String title) async {
    final url =
        '$_jikan/anime?q=${Uri.encodeQueryComponent(title)}'
        '&limit=1&sfw=true&order_by=popularity&sort=desc';
    final r = await _throttledGet(url);
    if (r == null || !r.ok) return null;
    final data = _dataList(r.data);
    return data.isEmpty ? null : (data.first['mal_id'] as num?)?.toInt();
  }

  /// The most-recommended anime for [malId] (top 12 by vote), resolved into
  /// metas. Ported 1:1 from `jikanRecommendationsForMalId`.
  Future<List<MetaPreview>> recommendationsForMalId(int malId) async {
    final r = await _throttledGet('$_jikan/anime/$malId/recommendations');
    if (r == null || !r.ok) return const [];
    final rows = (r.data is Map && (r.data as Map)['data'] is List)
        ? [
            for (final x in (r.data as Map)['data'] as List)
              if (x is Map) x.cast<String, dynamic>(),
          ]
        : const <Map<String, dynamic>>[];
    rows.sort(
      (a, b) =>
          ((b['votes'] as num?) ?? 0).compareTo((a['votes'] as num?) ?? 0),
    );
    final animes = [
      for (final row in rows)
        if (row['entry'] is Map)
          JikanAnime((row['entry'] as Map).cast<String, dynamic>()),
    ].where((a) => a.malId != 0).take(12).toList();
    if (animes.isEmpty) return const [];
    return metasFromJikan(animes);
  }

  /// Under-the-radar high-scorers: low-membership, well-scored, non-sequel TV
  /// anime. Ported 1:1 from `jikanUnderratedGems`.
  Future<List<MetaPreview>> underratedGems([int page = 1]) async {
    final hit = _gemCache[page];
    if (hit != null && _now - hit.at < cacheTtl.inMilliseconds) {
      return hit.metas;
    }
    final pages = await Future.wait([
      _fetchRawAnimePage(page * 2 - 1),
      _fetchRawAnimePage(page * 2),
    ]);
    final seen = <int>{};
    final filtered = <JikanAnime>[];
    for (final a in [...pages[0], ...pages[1]]) {
      if (!seen.add(a.malId)) continue;
      if ((a.members ?? 0) > _gemMemberCeiling) continue;
      if ((a.scoredBy ?? 0) < _gemScoredByFloor) continue;
      if (isSequelTitle(a)) continue;
      filtered.add(a);
    }
    filtered.sort((a, b) => (b.score ?? 0).compareTo(a.score ?? 0));
    final metas = await metasFromJikan(filtered);
    _gemCache[page] = (at: _now, metas: metas);
    return metas;
  }

  Future<List<JikanAnime>> _fetchRawAnimePage(int page) async {
    final url =
        '$_jikan/anime?order_by=members&sort=asc&min_score=7.8'
        '&sfw=true&type=tv&page=$page';
    for (var attempt = 0; attempt < 3; attempt++) {
      final r = await _get(url);
      if (r == null) return const [];
      if (r.statusCode == 429) {
        await Future<void>.delayed(_retryBackoff(attempt));
        continue;
      }
      if (!r.ok) return const [];
      return [for (final m in _dataList(r.data)) JikanAnime(m)];
    }
    return const [];
  }

  // ── Core query ─────────────────────────────────────────────────────────────

  /// Runs a cached, rate-limited Jikan query and returns the resolved metas.
  /// Ported 1:1 from `jikanQuery`.
  /// Loads the persisted browse-row cache once (dropping expired entries), so a
  /// relaunch shows previously-fetched rows without re-hitting Jikan.
  void _ensureCacheLoaded() {
    if (_cacheLoaded) return;
    _cacheLoaded = true;
    final kv = _kv;
    if (kv == null) return;
    final raw = kv.getString(_cacheLsKey);
    if (raw == null || raw.isEmpty) return;
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! Map) return;
      final now = _now;
      parsed.forEach((k, v) {
        if (v is! Map) return;
        final at = (v['at'] as num?)?.toInt() ?? 0;
        if (at == 0 || now - at >= cacheTtl.inMilliseconds) return;
        final list = v['metas'];
        if (list is! List) return;
        final metas = [
          for (final m in list)
            if (m is Map) MetaPreview(m.cast<String, dynamic>()),
        ];
        if (metas.isNotEmpty) {
          _cache[k.toString()] = (at: at, metas: metas);
        }
      });
    } catch (_) {
      kv.remove(_cacheLsKey);
    }
  }

  /// Persists the non-empty cached rows (most-recent first, capped) to disk.
  void _persistCache() {
    final kv = _kv;
    if (kv == null) return;
    final entries =
        _cache.entries.where((e) => e.value.metas.isNotEmpty).toList()
          ..sort((a, b) => b.value.at.compareTo(a.value.at));
    final capped = entries.length > _cacheCap
        ? entries.sublist(0, _cacheCap)
        : entries;
    kv.setString(
      _cacheLsKey,
      jsonEncode({
        for (final e in capped)
          e.key: {
            'at': e.value.at,
            'metas': [for (final m in e.value.metas) m.json],
          },
      }),
    );
  }

  Future<List<MetaPreview>> jikanQuery(
    String path, [
    Map<String, Object> params = const {},
  ]) {
    _ensureCacheLoaded();
    final effective = _adultHidden() ? {'sfw': 'true', ...params} : params;
    final qs = [
      for (final e in effective.entries)
        '${e.key}=${Uri.encodeQueryComponent('${e.value}')}',
    ].join('&');
    final key = '$path?$qs';

    final hit = _cache[key];
    if (hit != null && _now - hit.at < cacheTtl.inMilliseconds) {
      return Future.value(hit.metas);
    }
    final existing = _inflight[key];
    if (existing != null) return existing;

    final p = _run(path, qs, key);
    _inflight[key] = p;
    return p.whenComplete(() {
      // Statement body so nothing is returned — see the sports-client note about
      // whenComplete returning the removed future and deadlocking.
      _inflight.remove(key);
    });
  }

  Future<List<MetaPreview>> _run(String path, String qs, String key) async {
    final url = '$_jikan$path${qs.isNotEmpty ? '?$qs' : ''}';
    for (var attempt = 0; attempt < 4; attempt++) {
      final r = await _throttledGet(url);
      if (r == null) return const [];
      // Retry both a 429 (rate limit) and a 5xx — Jikan returns 504 "failed to
      // connect to MyAnimeList" when MAL's upstream flaps, which it does every
      // few seconds, so a backed-off retry frequently lands in a healthy window
      // instead of dropping the whole row.
      final status = r.statusCode;
      if ((status == 429 || status >= 500) && attempt < 3) {
        await Future<void>.delayed(_retryBackoff(attempt));
        continue;
      }
      if (!r.ok) return const [];
      final items = [for (final m in _dataList(r.data)) JikanAnime(m)];
      final metas = await metasFromJikan(items);
      _cache[key] = (at: _now, metas: metas);
      if (metas.isNotEmpty) _persistCache();
      return metas;
    }
    return const [];
  }

  /// Resolves Jikan results into de-duplicated catalog metas — franchise
  /// collapse, ARM id resolution, then an id/name dedup. Ported from
  /// `metasFromJikan`.
  Future<List<MetaPreview>> metasFromJikan(List<JikanAnime> items) async {
    if (items.isEmpty) return const [];
    final filtered = _adultHidden()
        ? [
            for (final a in items)
              if (!isAdultJikan(a)) a,
          ]
        : items;
    final ordered = dedupeFranchises(filtered);

    final ids = await Future.wait(
      ordered.map((a) async {
        final arm = await _armLookup(a.malId);
        return jikanMetaId(a, kitsuId: arm?.kitsu);
      }),
    );

    final seenIds = <String>{};
    final seenNames = <String>{};
    final out = <MetaPreview>[];
    for (var i = 0; i < ordered.length; i++) {
      final meta = jikanToMeta(ordered[i], id: ids[i]);
      final nameKey = meta.name.trim().toLowerCase();
      if (!seenIds.add(meta.id) || !seenNames.add(nameKey)) continue;
      out.add(meta);
    }
    return out;
  }

  // ── ARM id resolver ────────────────────────────────────────────────────────

  Future<_ArmEntry?> _armLookup(int malId) {
    final hit = _armMem[malId];
    if (hit != null) {
      final age = _now - hit.at;
      final fresh = hit.neg
          ? age < armNegTtl.inMilliseconds
          : age < armTtl.inMilliseconds;
      if (fresh) return Future.value(hit.neg ? null : hit);
    }
    final existing = _armInflight[malId];
    if (existing != null) return existing;

    final p = () async {
      final r = await _get('$_arm?source=myanimelist&id=$malId');
      if (r == null || !r.ok || r.data is! Map) {
        _armMem[malId] = _ArmEntry(at: _now, neg: true);
        return null;
      }
      final j = r.data as Map;
      final entry = _ArmEntry(
        at: _now,
        kitsu: (j['kitsu'] as num?)?.toInt(),
        anilist: (j['anilist'] as num?)?.toInt(),
      );
      _armMem[malId] = entry;
      return entry;
    }();
    _armInflight[malId] = p;
    return p.whenComplete(() {
      _armInflight.remove(malId);
    });
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  /// A rate-limited GET: requests are serialized with a [minInterval] gap so the
  /// Jikan rate limit is respected. Ported from `throttledJikanFetch`.
  Future<JsonResponse?> _throttledGet(String url) {
    final completer = Completer<JsonResponse?>();
    _queue = _queue.then((_) async {
      completer.complete(await _get(url));
      await Future<void>.delayed(minInterval);
    });
    return completer.future;
  }

  Future<JsonResponse?> _get(String url) async {
    try {
      return await _transport.getJson(url);
    } catch (_) {
      return null;
    }
  }

  static List<Map<String, dynamic>> _dataList(Object? data) => [
    if (data is Map && data['data'] is List)
      for (final x in data['data'] as List)
        if (x is Map) x.cast<String, dynamic>(),
  ];
}
