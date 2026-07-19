import 'dart:async';

import '../../core/http/json_transport.dart';
import '../../core/http/text_transport.dart';
import 'ingest.dart';
import 'load.dart';
import 'm3u.dart';
import 'playlist.dart';
import 'xtream.dart';
import 'xtream_vod.dart';

/// Loads, caches, and de-duplicates IPTV playlist fetches, hydrating Xtream VOD
/// in the background. Ports the module state of `iptv/store.ts` into an
/// injectable, testable object (Riverpod wraps one instance).
class IptvPlaylistStore {
  IptvPlaylistStore({
    required JsonTransport json,
    required TextTransport text,
    String Function()? liveContainer,
    int Function()? clock,
  }) : _json = json,
       _text = text,
       _liveContainer = liveContainer ?? (() => 'ts'),
       _clock = clock ?? (() => DateTime.now().millisecondsSinceEpoch);

  final JsonTransport _json;
  final TextTransport _text;
  final String Function() _liveContainer;
  final int Function() _clock;

  /// Cached playlists are reused for 6 hours. Ports `CACHE_TTL_MS`.
  static const int cacheTtlMs = 6 * 60 * 60 * 1000;

  final Map<String, IptvPlaylist> _cache = {};
  final Map<String, Future<IptvPlaylist>> _inflight = {};
  final Set<String> _vodHydrated = {};
  final Set<void Function()> _listeners = {};
  bool _notifyScheduled = false;

  /// Subscribes to cache changes; returns an unsubscribe callback. Ports
  /// `subscribePlaylists`.
  void Function() subscribe(void Function() fn) {
    _listeners.add(fn);
    return () => _listeners.remove(fn);
  }

  /// The cached playlist for [id], or null. Ports `getCachedPlaylist`.
  IptvPlaylist? cached(String id) => _cache[id];

  /// Clears one (or all) cached playlists and their hydration state. Ports
  /// `clearPlaylistCache`.
  void clear([String? id]) {
    if (id != null) {
      _cache.remove(id);
      _vodHydrated.remove(id);
      _inflight.remove(id);
      clearSeriesInfoCache(id);
    } else {
      _cache.clear();
      _vodHydrated.clear();
      _inflight.clear();
      clearSeriesInfoCache();
    }
    _notify();
  }

  /// Loads a playlist, honouring the 6h TTL and de-duplicating concurrent
  /// loads for the same source. Ports `loadPlaylist`.
  Future<IptvPlaylist> load(IptvPlaylistSource src, {bool force = false}) {
    final existing = _cache[src.id];
    if (!force &&
        existing != null &&
        _clock() - existing.fetchedAt < cacheTtlMs) {
      return Future.value(existing);
    }
    final pending = _inflight[src.id];
    if (pending != null && !force) return pending;
    final promise = loadFromShape(
      src,
      detectProviderShape(src),
      json: _json,
      text: _text,
      container: _liveContainer(),
      nowMs: _clock(),
      hydrateVod: _hydrateVod,
    );
    _inflight[src.id] = promise;
    return _cacheOnResolve(src.id, promise);
  }

  Future<IptvPlaylist> _cacheOnResolve(
    String id,
    Future<IptvPlaylist> promise,
  ) async {
    try {
      final result = await promise;
      if (identical(_inflight[id], promise)) {
        _cache[id] = result;
        _notify();
      }
      return result;
    } finally {
      if (identical(_inflight[id], promise)) _inflight.remove(id);
    }
  }

  Future<void> _hydrateVod(
    IptvPlaylistSource src,
    XtreamCreds creds,
    List<IptvChannel> live,
  ) async {
    if (!_markVodHydrated(src.id)) return;
    try {
      final vod = await fetchXtreamVodAndSeries(_json, creds, src.id);
      if (vod.isEmpty) return;
      _commitHydrated(src, [...live, ...vod]);
    } catch (_) {
      _unmarkVodHydrated(src.id);
    }
  }

  bool _markVodHydrated(String id) {
    if (_vodHydrated.contains(id)) return false;
    _vodHydrated.add(id);
    return true;
  }

  void _unmarkVodHydrated(String id) => _vodHydrated.remove(id);

  void _commitHydrated(IptvPlaylistSource src, List<IptvChannel> channels) {
    if (!_cache.containsKey(src.id)) return;
    _cache[src.id] = shapePlaylist(src, channels, nowMs: _clock());
    _notify();
  }

  void _notify() {
    if (_notifyScheduled) return;
    _notifyScheduled = true;
    scheduleMicrotask(() {
      _notifyScheduled = false;
      for (final l in [..._listeners]) {
        l();
      }
    });
  }
}
