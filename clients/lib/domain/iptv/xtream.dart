import 'dart:convert';

import '../../core/http/json_transport.dart';
import 'm3u.dart';

const _xtreamUa = 'IPTVSmartersPro/3.1.5';

/// Xtream Codes credentials. Ported from `iptv/xtream.ts` `XtreamCreds`.
class XtreamCreds {
  const XtreamCreds({
    required this.base,
    required this.username,
    required this.password,
  });
  final String base;
  final String username;
  final String password;
}

/// The server's live-stream capabilities. Ported from `XtreamServerCaps`.
class XtreamServerCaps {
  const XtreamServerCaps({
    required this.allowedFormats,
    required this.streamBase,
  });
  final List<String> allowedFormats;
  final String streamBase;
}

/// A short-EPG listing (now/next). Ported from the `fetchXtreamShortEpg` shape.
class XtreamShortEpg {
  const XtreamShortEpg({
    required this.title,
    this.description,
    required this.startMs,
    required this.endMs,
  });
  final String title;
  final String? description;
  final int startMs;
  final int endMs;
}

/// Xtream authentication/response failure (expired, banned, non-JSON, …).
class XtreamAuthError implements Exception {
  XtreamAuthError(this.message);
  final String message;
  @override
  String toString() => 'XtreamAuthError: $message';
}

/// Thrown when an Xtream login succeeds but the server returns no live channels
/// (e.g. an account with no active package). Ports `XtreamEmptyError`.
class XtreamEmptyError implements Exception {
  XtreamEmptyError(this.message);
  final String message;
  @override
  String toString() => 'XtreamEmptyError: $message';
}

String _origin(Uri u) => '${u.scheme}://${u.authority}';

/// Parses an Xtream `get.php`/`player_api.php` URL to credentials, or null.
/// Ports `parseXtreamUrl`.
XtreamCreds? parseXtreamUrl(String url) {
  final u = Uri.tryParse(url);
  if (u == null) return null;
  final username = u.queryParameters['username'];
  final password = u.queryParameters['password'];
  if (username == null ||
      username.isEmpty ||
      password == null ||
      password.isEmpty) {
    return null;
  }
  final path = u.path.toLowerCase();
  if (!path.endsWith('get.php') && !path.endsWith('player_api.php')) {
    return null;
  }
  return XtreamCreds(base: _origin(u), username: username, password: password);
}

/// Builds credentials from a server URL + username/password, or null. Ports
/// `credsFromServer`.
XtreamCreds? credsFromServer(String server, String username, String password) {
  final trimmed = server.trim().replaceFirst(RegExp(r'/+$'), '');
  if (!RegExp(r'^https?://', caseSensitive: false).hasMatch(trimmed)) {
    return null;
  }
  if (username.trim().isEmpty || password.trim().isEmpty) return null;
  final u = Uri.tryParse(trimmed);
  if (u == null) return null;
  return XtreamCreds(
    base: _origin(u),
    username: username.trim(),
    password: password.trim(),
  );
}

/// Builds a `player_api.php` action URL. Ports `apiUrl`.
String apiUrl(
  XtreamCreds creds,
  String action, [
  Map<String, String> extra = const {},
]) => Uri.parse('${creds.base}/player_api.php')
    .replace(
      queryParameters: {
        'username': creds.username,
        'password': creds.password,
        'action': action,
        ...extra,
      },
    )
    .toString();

String _userInfoUrl(XtreamCreds creds) =>
    Uri.parse('${creds.base}/player_api.php')
        .replace(
          queryParameters: {
            'username': creds.username,
            'password': creds.password,
          },
        )
        .toString();

/// The live-stream URL for a channel. Ports `buildLiveStreamUrl`.
String buildLiveStreamUrl(
  XtreamCreds creds,
  int streamId, {
  String container = 'ts',
  String? streamBase,
}) {
  final base = streamBase ?? creds.base;
  final u = Uri.encodeComponent(creds.username);
  final p = Uri.encodeComponent(creds.password);
  return '$base/live/$u/$p/$streamId.$container';
}

