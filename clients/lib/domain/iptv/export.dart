import 'm3u.dart';

const Set<String> _passthroughAttrs = {
  'tvg-id',
  'tvg-name',
  'tvg-logo',
  'tvg-chno',
  'tvg-shift',
  'tvg-language',
  'tvg-country',
  'group-title',
  'catchup',
  'catchup-source',
  'catchup-days',
  'duration',
};

String _escapeAttr(String value) => value.replaceAll('"', r'\"');

String _fmtDuration(num d) {
  if (d is int) return '$d';
  final dd = d as double;
  return dd == dd.truncateToDouble() ? '${dd.toInt()}' : '$dd';
}

/// Serializes channels back to an M3U playlist (with an optional `url-tvg` EPG
/// header), passing through the known EXTINF attributes. Ports `iptv/export.ts`
/// `buildM3u`.
String buildM3u(List<IptvChannel> channels, {String? epgUrl}) {
  final head = (epgUrl != null && epgUrl.isNotEmpty)
      ? '#EXTM3U url-tvg="${_escapeAttr(epgUrl)}"'
      : '#EXTM3U';
  final lines = <String>[head];
  for (final ch in channels) {
    final attrs = <(String, String)>[];
    final tvgId = ch.tvgId;
    if (tvgId != null && tvgId.isNotEmpty) attrs.add(('tvg-id', tvgId));
    final logo = ch.logo;
    if (logo != null && logo.isNotEmpty) attrs.add(('tvg-logo', logo));
    final group = ch.group;
    if (group != null && group.isNotEmpty) attrs.add(('group-title', group));
    final catchupSource = ch.catchupSource;
    if (catchupSource != null && catchupSource.isNotEmpty) {
      final cu = ch.attrs['catchup'];
      final baked = cu == null || cu.isEmpty || cu == 'default';
      if (baked) {
        attrs.add(('catchup', (cu != null && cu.isNotEmpty) ? cu : 'default'));
      }
      attrs.add(('catchup-source', catchupSource));
    }
    for (final e in ch.attrs.entries) {
      final k = e.key;
      if (!_passthroughAttrs.contains(k.toLowerCase())) continue;
      if (attrs.any((a) => a.$1.toLowerCase() == k.toLowerCase())) continue;
      attrs.add((k, e.value));
    }
    final attrStr = attrs.isEmpty
        ? ''
        : ' ${attrs.map((a) => '${a.$1}="${_escapeAttr(a.$2)}"').join(' ')}';
    final durationSec = ch.durationSec;
    final num duration = (durationSec != null && durationSec > 0)
        ? durationSec
        : -1;
    lines.add('#EXTINF:${_fmtDuration(duration)}$attrStr,${ch.name}');
    lines.add(ch.url);
  }
  return '${lines.join('\n')}\n';
}

final RegExp _unsafeChars = RegExp(r'[^a-z0-9-]+', caseSensitive: false);
final RegExp _edgeDashes = RegExp(r'^-+|-+$');

/// A safe `<name>-<YYYY-MM-DD>.m3u` export filename (UTC date). Ports
/// `suggestExportFilename`; [now] overrides the clock for tests.
String suggestExportFilename(String playlistName, {DateTime? now}) {
  var safe = playlistName
      .trim()
      .replaceAll(_unsafeChars, '-')
      .replaceAll(_edgeDashes, '');
  if (safe.isEmpty) safe = 'playlist';
  final d = (now ?? DateTime.now()).toUtc();
  final stamp =
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
  return '$safe-$stamp.m3u';
}

/// Xtream credentials parsed from a URL. Ports the `XtreamCreds` type of
/// `iptv/export.ts` (named to avoid the `xtream.dart` `XtreamCreds`).
class ExportXtreamCreds {
  const ExportXtreamCreds({
    required this.host,
    this.port,
    this.username,
    this.password,
    this.type,
    this.output,
    required this.fullUrl,
  });
  final String host;
  final String? port;
  final String? username;
  final String? password;
  final String? type;
  final String? output;
  final String fullUrl;
}

/// Parses Xtream credentials from a URL, or null if it isn't one. Ports
/// `parseXtreamCreds`.
ExportXtreamCreds? parseXtreamCreds(String url) {
  final u = Uri.tryParse(url);
  if (u == null || u.host.isEmpty) return null;
  final params = u.queryParameters;
  final username = params['username'];
  final password = params['password'];
  if (username == null &&
      password == null &&
      !u.path.contains('get.php') &&
      !u.path.contains('/live/')) {
    return null;
  }
  final defaultPort = u.scheme == 'https' ? 443 : (u.scheme == 'http' ? 80 : 0);
  final port = (u.hasPort && u.port != defaultPort) ? u.port.toString() : null;
  return ExportXtreamCreds(
    host: '${u.scheme}://${u.host}',
    port: port,
    username: username,
    password: password,
    type: params['type'],
    output: params['output'],
    fullUrl: url,
  );
}
