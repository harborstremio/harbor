import 'dart:convert';
import 'dart:math' as math;

import '../../core/storage/kv_store.dart';
import '../addons/models.dart';
import '../awards/awards_history.dart';
import '../awards/wikidata_awards.dart';
import '../catalog/tmdb.dart' show TmdbClient;

/// The award categories that seed the Discover "Award Winning" row, ported 1:1
/// from `SOURCES`.
const List<(AwardType, AwardCategory)> _sources = [
  (AwardType.oscar, (key: 'best_picture', name: 'Best Picture')),
  (AwardType.oscar, (key: 'best_director', name: 'Best Director')),
  (
    AwardType.oscar,
    (key: 'best_international_feature', name: 'Best International Feature'),
  ),
  (
    AwardType.oscar,
    (key: 'best_animated_feature', name: 'Best Animated Feature'),
  ),
  (AwardType.bafta, (key: 'best_film', name: 'Best Film')),
  (AwardType.bafta, (key: 'best_director', name: 'Best Director')),
  (AwardType.cannes, (key: 'palme_dor', name: "Palme d'Or")),
  (AwardType.goldenGlobe, (key: 'best_picture_drama', name: 'Best Drama')),
  (
    AwardType.goldenGlobe,
    (key: 'best_picture_musical_comedy', name: 'Best Musical or Comedy'),
  ),
  (AwardType.criticsChoice, (key: 'best_picture', name: 'Best Picture')),
  (AwardType.venice, (key: 'golden_lion', name: 'Golden Lion')),
];

String _normTitle(String s) =>
    s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();

Future<List<R>> _mapLimit<T, R>(
  List<T> items,
  int limit,
  Future<R> Function(T) fn,
) async {
  final out = <R>[];
  for (var i = 0; i < items.length; i += limit) {
    final slice = items.sublist(i, math.min(i + limit, items.length));
    out.addAll(await Future.wait(slice.map(fn)));
  }
  return out;
}

/// Resolves the award-winning movies for the Discover feed: the newest winner of
/// each seeded category, searched on TMDB, de-duped and cached. Ported 1:1 from
/// `award-winners.ts` — the module memo/inflight/localStorage cache become
/// instance state plus a [KvStore] cache under `harbor.discover.awards.v1`.
class AwardWinnersResolver {
  AwardWinnersResolver(this._history, this._tmdb, this._kv);

  final AwardsHistory _history;
  final TmdbClient _tmdb;
  final KvStore _kv;

  static const _cacheKey = 'harbor.discover.awards.v1';
  static const _maxTitles = 150;
  static const _perPage = 24;
  static const _batch = 12;

  List<MetaPreview>? _memo;
  Future<List<MetaPreview>>? _inflight;

  /// A page of resolved award winners (24 per page). Empty without a TMDB key.
  /// Ported from `fetchAwardWinners`.
  Future<List<MetaPreview>> page([int page = 1]) async {
    if (!_tmdb.hasKey) return const [];
    final all = await _resolveAll();
    final start = (page - 1) * _perPage;
    if (start >= all.length) return const [];
    return all.sublist(start, math.min(start + _perPage, all.length));
  }

  Future<List<MetaPreview>> _resolveAll() {
    final memo = _memo;
    if (memo != null) return Future.value(memo);
    final cached = _readCache();
    if (cached != null) {
      _memo = cached;
      return Future.value(cached);
    }
    final inflight = _inflight;
    if (inflight != null) return inflight;
    final future = _resolve();
    _inflight = future;
    return future.whenComplete(() => _inflight = null);
  }

  Future<List<MetaPreview>> _resolve() async {
    final titles = _winnerTitles();
    final hits = await _mapLimit(
      titles,
      _batch,
      (t) => _tmdb.searchTitle('movie', t.title, year: t.year),
    );
    final seen = <String>{};
    final metas = <MetaPreview>[];
    for (final m in hits) {
      if (m == null || m.poster == null || seen.contains(m.id)) continue;
      seen.add(m.id);
      metas.add(m);
    }
    _memo = metas;
    if (metas.length >= 20) {
      try {
        await _kv.setString(
          _cacheKey,
          jsonEncode([for (final m in metas) m.json]),
        );
      } catch (_) {
        // A failed cache write is non-fatal; the memo still holds the result.
      }
    }
    return metas;
  }

  List<({String title, int year})> _winnerTitles() {
    final byKey = <String, ({String title, int year})>{};
    for (final (award, category) in _sources) {
      for (final group in _history.readAwardHistory(award, [category])) {
        for (final e in group.entries) {
          final k = _normTitle(e.workTitle);
          if (k.isEmpty) continue;
          final prev = byKey[k];
          if (prev == null || e.year > prev.year) {
            byKey[k] = (title: e.workTitle, year: e.year);
          }
        }
      }
    }
    final list = byKey.values.toList()
      ..sort((a, b) => b.year.compareTo(a.year));
    return list.take(_maxTitles).toList();
  }

  List<MetaPreview>? _readCache() {
    final raw = _kv.getString(_cacheKey);
    if (raw == null) return null;
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! List || parsed.isEmpty) return null;
      return [
        for (final m in parsed)
          if (m is Map) MetaPreview(m.cast<String, dynamic>()),
      ];
    } catch (_) {
      return null;
    }
  }
}