/// The shared Xtream GET: spoofs the client UA, throws [XtreamAuthError] on a
/// non-2xx status or a non-JSON body, and returns the decoded `Map`/`List`.
/// Ports `iptv/xtream.ts` `xtreamFetch`.
Future<Object?> xtreamFetch(JsonTransport t, String url) async {
  final JsonResponse res;
  try {
    res = await t.getJson(
      url,
      headers: {'User-Agent': _xtreamUa, 'Accept': 'application/json, */*'},
    );
  } on TransportException catch (e) {
    throw XtreamAuthError(e.message);
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw XtreamAuthError('HTTP ${res.statusCode}');
  }
  final data = res.data;
  if (data is! Map && data is! List) {
    throw XtreamAuthError(
      'Provider returned a non-JSON response. The account may be expired, '
      'or this is not an Xtream server.',
    );
  }
  return data;
}

String _deriveStreamBase(XtreamCreds creds, Object? server) {
  if (server is Map &&
      (server['server_protocol'] ?? '').toString().toLowerCase() == 'https') {
    final u = Uri.tryParse(creds.base);
    if (u == null) return creds.base;
    final port = (server['https_port'] ?? server['port'] ?? '')
        .toString()
        .trim();
    return port.isNotEmpty ? 'https://${u.host}:$port' : 'https://${u.host}';
  }
  return creds.base;
}

/// Authenticates and reads the server's stream capabilities. Throws
/// [XtreamAuthError] on a rejected/expired/banned/disabled account. Ports
/// `fetchXtreamUserInfo`.
Future<XtreamServerCaps> fetchXtreamUserInfo(
  JsonTransport t,
  XtreamCreds creds,
) async {
  final raw = await xtreamFetch(t, _userInfoUrl(creds));
  final info = raw is Map ? raw['user_info'] : null;
  if (info is! Map) {
    throw XtreamAuthError(
      'Xtream login did not return account info. Check the server URL.',
    );
  }
  if (info['auth'] == 0) {
    throw XtreamAuthError(
      'Xtream rejected these credentials (auth failed). Check the server URL, '
      'username, and password.',
    );
  }
  final status = (info['status'] ?? '').toString().toLowerCase();
  if (status == 'expired') {
    throw XtreamAuthError('This Xtream account is expired.');
  }
  if (status == 'banned') {
    throw XtreamAuthError('This Xtream account is banned by the provider.');
  }
  if (status == 'disabled') {
    throw XtreamAuthError('This Xtream account is disabled by the provider.');
  }
  final formats = info['allowed_output_formats'];
  return XtreamServerCaps(
    allowedFormats: formats is List
        ? [for (final f in formats) f.toString().toLowerCase()]
        : const [],
    streamBase: _deriveStreamBase(creds, (raw as Map)['server_info']),
  );
}

String _pickContainer(String pref, List<String> allowed) {
  if (allowed.isEmpty || allowed.contains(pref)) return pref;
  if (allowed.contains('ts')) return 'ts';
  if (allowed.contains('m3u8')) return 'm3u8';
  return pref;
}

