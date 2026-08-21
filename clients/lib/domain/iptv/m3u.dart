/// An IPTV channel parsed from an M3U playlist. Ported from `iptv/types.ts`
/// `IptvChannel`.
class IptvChannel {
  const IptvChannel({
    required this.id,
    this.tvgId,
    required this.name,
    this.logo,
    this.group,
    required this.url,
    this.catchupSource,
    this.durationSec,
    this.attrs = const {},
  });

  final String id;
  final String? tvgId;
  final String name;
  final String? logo;
  final String? group;
  final String url;
  final String? catchupSource;
  final double? durationSec;
  final Map<String, String> attrs;
}

const _extinf = '#EXTINF:';
const _extgrp = '#EXTGRP:';
const _extvlcopt = '#EXTVLCOPT:';
const _kodiprop = '#KODIPROP:';

class _Pending {
  _Pending({this.durationSec, required this.title, required this.attrs});
  double? durationSec;
  String title;
  final Map<String, String> attrs;
}

String? _nonEmpty(String? s) => s != null && s.isNotEmpty ? s : null;

/// Parses an M3U/M3U8 playlist into channels, honouring EXTINF attributes
/// (including quoted values spanning tokens), EXTGRP sticky groups, EXTVLCOPT /
/// KODIPROP / `|`-piped options (user-agent, referrer, cookie, DRM), and
/// dropping decorative separator rows. Ports `parseM3u`.
List<IptvChannel> parseM3u(String text, String baseId) {
  final lines = text.replaceFirst('﻿', '').split(RegExp(r'\r?\n'));
  final out = <IptvChannel>[];
  _Pending? pending;
  String? stickyGroup;
  var autoIndex = 0;
  for (final raw in lines) {
    final line = raw.trim();
    if (line.isEmpty || line.startsWith('#EXTM3U')) continue;
    if (line.startsWith(_extinf)) {
      pending = _parseExtinf(line.substring(_extinf.length));
      continue;
    }
    if (line.startsWith(_extgrp)) {
      final g = line.substring(_extgrp.length).trim();
      stickyGroup = g.isEmpty ? null : g;
      if (pending != null) pending.attrs['group-title'] = g;
      continue;
    }
    if (line.startsWith(_extvlcopt)) {
      if (pending != null) {
        _captureVlcOpt(line.substring(_extvlcopt.length), pending.attrs);
      }
      continue;
    }
    if (line.startsWith(_kodiprop)) {
      if (pending != null) {
        _captureKodiProp(line.substring(_kodiprop.length), pending.attrs);
      }
      continue;
    }
    if (line.startsWith('#')) continue;

    final pipe = line.indexOf('|');
    final url = pipe >= 0 ? line.substring(0, pipe) : line;
    pending ??= _Pending(title: url, attrs: {});
    if (pipe >= 0) _capturePipeOpts(line.substring(pipe + 1), pending.attrs);

    final displayName =
        _nonEmpty(pending.attrs['tvg-name']) ??
        (pending.title.isNotEmpty ? pending.title : 'Channel $autoIndex');
    if (_isDecorativeRow(displayName)) {
      pending = null;
      continue;
    }
    final tvgId =
        _nonEmpty(pending.attrs['tvg-id']) ??
        _nonEmpty(pending.attrs['tvg-chno']);
    final idKey =
        tvgId ??
        _nonEmpty(pending.attrs['tvg-name']) ??
        (pending.title.isNotEmpty ? pending.title : 'ch-$autoIndex');
    final id = '$baseId::$idKey::$autoIndex';
    autoIndex += 1;
    out.add(
      IptvChannel(
        id: id,
        tvgId: tvgId,
        name: displayName,
        logo:
            _nonEmpty(pending.attrs['tvg-logo']) ??
            _nonEmpty(pending.attrs['logo']),
        group:
            _nonEmpty(pending.attrs['group-title']) ??
            _nonEmpty(pending.attrs['group']) ??
            stickyGroup,
        url: url,
        catchupSource:
            _nonEmpty(pending.attrs['catchup-source']) ??
            _nonEmpty(pending.attrs['catchup']),
        durationSec: pending.durationSec,
        attrs: pending.attrs,
      ),
    );
    pending = null;
  }
  return out;
}

final _decorativeRe = RegExp(r'^[#=─━▓█▀▄░♦◆■▼▲★☆_*+~|·•:.\s-]+$');
final _alnumRe = RegExp(r'[\p{L}\p{N}]', unicode: true);

bool _isDecorativeRow(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return true;
  if (_decorativeRe.hasMatch(trimmed)) return true;
  return !_alnumRe.hasMatch(trimmed);
}

_Pending _parseExtinf(String rest) {
  final commaIdx = _attrTitleSplit(rest);
  final attrsPart = commaIdx >= 0 ? rest.substring(0, commaIdx) : rest;
  final titlePart = commaIdx >= 0 ? rest.substring(commaIdx + 1).trim() : '';
  final tokens = attrsPart.trim().split(RegExp(r'\s+'));
  double? durationSec;
  final attrs = <String, String>{};
  for (var i = 0; i < tokens.length; i++) {
    final tok = tokens[i];
    if (tok.isEmpty) continue;
    final eq = tok.indexOf('=');
    if (eq < 0) {
      if (i == 0) {
        final n = double.tryParse(tok);
        if (n != null && n > 0) durationSec = n;
      }
      continue;
    }
    final key = tok.substring(0, eq).toLowerCase();
    var val = tok.substring(eq + 1);
    if (val.startsWith('"')) {
      var combined = val;
      while (!_isClosedQuoted(combined) && i + 1 < tokens.length) {
        i += 1;
        combined += ' ${tokens[i]}';
      }
      val = combined.replaceAll(RegExp('^"|"\$'), '');
    }
    attrs[key] = val;
  }
  return _Pending(durationSec: durationSec, title: titlePart, attrs: attrs);
}

