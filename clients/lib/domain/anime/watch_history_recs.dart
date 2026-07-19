import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/storage/kv_store.dart';
import '../addons/models.dart';
import 'jikan.dart';
import 'jikan_client.dart';

/// "Because you watched" anime recommendations, ported 1:1 from web
/// `use-watch-history-recs.ts`. Seeds from the first 6 `kitsu:`/`mal:` continue-
/// watching titles, resolves each to a MAL id, pulls Jikan recommendations, and
/// aggregates the pools by franchise with a rank-decayed weight so a title that
/// several watched shows recommend rises to the top.
///
/// Two caches — the MAL-id-by-franchise resolution and the per-MAL-id rec pool
/// (30-day TTL) — persist to [KvStore] under the same keys/shape as the web, so
/// a browsing session never re-hits Jikan (which rate-limits aggressively) for
/// a title it already resolved, even across app launches.
const _malCacheKey = 'harbor.anime.mal_id_by_franchise.v1';
const _recCacheKey = 'harbor.anime.recs_by_mal.v1';
const _recTtlMs = 30 * 24 * 60 * 60 * 1000; // 30 days

Map<String, int?>? _malCache;
Map<String, _RecHit>? _recCache;

class _RecHit {
  const _RecHit(this.metas, this.t);
  final List<MetaPreview> metas;
  final int t;
}

/// Clears the process-level caches. Test-only — production hydrates lazily and
/// never needs a reset, but a shared cache would leak between test cases.
@visibleForTesting
void resetWatchHistoryRecsCaches() {
  _malCache = null;
  _recCache = null;
}

Map<String, int?> _loadMalCache(KvStore kv) {
  if (_malCache != null) return _malCache!;
  try {
    final raw = kv.getString(_malCacheKey);
    final decoded = raw == null ? const {} : jsonDecode(raw) as Map;
    _malCache = {
      for (final e in decoded.entries)
        e.key as String: (e.value as num?)?.toInt(),
    };
  } catch (_) {
    _malCache = {};
  }
  return _malCache!;
}

Map<String, _RecHit> _loadRecCache(KvStore kv) {
  if (_recCache != null) return _recCache!;
  try {
    final raw = kv.getString(_recCacheKey);
    final decoded = raw == null ? const {} : jsonDecode(raw) as Map;
    _recCache = {
      for (final e in decoded.entries)
        e.key as String: _RecHit(
          [
            for (final m in (((e.value as Map)['metas'] as List?) ?? const []))
              if (m is Map) MetaPreview(m.cast<String, dynamic>()),
          ],
          ((e.value as Map)['t'] as num?)?.toInt() ?? 0,
        ),
    };
  } catch (_) {
    _recCache = {};
  }
  return _recCache!;
}

Future<void> _save(KvStore kv) async {
  try {
    await kv.setString(_malCacheKey, jsonEncode(_malCache ?? const {}));
    await kv.setString(
      _recCacheKey,
      jsonEncode({
        for (final e in (_recCache ?? const {}).entries)
          e.key: {
            'metas': [for (final m in e.value.metas) m.json],
            't': e.value.t,
          },
      }),
    );
  } catch (_) {
    // Storage quota — the caches stay in-memory for the session, matching web.
  }
}

int? _extractMalIdFromId(String id) {
  final m = RegExp(r'^mal:(\d+)').firstMatch(id);
  return m == null ? null : int.tryParse(m.group(1)!);
}

/// Resolves a continue-watching item to its MAL id — directly from a `mal:<id>`
/// id, else by franchise-name search through Jikan (cached). Shared with the
/// top-picks sequel step. Ported from web `malIdForItem`.
Future<int?> malIdForItem(
  JikanClient jikan,
  KvStore kv,
  ({String id, String name}) item,
) async {
  final direct = _extractMalIdFromId(item.id);
  if (direct != null) return direct;
  final cache = _loadMalCache(kv);
  final fk = animeFranchiseKey(stripFranchiseSuffix(item.name));
  // `containsKey` (not `!= null`) so a prior "resolved to nothing" (null) is a
  // cache HIT, not re-queried — mirrors the web `fk in cache` check.
  if (cache.containsKey(fk)) return cache[fk];
  final id = await jikan.resolveMalId(stripFranchiseSuffix(item.name));
  cache[fk] = id;
  return id;
}

Future<List<MetaPreview>> _recsForMalId(
  JikanClient jikan,
  KvStore kv,
  int malId,
) async {
  final cache = _loadRecCache(kv);
  final hit = cache['$malId'];
  final now = DateTime.now().millisecondsSinceEpoch;
  if (hit != null && now - hit.t < _recTtlMs) return hit.metas;
  final metas = await jikan.recommendationsForMalId(malId);
  cache['$malId'] = _RecHit(metas, now);
  return metas;
}

/// The aggregated recommendation list from up to six recent anime watches.
/// Ported 1:1 from `useWatchHistoryRecommendations` (as a pure async fetch — the
/// engine layer owns reactivity). Titles already in the watch history (same
/// franchise) are dropped; the rest are ranked by summed rank-decayed weight.
Future<List<MetaPreview>> watchHistoryRecommendations(
  JikanClient jikan,
  KvStore kv,
  List<({String id, String name})> cwItems,
) async {
  final seeds = cwItems
      .take(6)
      .where(
        (i) =>
            i.name.isNotEmpty &&
            (i.id.startsWith('kitsu:') || i.id.startsWith('mal:')),
      )
      .toList();
  if (seeds.isEmpty) return const [];

  final watchedKeys = {
    for (final s in seeds) animeFranchiseKey(stripFranchiseSuffix(s.name)),
  };
  final scoreByKey = <String, ({MetaPreview meta, double score})>{};
  for (final item in seeds) {
    final malId = await malIdForItem(jikan, kv, item);
    if (malId == null) continue;
    final pool = await _recsForMalId(jikan, kv, malId);
    for (var i = 0; i < pool.length; i++) {
      final m = pool[i];
      final fk = animeFranchiseKey(m.name);
      if (watchedKeys.contains(fk)) continue;
      final weight = 1 + (12 - i).clamp(0, 12) * 0.05;
      final existing = scoreByKey[fk];
      if (existing != null) {
        scoreByKey[fk] = (meta: existing.meta, score: existing.score + weight);
      } else {
        scoreByKey[fk] = (meta: m, score: weight);
      }
    }
  }
  await _save(kv);

  final entries = scoreByKey.values.toList()
    ..sort((a, b) => b.score.compareTo(a.score));
  return [for (final e in entries) e.meta];
}