/// Fetches the live categories + streams and maps them to channels. Ports
/// `fetchXtreamLiveChannels`.
Future<List<IptvChannel>> fetchXtreamLiveChannels(
  JsonTransport t,
  XtreamCreds creds,
  String baseId, {
  String container = 'ts',
  XtreamServerCaps? caps,
}) async {
  final resolved = _pickContainer(container, caps?.allowedFormats ?? const []);
  final streamBase = caps?.streamBase ?? creds.base;
  final results = await Future.wait([
    xtreamFetch(t, apiUrl(creds, 'get_live_categories')),
    xtreamFetch(t, apiUrl(creds, 'get_live_streams')),
  ]);

  final categoryName = <String, String>{};
  if (results[0] is List) {
    for (final c in results[0] as List) {
      if (c is Map && c['category_id'] != null) {
        categoryName[c['category_id'].toString()] = (c['category_name'] ?? '')
            .toString();
      }
    }
  }
  final streams = results[1] is List ? results[1] as List : const [];
  final out = <IptvChannel>[];
  for (final s in streams) {
    if (s is! Map || s['stream_id'] == null) continue;
    final streamId = (s['stream_id'] as num).toInt();
    final tvgId = (s['epg_channel_id'] ?? '').toString().trim();
    final categoryId = s['category_id']?.toString();
    final attrs = <String, String>{};
    if ((s['tv_archive'] as num?)?.toInt() != null &&
        (s['tv_archive'] as num).toInt() > 0) {
      attrs['catchup'] = 'xtream';
      final days = num.tryParse('${s['tv_archive_duration']}');
      if (days != null && days > 0) attrs['catchup-days'] = '${days.toInt()}';
    }
    out.add(
      IptvChannel(
        id: '$baseId::xt::$streamId',
        tvgId: tvgId.isEmpty ? null : tvgId,
        name: (s['name'] ?? '').toString().trim().isNotEmpty
            ? (s['name'] as Object).toString().trim()
            : 'Stream $streamId',
        logo: (s['stream_icon'] ?? '').toString().trim().isEmpty
            ? null
            : (s['stream_icon'] as Object).toString().trim(),
        group: categoryId != null ? categoryName[categoryId] : null,
        url: buildLiveStreamUrl(
          creds,
          streamId,
          container: resolved,
          streamBase: streamBase,
        ),
        attrs: attrs,
      ),
    );
  }
  return out;
}

bool _hasControlChars(String s) {
  for (final c in s.codeUnits) {
    if (c < 0x20 && c != 0x09 && c != 0x0a && c != 0x0d) return true;
  }
  return false;
}

/// Decodes an Xtream base64 field back to text, leaving plain text untouched.
String _decodeBase64(Object? raw) {
  if (raw == null) return '';
  final s = raw.toString().trim();
  if (s.isEmpty) return '';
  if (!RegExp(r'^[A-Za-z0-9+/]+={0,2}$').hasMatch(s) || s.length % 4 != 0) {
    return s;
  }
  try {
    final decoded = utf8.decode(base64.decode(s)).trim();
    if (decoded.isEmpty || _hasControlChars(decoded)) return s;
    return decoded;
  } catch (_) {
    return s;
  }
}

/// The now/next short EPG for a stream (`get_short_epg`). Empty on failure.
/// Ports `fetchXtreamShortEpg`.
Future<List<XtreamShortEpg>> fetchXtreamShortEpg(
  JsonTransport t,
  XtreamCreds creds,
  String streamId,
) async {
  Object? raw;
  try {
    raw = await xtreamFetch(
      t,
      apiUrl(creds, 'get_short_epg', {'stream_id': streamId, 'limit': '8'}),
    );
  } catch (_) {
    return const [];
  }
  final listings = raw is Map ? raw['epg_listings'] : null;
  if (listings is! List) return const [];
  final out = <XtreamShortEpg>[];
  for (final row in listings) {
    if (row is! Map) continue;
    final startMs =
        (num.tryParse('${row['start_timestamp']}') ?? 0).toInt() * 1000;
    final endMs =
        (num.tryParse('${row['stop_timestamp']}') ?? 0).toInt() * 1000;
    if (startMs <= 0 || endMs <= startMs) continue;
    final title = _decodeBase64(row['title']);
    final desc = _decodeBase64(row['description']);
    out.add(
      XtreamShortEpg(
        title: title.isEmpty ? 'Untitled' : title,
        description: desc.isEmpty ? null : desc,
        startMs: startMs,
        endMs: endMs,
      ),
    );
  }
  return out;
}
