import '../../core/abort_signal.dart';
import '../debrid/debrid_types.dart';
import 'cached.dart';
import 'episode_file.dart';
import 'parsed_stream.dart';

/// The outcome of resolving a stream to a playable link, ported from
/// `ResolveResult` in `src/lib/streams/resolve.ts`.
sealed class ResolveResult {
  const ResolveResult();
}

final class ResolveOk extends ResolveResult {
  const ResolveOk(this.data, this.via);
  final DirectLink data;

  /// Which path produced the link: `direct`, a debrid slug, or `p2p`.
  final String via;
}

final class ResolveErr extends ResolveResult {
  const ResolveErr(this.code, this.tried, {this.webUrl});
  final String code;
  final List<({String slug, String code})> tried;

  /// A web page the user could open in a browser (for `web-page`).
  final String? webUrl;
}

/// The result of an HTTP HEAD probe.
class ProbeResult {
  const ProbeResult({required this.ok, this.contentType, this.contentLength});
  final bool ok;
  final String? contentType;
  final int? contentLength;
}

/// Issues HEAD requests to validate a link (reject web pages / stub videos).
/// Injectable so resolution is testable without a network.
abstract interface class LinkProber {
  Future<ProbeResult> head(String url, {Map<String, String>? headers});
}

/// A local P2P torrent engine. The native engine is not yet bundled, so the
/// default [NoTorrentEngine] reports "unavailable" — resolution then relies on
/// debrid. A real engine plugs in here without touching [resolveStream].
abstract interface class TorrentEngine {
  bool eligible(ParsedStream stream);
  bool get directTorrentEnabled;
  Future<DirectLink?> resolve(ParsedStream stream, EpisodeHint? hint);
  String failureCode();
}

/// No local torrent engine — the current native default.
class NoTorrentEngine implements TorrentEngine {
  const NoTorrentEngine();
  @override
  bool eligible(ParsedStream stream) => false;
  @override
  bool get directTorrentEnabled => false;
  @override
  Future<DirectLink?> resolve(ParsedStream stream, EpisodeHint? hint) async =>
      null;
  @override
  String failureCode() => 'direct-torrent-disabled';
}

const int _errorVideoMaxBytes = 80 * 1024 * 1024;
final RegExp _videoExtRe = RegExp(
  r'\.(mkv|mp4|avi|mov|m4v|webm|ts|m3u8|mpd|flv|wmv|m2ts|mpg|mpeg|ogv|3gp)(\?|#|$)',
  caseSensitive: false,
);

/// Resolves a [stream] to a directly-playable link, ported from
/// `resolveStream` in `src/lib/streams/resolve.ts`. Order: forced P2P → direct
/// URL (web-page probe + size validation) → special-source error codes → debrid
/// resolution (cached-first) → local engine. Error codes are load-bearing.
Future<ResolveResult> resolveStream(
  ParsedStream stream,
  List<DebridStore> debrids,
  AbortSignal signal, {
  bool userCommitted = false,
  bool forceP2p = false,
  EpisodeHint? hint,
  LinkProber? prober,
  TorrentEngine engine = const NoTorrentEngine(),
}) async {
  final expectedSize = stream.size;
  final tried = <({String slug, String code})>[];

  if (forceP2p && stream.infoHash != null && engine.eligible(stream)) {
    final direct = await engine.resolve(stream, hint);
    if (direct != null) return ResolveOk(direct, 'p2p');
    return ResolveErr(engine.failureCode(), tried);
  }

  final url = stream.url;
  if (url != null && url != '#') {
    final headers = _requestHeaders(stream);
    final filename = stream.stream.filename;
    if (stream.infoHash == null && !_videoExtRe.hasMatch(url)) {
      if (prober != null && await _probeIsWebPage(prober, url, headers)) {
        return ResolveErr('web-page', const [], webUrl: url);
      }
      if (signal.isAborted) return ResolveErr('aborted', tried);
    }
    final data = DirectLink(
      url: url,
      filename: filename,
      filesize: stream.stream.videoSize,
      headers: headers,
      notWebReady: stream.stream.behaviorHints['notWebReady'] == true
          ? true
          : null,
      subtitles: _subtitles(stream),
    );
    final ok = await _validateLink(
      data,
      expectedSize,
      headers,
      prober,
      allowNetwork: false,
    );
    if (ok) return ResolveOk(data, 'direct');
    tried.add((slug: 'direct', code: 'stub-or-error-video'));
    if (debrids.isEmpty || stream.infoHash == null) {
      return ResolveErr('stub-or-error-video', tried);
    }
  }
  if (url == '#') return const ResolveErr('addon-not-configured', []);
  if (stream.stream.externalUrl != null) {
    return const ResolveErr('external-url-only', []);
  }
  if (stream.stream.ytId != null) return const ResolveErr('youtube-only', []);
  if (stream.stream.nzbUrl != null) {
    return const ResolveErr('nzb-needs-external-player', []);
  }
  if (stream.infoHash == null) return ResolveErr('no-source', tried);

  if (debrids.isEmpty) {
    final direct = await engine.resolve(stream, hint);
    if (direct != null) return ResolveOk(direct, 'p2p');
    return ResolveErr(engine.failureCode(), tried);
  }

  final sorted = _sortDebridsForStream(stream, debrids);
  final anyCached = sorted.any(
    (d) => stream.cached[d.slug] == true || stream.inLibrary[d.slug] == true,
  );
  if (!userCommitted && !anyCached) {
    return ResolveErr('uncached-not-committed', tried);
  }
  if (userCommitted &&
      !anyCached &&
      _hasUncachedMarker(stream) &&
      engine.eligible(stream)) {
    final direct = await engine.resolve(stream, hint);
    if (direct != null) return ResolveOk(direct, 'p2p');
  }

  final magnet = magnetFromHash(stream.infoHash!);
  for (final d in sorted) {
    if (signal.isAborted) return ResolveErr('aborted', tried);
    final r = await d.playableUrl(magnet, stream.fileIdx, signal, hint: hint);
    if (r is! DebridOk<DirectLink>) {
      final code = (r as DebridErr).code;
      tried.add((slug: d.slug.label, code: code));
      if (code == 'aborted') return ResolveErr('aborted', tried);
      continue;
    }
    final link = r.data;
    final ok = await _validateLink(link, expectedSize, link.headers, prober);
    if (ok) return ResolveOk(link, d.slug.label);
    tried.add((slug: d.slug.label, code: 'stub-or-error-video'));
  }

  final direct = await engine.resolve(stream, hint);
  if (direct != null) return ResolveOk(direct, 'p2p');
  if (engine.directTorrentEnabled) {
    return ResolveErr(engine.failureCode(), tried);
  }
  return ResolveErr(
    tried.isNotEmpty ? tried.last.code : 'all-debrids-failed',
    tried,
  );
}

