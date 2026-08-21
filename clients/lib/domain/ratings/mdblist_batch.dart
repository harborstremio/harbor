import 'dart:async';
import 'dart:convert';

import '../../core/http/json_transport.dart';
import '../../core/storage/kv_store.dart';

/// The per-card cross-site scores fetched in a batch, ported from the web
/// `mdblist-batch.ts` `CardScores`. Distinct from the single-title
/// `MdblistScores` (detail page) — this is the light per-poster set.
class CardScores {
  const CardScores({
    this.rtAudience,
    this.metacritic,
    this.letterboxd,
    this.trakt,
    this.score,
  });

  final double? rtAudience;
  final double? metacritic;
  final double? letterboxd;
  final double? trakt;
  final double? score;

  bool get isEmpty =>
      rtAudience == null &&
      metacritic == null &&
      letterboxd == null &&
      trakt == null &&
      score == null;

  Map<String, dynamic> toJson() => {
    if (rtAudience != null) 'rtAudience': rtAudience,
    if (metacritic != null) 'metacritic': metacritic,
    if (letterboxd != null) 'letterboxd': letterboxd,
    if (trakt != null) 'trakt': trakt,
    if (score != null) 'score': score,
  };

  factory CardScores.fromJson(Map<String, dynamic> j) => CardScores(
    rtAudience: (j['rtAudience'] as num?)?.toDouble(),
    metacritic: (j['metacritic'] as num?)?.toDouble(),
    letterboxd: (j['letterboxd'] as num?)?.toDouble(),
    trakt: (j['trakt'] as num?)?.toDouble(),
    score: (j['score'] as num?)?.toDouble(),
  );
}

class _Entry {
  const _Entry(this.value, this.t);
  final CardScores? value;
  final int t;
}

/// Batches poster-card MDBList score lookups: [request] queues an imdb id and
/// returns a future that completes when the next debounced [flush] resolves its
/// `kind` batch (or immediately from the TTL cache). Ports `mdblist-batch.ts`
/// (queue → debounce → POST `/imdb/{kind}` with `{ids}` → cache + persist, with
/// a 429 backoff). The api key + a stub transport are injected for testing.
class MdblistBatchStore {
  MdblistBatchStore(
    this._transport,
    this._kv, {
    int Function()? nowMs,
    Duration flushDelay = const Duration(milliseconds: 300),
  }) : _nowMs = nowMs ?? (() => DateTime.now().millisecondsSinceEpoch),
       _flushDelay = flushDelay;

  static const _lsKey = 'harbor.mdblist.cards';
  static const _ttlMs = 24 * 60 * 60 * 1000;
  static const _backoffMs = 10 * 60 * 1000;
  static const _maxBatch = 100;
  static const _lsCap = 1500;

  final JsonTransport _transport;
  final KvStore _kv;
  final int Function() _nowMs;
  final Duration _flushDelay;

  final Map<String, _Entry> _cache = {};
  final Map<String, List<Completer<CardScores?>>> _waiters = {};
  final Set<String> _movieQueue = {};
  final Set<String> _showQueue = {};
  Timer? _flushTimer;
  int _blockedUntil = 0;
  String _apiKey = '';
  bool _loaded = false;

  /// Queues [imdbId] (`kind` = movie|show) and returns its scores — from the
  /// TTL cache immediately, or via the next batch flush. Null (no future work)
  /// when the key/id is unusable or the store is backing off after a 429.
  Future<CardScores?> request(String apiKey, String imdbId, String kind) {
    _ensureLoaded();
    _apiKey = apiKey.trim();
    final ck = '$kind:$imdbId';
    final cached = _fresh(ck);
    if (cached != null) return Future.value(cached.value);
    if (_apiKey.isEmpty ||
        !imdbId.startsWith('tt') ||
        _nowMs() < _blockedUntil) {
      return Future.value(null);
    }
    final completer = Completer<CardScores?>();
    (_waiters[ck] ??= []).add(completer);
    (kind == 'movie' ? _movieQueue : _showQueue).add(imdbId);
    _flushTimer ??= Timer(_flushDelay, () {
      _flushTimer = null;
      flush();
    });
    return completer.future;
  }

  /// The cached scores for [imdbId], or null when not yet fetched/expired.
  CardScores? cached(String? imdbId, String kind) {
    if (imdbId == null) return null;
    _ensureLoaded();
    return _fresh('$kind:$imdbId')?.value;
  }

  /// Sends the queued batches now (also invoked by the debounce timer).
  Future<void> flush() async {
    _flushTimer?.cancel();
    _flushTimer = null;
    for (final kind in const ['movie', 'show']) {
      final queue = kind == 'movie' ? _movieQueue : _showQueue;
      final ids = queue.take(_maxBatch).toList();
      if (ids.isEmpty) continue;
      queue.removeAll(ids);
      if (_apiKey.isEmpty || _nowMs() < _blockedUntil) {
        for (final id in ids) {
          _remember('$kind:$id', null);
        }
        continue;
      }
      await _fetchBatch(kind, ids);
    }
    _persist();
    if ((_movieQueue.isNotEmpty || _showQueue.isNotEmpty) &&
        _flushTimer == null) {
      _flushTimer = Timer(_flushDelay, () {
        _flushTimer = null;
        flush();
      });
    }
  }

