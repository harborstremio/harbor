import 'dart:async';
import 'dart:convert';

import '../../core/storage/kv_store.dart';
import '../addons/addon_client.dart';
import '../addons/addon_url.dart';
import '../addons/models.dart';
import '../catalog/cinemeta.dart';
import 'channel_title.dart';
import 'm3u.dart';

final RegExp _nonHydratable = RegExp(
  r'\b(NEWS|SPORTS?|TALK|RADIO|MUSIC|EVENTS?|WEATHER|DEPORTES?)\b',
);

/// Whether a channel is worth enriching with movie/series metadata (excludes
/// live-only news/sports/talk/radio/music/events/weather channels). Ports
/// `isHydratableChannel`.
bool isHydratableChannel(IptvChannel channel) {
  final hay =
      '${(channel.group ?? '').toUpperCase()} ${channel.name.toUpperCase()}';
  return !_nonHydratable.hasMatch(hay);
}

MetaPreview? _pickBestMatch(List<MetaPreview> list, String query) {
  if (list.isEmpty) return null;
  final q = query.toLowerCase().trim();
  if (q.length < 4) return null;
  for (final m in list) {
    if (m.name.toLowerCase().trim() == q) return m;
  }
  return null;
}

void _lruSet<K, V>(Map<K, V> map, K key, V value, int max) {
  map.remove(key);
  map[key] = value;
  while (map.length > max) {
    map.remove(map.keys.first);
  }
}

class _CacheEntry {
  const _CacheEntry(this.meta, this.at);
  final Map<String, dynamic>? meta;
  final int at;
}

/// Enriches named IPTV channels with Cinemeta movie/series metadata (a poster
/// for logo-less channels), memoizing name→query, caching results with a 7-day
/// TTL + LRU cap, de-duplicating in-flight fetches, and persisting the cache.
/// Ports `iptv/channel-hydration.ts` into an injectable object.
class ChannelHydrator {
  ChannelHydrator(this._client, {KvStore? kv, int Function()? clock})
    : _kv = kv,
      _clock = clock ?? (() => DateTime.now().millisecondsSinceEpoch);

  final AddonClient _client;
  final KvStore? _kv;
  final int Function() _clock;

  static const String _storageKey = 'harbor.iptv.hydration.v2';
  static const int _ttlMs = 7 * 24 * 60 * 60 * 1000;
  static const int _maxCache = 5000;
  static const int _channelToQueryMax = 2000;

  final Map<String, _CacheEntry> _queryCache = {};
  final Map<String, String?> _channelToQuery = {};
  final Map<String, Future<Meta?>> _inflight = {};
  bool _loaded = false;

  void _loadCache() {
    if (_loaded) return;
    _loaded = true;
    final kv = _kv;
    final raw = kv?.getString(_storageKey);
    if (raw == null) return;
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! Map) return;
      final now = _clock();
      for (final e in parsed.entries) {
        final v = e.value;
        if (v is Map &&
            v['at'] is num &&
            now - (v['at'] as num).toInt() < _ttlMs) {
          final meta = v['meta'];
          _lruSet(
            _queryCache,
            e.key.toString(),
            _CacheEntry(
              meta is Map ? meta.cast<String, dynamic>() : null,
              (v['at'] as num).toInt(),
            ),
            _maxCache,
          );
        }
      }
    } catch (_) {}
  }

  void _persist() {
    final kv = _kv;
    if (kv == null) return;
    final entries = _queryCache.entries.toList();
    final trimmed = entries.length > _maxCache
        ? entries.sublist(entries.length - _maxCache)
        : entries;
    final obj = <String, dynamic>{
      for (final e in trimmed) e.key: {'meta': e.value.meta, 'at': e.value.at},
    };
    unawaited(kv.setString(_storageKey, jsonEncode(obj)));
  }

  (String?, String?) _queryForChannel(String channelName) {
    if (_channelToQuery.containsKey(channelName)) {
      return (_channelToQuery[channelName], null);
    }
    final extracted = extractTitleFromChannelName(channelName);
    _lruSet(_channelToQuery, channelName, extracted.query, _channelToQueryMax);
    return (extracted.query, extracted.preferType);
  }

  /// Resolves the channel's metadata (from cache or Cinemeta), or null. Ports
  /// `hydrateChannel`.
  Future<Meta?> hydrate(String channelName) {
    _loadCache();
    final (query, preferType) = _queryForChannel(channelName);
    if (query == null) return Future.value();
    final cached = _queryCache[query];
    if (cached != null) {
      return Future.value(cached.meta == null ? null : Meta(cached.meta!));
    }
    final existing = _inflight[query];
    if (existing != null) return existing;
    final promise = _doHydrate(query, preferType).then((meta) {
      _lruSet(_queryCache, query, _CacheEntry(meta?.json, _clock()), _maxCache);
      _persist();
      return meta;
    });
    _inflight[query] = promise;
    promise.whenComplete(() => _inflight.remove(query));
    return promise;
  }

  Future<Meta?> _doHydrate(String query, String? preferType) async {
    final types = preferType == 'movie'
        ? const ['movie', 'series']
        : const ['series', 'movie'];
    for (final type in types) {
      try {
        final list =
            (await _client.catalog(
              cinemetaBase,
              type,
              'top',
              extras: [CatalogExtra('search', query)],
            )).valueOrNull ??
            const <MetaPreview>[];
        final match = _pickBestMatch(list, query);
        if (match != null) {
          final full = (await _client.meta(
            cinemetaBase,
            type,
            match.id,
          )).valueOrNull;
          return full ?? Meta(match.json);
        }
      } catch (_) {}
    }
    return null;
  }
}