List<DebridStore> _sortDebridsForStream(
  ParsedStream stream,
  List<DebridStore> debrids,
) {
  final indexed = [for (var i = 0; i < debrids.length; i++) (i, debrids[i])];
  indexed.sort((a, b) {
    final ac = stream.cached[a.$2.slug] == true ? 1 : 0;
    final bc = stream.cached[b.$2.slug] == true ? 1 : 0;
    final c = bc - ac;
    return c != 0 ? c : a.$1 - b.$1;
  });
  return [for (final e in indexed) e.$2];
}

Future<bool> _validateLink(
  DirectLink link,
  int? expectedSize,
  Map<String, String>? headers,
  LinkProber? prober, {
  bool allowNetwork = true,
}) async {
  final filesize = link.filesize;
  if (filesize != null && filesize > 0) {
    if (filesize < _errorVideoMaxBytes) {
      if (expectedSize == null || expectedSize > _errorVideoMaxBytes) {
        return false;
      }
    }
    if (expectedSize != null &&
        filesize < expectedSize * 0.4 &&
        expectedSize > 100 * 1024 * 1024) {
      return false;
    }
    return true;
  }
  if (!allowNetwork || prober == null) return true;
  try {
    final res = await prober.head(link.url, headers: headers);
    if (!res.ok) return true;
    final len = res.contentLength;
    if (len == null || len <= 0) return true;
    if (len < _errorVideoMaxBytes &&
        (expectedSize == null || expectedSize > _errorVideoMaxBytes)) {
      return false;
    }
    if (expectedSize != null &&
        len < expectedSize * 0.4 &&
        expectedSize > 100 * 1024 * 1024) {
      return false;
    }
    return true;
  } catch (_) {
    return true;
  }
}

Future<bool> _probeIsWebPage(
  LinkProber prober,
  String url,
  Map<String, String>? headers,
) async {
  try {
    final res = await prober.head(url, headers: headers);
    if (!res.ok) return false;
    final ct = res.contentType ?? '';
    return RegExp(
      r'^\s*(?:text/html|application/xhtml)',
      caseSensitive: false,
    ).hasMatch(ct);
  } catch (_) {
    return false;
  }
}

Map<String, String>? _requestHeaders(ParsedStream stream) {
  final bh = stream.stream.behaviorHints;
  final proxy = bh['proxyHeaders'];
  final req = proxy is Map ? proxy['request'] : null;
  final h = req ?? bh['headers'];
  if (h is Map) {
    return h.map((k, v) => MapEntry(k.toString(), v.toString()));
  }
  return null;
}

List<SubtitleRef>? _subtitles(ParsedStream stream) {
  final subs = stream.stream.raw['subtitles'];
  if (subs is! List) return null;
  return subs
      .whereType<Map>()
      .map(
        (s) => SubtitleRef(
          url: (s['url'] ?? '').toString(),
          lang: s['lang']?.toString(),
          id: s['id']?.toString(),
        ),
      )
      .toList();
}

bool _hasUncachedMarker(ParsedStream stream) => hasUncachedMarker(
  name: stream.stream.name,
  title: stream.stream.title,
  description: stream.stream.description,
);
