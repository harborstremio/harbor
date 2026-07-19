import 'dart:async';

import '../../core/http/json_transport.dart';
import '../../core/http/text_transport.dart';
import 'ingest.dart';
import 'm3u.dart';
import 'm3u_fetch.dart';
import 'playlist.dart';
import 'xtream.dart';

/// Middleware playlist paths probed when a bare/middleware host doesn't return
/// an M3U directly. Ported from `iptv/ingest/load.ts` `MIDDLEWARE_CANDIDATES`.
const List<String> middlewareCandidates = [
  '/iptv/m3u',
  '/m3u',
  '/playlist.m3u',
  '/get.php?type=m3u_plus',
];

/// A fire-and-forget VOD/series hydrator invoked once live channels load.
typedef VodHydrator =
    Future<void> Function(
      IptvPlaylistSource src,
      XtreamCreds creds,
      List<IptvChannel> live,
    );

/// Loads a playlist for a resolved [shape], dispatching to the Xtream, M3U, or
/// EPG loader (or throwing for an invalid shape). Ports `loadFromShape`.
Future<IptvPlaylist> loadFromShape(
  IptvPlaylistSource src,
  ProviderShape shape, {
  required JsonTransport json,
  required TextTransport text,
  required String container,
  required int nowMs,
  VodHydrator? hydrateVod,
}) async {
  switch (shape) {
    case InvalidShape(:final reason):
      throw IptvFetchError(reason);
    case EpgShape(:final url):
      return shapePlaylist(src.copyWith(url: url), const [], nowMs: nowMs);
    case XtreamShape(:final creds):
      return _loadXtream(
        src,
        creds,
        json: json,
        container: container,
        nowMs: nowMs,
        hydrateVod: hydrateVod,
      );
    case M3uShape(:final url, :final middleware):
      return _loadM3u(src, url, middleware, text: text, nowMs: nowMs);
  }
}

Future<IptvPlaylist> _loadXtream(
  IptvPlaylistSource src,
  XtreamCreds creds, {
  required JsonTransport json,
  required String container,
  required int nowMs,
  VodHydrator? hydrateVod,
}) async {
  final caps = await fetchXtreamUserInfo(json, creds);
  final live = await fetchXtreamLiveChannels(
    json,
    creds,
    src.id,
    container: container,
    caps: caps,
  );
  if (live.isEmpty) {
    throw XtreamEmptyError(
      'Logged in to the Xtream server, but it returned no live channels. The '
      'account may have no active package.',
    );
  }
  if (hydrateVod != null) unawaited(hydrateVod(src, creds, live));
  return shapePlaylist(src, live, nowMs: nowMs);
}

Future<IptvPlaylist> _loadM3u(
  IptvPlaylistSource src,
  String url,
  bool middleware, {
  required TextTransport text,
  required int nowMs,
}) async {
  final body = await fetchM3uText(text, url);
  if (_isM3u(body)) return _parseAndShape(src, body, nowMs);
  if (middleware) {
    final recovered = await _probeMiddleware(text, url);
    if (recovered != null) {
      return _parseAndShape(
        src.copyWith(url: recovered.url),
        recovered.text,
        nowMs,
      );
    }
  }
  final head = body.length > 120 ? body.substring(0, 120) : body;
  final preview = head.replaceAll(RegExp(r'\s+'), ' ');
  throw IptvFetchError(
    'Server response was not an M3U playlist. Got: '
    '${preview.isEmpty ? '(empty)' : preview}',
  );
}

Future<({String url, String text})?> _probeMiddleware(
  TextTransport t,
  String baseUrl,
) async {
  final u = Uri.tryParse(baseUrl);
  if (u == null || u.host.isEmpty) return null;
  final origin = '${u.scheme}://${u.authority}';
  for (final path in middlewareCandidates) {
    final candidate = origin + path;
    if (candidate == baseUrl) continue;
    try {
      final body = await fetchM3uText(t, candidate);
      if (_isM3u(body)) return (url: candidate, text: body);
    } catch (_) {
      continue;
    }
  }
  return null;
}

bool _isM3u(String text) {
  var s = text;
  if (s.startsWith('﻿')) s = s.substring(1);
  return s.trimLeft().startsWith('#EXTM3U');
}

IptvPlaylist _parseAndShape(IptvPlaylistSource src, String text, int nowMs) {
  final channels = parseM3u(text, src.id);
  if (channels.isEmpty) {
    throw const IptvFetchError('Playlist parsed but contained no channels.');
  }
  return shapePlaylist(src, channels, nowMs: nowMs);
}