bool _isClosedQuoted(String s) {
  if (s.length < 2) return false;
  if (!s.startsWith('"')) return true;
  return s.endsWith('"') && '"'.allMatches(s).length % 2 == 0;
}

int _attrTitleSplit(String s) {
  var inQuote = false;
  var lastQuoteClose = -1;
  for (var i = 0; i < s.length; i++) {
    if (s[i] != '"') continue;
    if (inQuote) lastQuoteClose = i;
    inQuote = !inQuote;
  }
  final after = _firstUnquotedComma(
    s,
    lastQuoteClose >= 0 ? lastQuoteClose + 1 : 0,
  );
  return after >= 0 ? after : _firstUnquotedComma(s, 0);
}

int _firstUnquotedComma(String s, int start) {
  var inQuote = false;
  for (var i = start; i < s.length; i++) {
    final c = s[i];
    if (c == '"') {
      inQuote = !inQuote;
    } else if (c == ',' && !inQuote) {
      return i;
    }
  }
  return -1;
}

void _captureVlcOpt(String rest, Map<String, String> attrs) {
  final eq = rest.indexOf('=');
  if (eq < 0) return;
  final key = rest.substring(0, eq).trim().toLowerCase();
  final val = rest.substring(eq + 1).trim().replaceAll(RegExp('^"|"\$'), '');
  if (val.isEmpty) return;
  if (key == 'http-user-agent') {
    attrs['vlcopt-user-agent'] = val;
  } else if (key == 'http-referrer') {
    attrs['vlcopt-referrer'] = val;
  }
}

String _safeDecode(String s) {
  try {
    return Uri.decodeComponent(s);
  } catch (_) {
    return s;
  }
}

void _capturePipeOpts(String rest, Map<String, String> attrs) {
  for (final pair in rest.split('&')) {
    final eq = pair.indexOf('=');
    if (eq < 0) continue;
    final key = pair.substring(0, eq).trim().toLowerCase();
    final val = _safeDecode(pair.substring(eq + 1).trim());
    if (val.isEmpty) continue;
    if (key == 'user-agent' && !attrs.containsKey('vlcopt-user-agent')) {
      attrs['vlcopt-user-agent'] = val;
    } else if ((key == 'referer' || key == 'referrer') &&
        !attrs.containsKey('vlcopt-referrer')) {
      attrs['vlcopt-referrer'] = val;
    } else if (key == 'cookie' && !attrs.containsKey('vlcopt-cookie')) {
      attrs['vlcopt-cookie'] = val;
    }
  }
}

void _captureKodiProp(String rest, Map<String, String> attrs) {
  final eq = rest.indexOf('=');
  if (eq < 0) return;
  final key = rest.substring(0, eq).trim().toLowerCase();
  final val = rest.substring(eq + 1).trim();
  if (val.isEmpty) return;
  if (key == 'inputstream.adaptive.license_type') {
    attrs['kodiprop-license-type'] = val;
  } else if (key == 'inputstream.adaptive.license_key') {
    attrs['kodiprop-license-key'] = val;
  }
}

/// Groups channels by their group title (`Uncategorized` when none). Ports
/// `groupChannels`.
Map<String, List<IptvChannel>> groupChannels(List<IptvChannel> channels) {
  final map = <String, List<IptvChannel>>{};
  for (final ch in channels) {
    (map[ch.group ?? 'Uncategorized'] ??= []).add(ch);
  }
  return map;
}

/// Derives the XMLTV EPG URLs (`xmltv.php` + `get.php?type=epg`) for an Xtream
/// playlist URL, or empty for a non-Xtream URL. Ports `deriveEpgUrls`.
List<String> deriveEpgUrls(String playlistUrl) {
  final u = Uri.tryParse(playlistUrl);
  if (u == null) return const [];
  final isXtream =
      u.path.endsWith('get.php') || u.path.endsWith('player_api.php');
  if (!isXtream) return const [];
  final username = u.queryParameters['username'];
  final password = u.queryParameters['password'];
  if (username == null ||
      username.isEmpty ||
      password == null ||
      password.isEmpty) {
    return const [];
  }
  final xmltv = u.replace(
    path: '/xmltv.php',
    queryParameters: {'username': username, 'password': password},
    fragment: '',
  );
  final getPhp = u.replace(
    path: '/get.php',
    queryParameters: {
      'username': username,
      'password': password,
      'type': 'epg',
    },
    fragment: '',
  );
  return [xmltv.toString(), getPhp.toString()];
}

/// The primary derived EPG URL (`xmltv.php`), or null. Ports
/// `deriveEpgFromGetPhp`.
String? deriveEpgFromGetPhp(String playlistUrl) {
  final urls = deriveEpgUrls(playlistUrl);
  return urls.isEmpty ? null : urls.first;
}
