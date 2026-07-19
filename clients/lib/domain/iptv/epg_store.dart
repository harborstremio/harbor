import 'dart:async';
import 'dart:typed_data';

import '../../core/http/bytes_transport.dart';
import 'm3u_fetch.dart';
import 'xmltv.dart';

const String _epgAccept =
    'application/xml, text/xml, application/octet-stream, */*';

/// An EPG fetch/parse failure with a human-readable message.
class EpgFetchError implements Exception {
  const EpgFetchError(this.message);
  final String message;
  @override
  String toString() => 'EpgFetchError: $message';
}

/// Loads, caches, and de-duplicates XMLTV EPG fetches, with multi-URL fallback.
/// Ports the module state of `iptv/epg-store.ts` into an injectable, testable
/// object (Riverpod wraps one instance).
///
/// The web reader streams and merges programmes progressively for UI feedback;
/// natively we fetch the full body and parse it once — the resulting [EpgIndex]
/// is identical, and the web source itself takes this same non-streaming path
/// when a readable stream isn't available.
class EpgStore {
  EpgStore({required BytesTransport bytes, int Function()? clock})
    : _bytes = bytes,
      _clock = clock ?? (() => DateTime.now().millisecondsSinceEpoch);

  final BytesTransport _bytes;
  final int Function() _clock;

  /// Cached EPG indices are reused for 1 hour. Ports `TTL_MS`.
  static const int ttlMs = 60 * 60 * 1000;

  final Map<String, EpgIndex> _cache = {};
  final Map<String, Future<EpgIndex>> _inflight = {};
  final Set<void Function()> _listeners = {};
  bool _notifyScheduled = false;

  /// Subscribes to cache changes; returns an unsubscribe callback. Ports
  /// `subscribeEpg`.
  void Function() subscribe(void Function() fn) {
    _listeners.add(fn);
    return () => _listeners.remove(fn);
  }

  /// The cached EPG index for [playlistId], or null. Ports `getCachedEpg`.
  EpgIndex? cached(String playlistId) => _cache[playlistId];

  /// Clears one (or all) cached EPG indices. Ports `clearEpg`.
  void clear([String? playlistId]) {
    if (playlistId != null) {
      _cache.remove(playlistId);
      _inflight.remove(playlistId);
    } else {
      _cache.clear();
      _inflight.clear();
    }
    _notify();
  }

  /// Loads an EPG index for [playlistId] from the first of [urls] that yields
  /// programmes, honouring the 1h TTL and de-duplicating concurrent loads.
  /// Ports `loadEpg`.
  Future<EpgIndex> load({
    required String playlistId,
    required List<String> urls,
    bool force = false,
  }) {
    final existing = _cache[playlistId];
    if (!force && existing != null && _clock() - existing.fetchedAt < ttlMs) {
      return Future.value(existing);
    }
    final pending = _inflight[playlistId];
    if (pending != null && !force) return pending;
    final promise = _fetchWithFallback(urls, _clock());
    _inflight[playlistId] = promise;
    return _cacheOnResolve(playlistId, promise);
  }

  Future<EpgIndex> _cacheOnResolve(String id, Future<EpgIndex> promise) async {
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

  /// Tries each URL in turn: the first with programmes wins; a URL that only
  /// yields channel metadata is remembered as a last-resort fallback. Ports
  /// `doFetchWithFallback`.
  Future<EpgIndex> _fetchWithFallback(List<String> urls, int nowMs) async {
    if (urls.isEmpty) {
      throw const EpgFetchError('No EPG URL available for this playlist');
    }
    Object? lastErr;
    Map<String, EpgChannelMeta>? lastMeta;
    for (final url in urls) {
      try {
        final parsed = parseXmltvBytes(await _fetchBytes(url));
        if (parsed.channelMeta.isNotEmpty) lastMeta = parsed.channelMeta;
        if (parsed.programs.isEmpty) {
          lastErr = const EpgFetchError('EPG endpoint returned no programs');
          continue;
        }
        return EpgIndex(
          byChannel: indexProgramsByChannel(parsed.programs),
          channelMeta: parsed.channelMeta,
          fetchedAt: nowMs,
        );
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastMeta != null && lastMeta.isNotEmpty) {
      return EpgIndex(
        byChannel: const <String, List<EpgProgram>>{},
        channelMeta: lastMeta,
        fetchedAt: nowMs,
      );
    }
    if (lastErr is Exception) throw lastErr;
    throw EpgFetchError(lastErr?.toString() ?? 'EPG fetch failed');
  }

  Future<Uint8List> _fetchBytes(String url) async {
    final res = await _bytes.getBytes(
      url,
      headers: const {'User-Agent': iptvUserAgent, 'Accept': _epgAccept},
    );
    if (!res.ok) {
      throw EpgFetchError(
        'EPG fetch failed: ${res.statusCode} ${res.reasonPhrase}',
      );
    }
    return res.bytes;
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
