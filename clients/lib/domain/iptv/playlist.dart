import 'm3u.dart';

/// The kind of an IPTV source. Ported from the `kind` union of
/// `iptv/types.ts` `IptvPlaylistSource`.
enum IptvSourceKind { m3u, xtream, epg }

/// Structured Xtream login for a source. Ported from the `xtream` field of
/// `IptvPlaylistSource`.
class XtreamSourceCreds {
  const XtreamSourceCreds({
    required this.server,
    required this.username,
    required this.password,
  });
  final String server;
  final String username;
  final String password;

  @override
  bool operator ==(Object other) =>
      other is XtreamSourceCreds &&
      other.server == server &&
      other.username == username &&
      other.password == password;

  @override
  int get hashCode => Object.hash(server, username, password);
}

/// A configured IPTV source: an M3U link, an Xtream login, or a standalone EPG.
/// Ported from `IptvPlaylistSource`.
class IptvPlaylistSource {
  const IptvPlaylistSource({
    required this.id,
    required this.name,
    required this.url,
    this.epgUrl,
    this.kind,
    this.xtream,
  });

  final String id;
  final String name;
  final String url;
  final String? epgUrl;
  final IptvSourceKind? kind;
  final XtreamSourceCreds? xtream;

  /// A copy with [url] replaced (used to swap in a probed/EPG URL).
  IptvPlaylistSource copyWith({String? url}) => IptvPlaylistSource(
    id: id,
    name: name,
    url: url ?? this.url,
    epgUrl: epgUrl,
    kind: kind,
    xtream: xtream,
  );

  @override
  bool operator ==(Object other) =>
      other is IptvPlaylistSource &&
      other.id == id &&
      other.name == name &&
      other.url == url &&
      other.epgUrl == epgUrl &&
      other.kind == kind &&
      other.xtream == xtream;

  @override
  int get hashCode => Object.hash(id, name, url, epgUrl, kind, xtream);
}

/// Parses the settings `iptvPlaylists` blob into sources, skipping entries
/// without a usable id. Mirrors the `iptvPlaylists` shape in the web settings.
List<IptvPlaylistSource> parseIptvSources(Object? raw) {
  if (raw is! List) return const [];
  final out = <IptvPlaylistSource>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final id = item['id'];
    if (id is! String || id.isEmpty) continue;
    final epgUrl = item['epgUrl'];
    out.add(
      IptvPlaylistSource(
        id: id,
        name: (item['name'] ?? '').toString(),
        url: (item['url'] ?? '').toString(),
        epgUrl: epgUrl is String && epgUrl.isNotEmpty ? epgUrl : null,
        kind: _parseSourceKind(item['kind']),
        xtream: _parseXtreamCreds(item['xtream']),
      ),
    );
  }
  return out;
}

IptvSourceKind? _parseSourceKind(Object? v) => switch (v) {
  'm3u' => IptvSourceKind.m3u,
  'xtream' => IptvSourceKind.xtream,
  'epg' => IptvSourceKind.epg,
  _ => null,
};

XtreamSourceCreds? _parseXtreamCreds(Object? v) {
  if (v is! Map) return null;
  final server = v['server'];
  final username = v['username'];
  final password = v['password'];
  if (server is! String || username is! String || password is! String) {
    return null;
  }
  return XtreamSourceCreds(
    server: server,
    username: username,
    password: password,
  );
}

/// A loaded playlist: its channels plus derived group list and fetch time.
/// Ported from `IptvPlaylist`.
class IptvPlaylist {
  const IptvPlaylist({
    required this.id,
    required this.name,
    required this.url,
    this.epgUrl,
    required this.channels,
    required this.fetchedAt,
    required this.groups,
  });

  final String id;
  final String name;
  final String url;
  final String? epgUrl;
  final List<IptvChannel> channels;
  final int fetchedAt;
  final List<String> groups;
}
