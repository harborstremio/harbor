import 'divider_filter.dart';
import 'm3u.dart';
import 'playlist.dart';
import 'xtream.dart';

/// The resolved shape of an IPTV source. Ported from `iptv/ingest/detect.ts`
/// `ProviderShape`.
sealed class ProviderShape {
  const ProviderShape();
}

/// An Xtream Codes server with resolved credentials.
class XtreamShape extends ProviderShape {
  const XtreamShape(this.creds);
  final XtreamCreds creds;
}

/// A raw M3U/M3U8 playlist URL. [middleware] marks hosts (Threadfin/xTeVe/…)
/// whose bare URL may need a playlist path probed.
class M3uShape extends ProviderShape {
  const M3uShape(this.url, this.middleware);
  final String url;
  final bool middleware;
}

/// A standalone XMLTV EPG URL.
class EpgShape extends ProviderShape {
  const EpgShape(this.url);
  final String url;
}

/// An unusable source, with a human-readable [reason].
class InvalidShape extends ProviderShape {
  const InvalidShape(this.reason);
  final String reason;
}

/// Resolves Xtream credentials for a source (structured login first, then the
/// URL), or null. Ports `iptv/ingest/xtream-creds.ts` `credsFromSource`.
XtreamCreds? credsFromSource(IptvPlaylistSource src) {
  final x = src.xtream;
  if (x != null) {
    final fromStructured = credsFromServer(x.server, x.username, x.password);
    if (fromStructured != null) return fromStructured;
  }
  return parseXtreamUrl(src.url);
}

/// Whether a URL parses as an Xtream `get.php`/`player_api.php` link. Ports
/// `looksLikeXtreamUrl`.
bool looksLikeXtreamUrl(String url) => parseXtreamUrl(url) != null;

final RegExp _middlewarePathRe = RegExp(
  r'/(iptv|m3u|playlist|xmltv|threadfin|xteve)\b',
  caseSensitive: false,
);
final RegExp _rawM3uRe = RegExp(r'\.m3u8?(\?|$)', caseSensitive: false);

/// Classifies an IPTV source into an Xtream / M3U / EPG / invalid shape. Ports
/// `detectProviderShape`.
ProviderShape detectProviderShape(IptvPlaylistSource src) {
  if ((src.kind ?? IptvSourceKind.m3u) == IptvSourceKind.epg) {
    final raw = (src.epgUrl != null && src.epgUrl!.isNotEmpty)
        ? src.epgUrl!
        : src.url;
    final url = raw.trim();
    if (url.isEmpty) return const InvalidShape('EPG source has no URL.');
    return EpgShape(url);
  }

  final creds = credsFromSource(src);
  if (creds != null || src.kind == IptvSourceKind.xtream) {
    if (creds != null) return XtreamShape(creds);
    return const InvalidShape(
      'Xtream credentials are incomplete. Check the server URL, username, '
      'and password.',
    );
  }

  final url = src.url.trim();
  if (url.isEmpty) return const InvalidShape('Playlist source has no URL.');
  if (!RegExp(r'^https?://', caseSensitive: false).hasMatch(url)) {
    return const InvalidShape(
      'That does not look like a playlist URL. Use an http(s) M3U link or '
      'Xtream server.',
    );
  }
  return M3uShape(url, _isMiddlewareUrl(url));
}

bool _isMiddlewareUrl(String url) {
  final u = Uri.tryParse(url);
  if (u == null) return false;
  final path = u.path;
  if (_rawM3uRe.hasMatch(path)) return false;
  if (_middlewarePathRe.hasMatch(path)) return true;
  final isBareHost = path == '/' || path.isEmpty;
  return isBareHost && !u.hasQuery;
}

/// Shapes a channel list into an [IptvPlaylist], dropping divider rows and
/// deriving the sorted unique group list. Ports `iptv/store.ts` `shapePlaylist`.
/// [nowMs] overrides the fetch timestamp (for tests).
IptvPlaylist shapePlaylist(
  IptvPlaylistSource src,
  List<IptvChannel> channels, {
  int? nowMs,
}) {
  final cleaned = filterChannelsForDisplay(channels);
  return IptvPlaylist(
    id: src.id,
    name: src.name,
    url: src.url,
    epgUrl: src.epgUrl,
    channels: cleaned,
    fetchedAt: nowMs ?? DateTime.now().millisecondsSinceEpoch,
    groups: _uniqueGroups(cleaned),
  );
}

List<String> _uniqueGroups(List<IptvChannel> channels) {
  final set = <String>{};
  for (final c in channels) {
    final g = c.group;
    if (g != null && g.isNotEmpty) set.add(g);
  }
  return set.toList()..sort((a, b) => a.compareTo(b));
}
