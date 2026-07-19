/// The kind of source a playlist form describes. Ports the `PlaylistKind`
/// union of `views/live/source-picker/playlist-form.tsx`.
enum PlaylistKind { m3u, xtream, epg }

/// The Xtream login fields of a playlist form.
class XtreamFormCreds {
  const XtreamFormCreds({
    this.server = '',
    this.username = '',
    this.password = '',
  });
  final String server;
  final String username;
  final String password;
}

/// A playlist form's values (add/edit a source). Ports `PlaylistFormValue`.
class PlaylistFormValue {
  const PlaylistFormValue({
    this.name = '',
    this.kind = PlaylistKind.m3u,
    this.url = '',
    this.epgUrl = '',
    this.xtream = const XtreamFormCreds(),
  });
  final String name;
  final PlaylistKind kind;
  final String url;
  final String epgUrl;
  final XtreamFormCreds xtream;
}

final RegExp _http = RegExp(r'^https?://', caseSensitive: false);
final RegExp _trailingSlash = RegExp(r'/+$');

/// Whether a form has enough to save: an http(s) URL for M3U/EPG, or a server
/// URL + username + password for Xtream. Ports the form's `canSave`.
bool validatePlaylistForm(PlaylistFormValue v) {
  switch (v.kind) {
    case PlaylistKind.m3u:
      return _http.hasMatch(v.url.trim());
    case PlaylistKind.xtream:
      return _http.hasMatch(v.xtream.server.trim()) &&
          v.xtream.username.trim().isNotEmpty &&
          v.xtream.password.trim().isNotEmpty;
    case PlaylistKind.epg:
      return _http.hasMatch(v.epgUrl.trim());
  }
}

/// The Xtream `get.php` (M3U) + `xmltv.php` (EPG) urls for a server + login.
/// Ports `buildXtreamUrls`.
({String m3u, String epg}) buildXtreamUrls(
  String server,
  String username,
  String password,
) {
  final base = server.replaceFirst(_trailingSlash, '');
  final u = Uri.encodeComponent(username);
  final p = Uri.encodeComponent(password);
  return (
    m3u: '$base/get.php?username=$u&password=$p&type=m3u_plus&output=ts',
    epg: '$base/xmltv.php?username=$u&password=$p',
  );
}

/// Builds the stored settings entry (an `iptvPlaylists` map) from a form,
/// deriving the Xtream urls, trimming, and defaulting a blank name. Ports
/// `materializePlaylistEntry`.
Map<String, dynamic> materializePlaylistEntry(
  String id,
  PlaylistFormValue v, {
  String defaultName = 'Playlist',
}) {
  final name = v.name.trim().isEmpty ? defaultName : v.name.trim();
  switch (v.kind) {
    case PlaylistKind.xtream:
      final server = v.xtream.server.trim();
      final username = v.xtream.username.trim();
      final password = v.xtream.password.trim();
      final urls = buildXtreamUrls(server, username, password);
      return {
        'id': id,
        'name': name,
        'url': urls.m3u,
        'epgUrl': urls.epg,
        'kind': 'xtream',
        'xtream': {
          'server': server.replaceFirst(_trailingSlash, ''),
          'username': username,
          'password': password,
        },
      };
    case PlaylistKind.epg:
      return {
        'id': id,
        'name': name,
        'url': '',
        'epgUrl': v.epgUrl.trim(),
        'kind': 'epg',
      };
    case PlaylistKind.m3u:
      final entry = <String, dynamic>{
        'id': id,
        'name': name,
        'url': v.url.trim(),
        'kind': 'm3u',
      };
      final epg = v.epgUrl.trim();
      if (epg.isNotEmpty) entry['epgUrl'] = epg;
      return entry;
  }
}