  Future<void> _fetchBatch(String kind, List<String> ids) async {
    final url =
        'https://api.mdblist.com/imdb/$kind/'
        '?apikey=${Uri.encodeQueryComponent(_apiKey)}';
    try {
      final res = await _transport.postJson(
        url,
        body: {'ids': ids},
        headers: const {'Content-Type': 'application/json'},
      );
      if (res.ok) {
        final arr = res.data is List ? res.data as List : const [];
        final got = <String>{};
        for (final raw in arr) {
          if (raw is! Map) continue;
          final item = raw.cast<String, dynamic>();
          final id = _extractImdb(item);
          if (id == null) continue;
          got.add(id);
          _remember('$kind:$id', _scoresFrom(item));
        }
        // Cache a null for any queued id the response omitted, so it isn't
        // re-requested until the TTL lapses.
        for (final id in ids) {
          if (!got.contains(id)) _remember('$kind:$id', null);
        }
        return;
      }
      if (res.statusCode == 429) _blockedUntil = _nowMs() + _backoffMs;
    } on TransportException {
      _blockedUntil = _nowMs() + _backoffMs;
    }
    // A transient failure (429 / network): resolve the pending futures with
    // null but DO NOT cache, so the ids are re-requested after the backoff.
    for (final id in ids) {
      _completeWaiters('$kind:$id', null);
    }
  }

  void _remember(String ck, CardScores? value) {
    _cache[ck] = _Entry(value, _nowMs());
    _completeWaiters(ck, value);
  }

  void _completeWaiters(String ck, CardScores? value) {
    final waiters = _waiters.remove(ck);
    if (waiters == null) return;
    for (final c in waiters) {
      if (!c.isCompleted) c.complete(value);
    }
  }

  _Entry? _fresh(String ck) {
    final e = _cache[ck];
    if (e != null && _nowMs() - e.t < _ttlMs) return e;
    return null;
  }

  void _ensureLoaded() {
    if (_loaded) return;
    _loaded = true;
    final raw = _kv.getString(_lsKey);
    if (raw == null || raw.isEmpty) return;
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! Map) return;
      final now = _nowMs();
      parsed.forEach((k, v) {
        if (v is! Map) return;
        final m = v.cast<String, dynamic>();
        final t = (m['t'] as num?)?.toInt() ?? 0;
        if (t == 0 || now - t >= _ttlMs) return;
        final sv = m['v'];
        _cache[k.toString()] = _Entry(
          sv is Map ? CardScores.fromJson(sv.cast<String, dynamic>()) : null,
          t,
        );
      });
    } catch (_) {
      _kv.remove(_lsKey);
    }
  }

  void _persist() {
    final entries = _cache.entries.toList()
      ..sort((a, b) => b.value.t.compareTo(a.value.t));
    final capped = entries.length > _lsCap
        ? entries.sublist(0, _lsCap)
        : entries;
    _kv.setString(
      _lsKey,
      jsonEncode({
        for (final e in capped)
          e.key: {'v': e.value.value?.toJson(), 't': e.value.t},
      }),
    );
  }

  static String? _extractImdb(Map<String, dynamic> item) {
    final ids = item['ids'];
    final cands = <dynamic>[
      if (ids is Map) ids['imdb'],
      if (ids is Map) ids['imdbid'],
      item['imdbid'],
      item['imdb_id'],
    ];
    for (final c in cands) {
      if (c is String && c.startsWith('tt')) return c;
    }
    return null;
  }

  static double? _ratingFrom(Map<String, dynamic> item, List<String> sources) {
    final rows = item['ratings'];
    if (rows is! List) return null;
    for (final source in sources) {
      for (final r in rows) {
        if (r is Map && r['source'] == source) {
          final v = r['value'];
          if (v is num && v > 0) return v.toDouble();
        }
      }
    }
    return null;
  }

  static double? _scoreFrom(Map<String, dynamic> item) {
    for (final k in const ['score_average', 'scoreaverage', 'score']) {
      final v = item[k];
      if (v is num && v > 0) return v.toDouble();
    }
    return null;
  }

  static CardScores _scoresFrom(Map<String, dynamic> item) => CardScores(
    rtAudience: _ratingFrom(item, const [
      'tomatoesaudience',
      'audience',
      'popcorn',
    ]),
    metacritic: _ratingFrom(item, const ['metacritic']),
    letterboxd: _ratingFrom(item, const ['letterboxd']),
    trakt: _ratingFrom(item, const ['trakt']),
    score: _scoreFrom(item),
  );
}
