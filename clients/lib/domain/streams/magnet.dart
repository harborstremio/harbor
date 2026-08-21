/// Magnet / info-hash utilities, ported 1:1 from `src/lib/torrent/magnet.ts`.
/// Used by the stream fetch layer (to recover an info-hash for uncached
/// torrents that omit it) and by stream resolution.
library;

final RegExp _hex40 = RegExp(r'^[a-fA-F0-9]{40}$');
final RegExp _base32_32 = RegExp(r'^[a-zA-Z2-7]{32}$');

/// A parsed magnet: the 40-hex info-hash plus optional display name/trackers.
class ParsedMagnet {
  const ParsedMagnet({
    required this.infoHash,
    required this.name,
    required this.trackers,
  });

  final String infoHash;
  final String? name;
  final List<String> trackers;
}

/// Whether [value] is a magnet URI or a bare 40-hex / 32-base32 info-hash.
bool isMagnetInput(String value) {
  final v = value.trim();
  if (v.toLowerCase().startsWith('magnet:')) return true;
  return _hex40.hasMatch(v) || _base32_32.hasMatch(v);
}

final RegExp _videoUrlExt = RegExp(
  r'\.(mp4|m4v|mkv|webm|mov|avi|ts|m3u8|mpd|flv|wmv|mpg|mpeg|m2ts)(\?|#|$)',
  caseSensitive: false,
);

/// Whether [value] is an http(s) URL whose path ends in a known video
/// container/extension.
bool isDirectVideoUrl(String value) {
  final v = value.trim();
  if (!RegExp(r'^https?://', caseSensitive: false).hasMatch(v)) return false;
  final uri = Uri.tryParse(v);
  if (uri == null) return false;
  return _videoUrlExt.hasMatch(uri.path);
}

final RegExp _webReadyExt = RegExp(
  r'\.(mp4|m4v|webm)(\?|#|$)',
  caseSensitive: false,
);

/// Whether a direct URL is *not* a browser-web-ready container (mp4/m4v/webm).
/// Unparseable URLs are treated as not-web-ready.
bool directUrlNotWebReady(String value) {
  final uri = Uri.tryParse(value.trim());
  if (uri == null) return true;
  return !_webReadyExt.hasMatch(uri.path);
}

/// Parses a magnet URI (or bare hash) into its info-hash, name, and trackers.
/// Returns null if no valid info-hash is present.
ParsedMagnet? parseMagnet(String value) {
  final v = value.trim();
  if (_hex40.hasMatch(v)) {
    return ParsedMagnet(
      infoHash: v.toLowerCase(),
      name: null,
      trackers: const [],
    );
  }
  if (_base32_32.hasMatch(v)) {
    final hex = _base32ToHex(v);
    return hex == null
        ? null
        : ParsedMagnet(infoHash: hex, name: null, trackers: const []);
  }
  if (!v.toLowerCase().startsWith('magnet:')) return null;

  Map<String, List<String>> params;
  final uri = Uri.tryParse(v);
  if (uri != null) {
    params = uri.queryParametersAll;
  } else {
    final qIdx = v.indexOf('?');
    params = Uri(
      query: qIdx >= 0 ? v.substring(qIdx + 1) : '',
    ).queryParametersAll;
  }

  String? infoHash;
  for (final xt in params['xt'] ?? const <String>[]) {
    final m = RegExp(
      r'urn:btih:([a-zA-Z0-9]+)',
      caseSensitive: false,
    ).firstMatch(xt);
    if (m == null) continue;
    final raw = m.group(1)!;
    if (_hex40.hasMatch(raw)) {
      infoHash = raw.toLowerCase();
      break;
    }
    if (_base32_32.hasMatch(raw)) {
      final hex = _base32ToHex(raw);
      if (hex != null) {
        infoHash = hex;
        break;
      }
    }
  }
  if (infoHash == null) return null;

  final dn = params['dn'];
  final name = (dn != null && dn.isNotEmpty) ? dn.first : null;
  return ParsedMagnet(
    infoHash: infoHash,
    name: name != null ? Uri.decodeComponent(name.replaceAll('+', ' ')) : null,
    trackers: (params['tr'] ?? const <String>[])
        .where((t) => t.isNotEmpty)
        .toList(),
  );
}

/// Extracts a 40-hex info-hash (and optional file index) embedded in a URL
/// path, e.g. `.../<hash>/<fileIdx>`.
({String infoHash, int? fileIdx})? infoHashFromUrl(String url) {
  final m = RegExp(
    r'(?:^|[/=])([a-fA-F0-9]{40})(?:/(\d+))?(?=[/?#]|$)',
  ).firstMatch(url);
  if (m == null) return null;
  final idxStr = m.group(2);
  final fileIdx = idxStr != null ? int.tryParse(idxStr) : null;
  return (infoHash: m.group(1)!.toLowerCase(), fileIdx: fileIdx);
}

/// Extracts an info-hash from a Stremio `sources` list (`dht:<hash>` entries).
String? infoHashFromSources(List<String>? sources) {
  if (sources == null) return null;
  for (final s in sources) {
    final m = RegExp(
      r'^dht:([a-fA-F0-9]{40})$',
      caseSensitive: false,
    ).firstMatch(s);
    if (m != null) return m.group(1)!.toLowerCase();
  }
  return null;
}

String? _base32ToHex(String input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  final clean = input.toUpperCase().replaceAll(RegExp(r'=+$'), '');
  final bits = StringBuffer();
  for (final ch in clean.split('')) {
    final idx = alphabet.indexOf(ch);
    if (idx == -1) return null;
    bits.write(idx.toRadixString(2).padLeft(5, '0'));
  }
  final bitStr = bits.toString();
  final hex = StringBuffer();
  for (var i = 0; i + 8 <= bitStr.length; i += 8) {
    hex.write(
      int.parse(
        bitStr.substring(i, i + 8),
        radix: 2,
      ).toRadixString(16).padLeft(2, '0'),
    );
  }
  final out = hex.toString();
  return out.length == 40 ? out : null;
}
