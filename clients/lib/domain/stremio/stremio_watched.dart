import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

/// A Cinemeta video entry, reduced to what the watched-episode bitmap needs:
/// its position-anchoring [id] and its `season`/`episode`. Ported from the web
/// `CinemetaVideo` usage in `stremio-watched.ts`.
class WatchedVideo {
  const WatchedVideo({required this.id, this.season, this.episode});

  final String id;
  final int? season;
  final int? episode;
}

// The Stremio `watched` field is a zlib-DEFLATE'd bitmap (one bit per video, by
// array index) that the web writes with `CompressionStream("deflate")` — the
// zlib format (header + Adler-32), which dart:io's ZLib produces and reads.
final ZLibCodec _zlib = ZLibCodec();

/// Encodes the set of watched `"season:episode"` keys into Stremio's
/// `state.watched` field — `"<anchorVideoId>:<count>:<base64(deflate(bitmap))>"`.
/// Returns null when there are no videos to index against (nothing to write).
/// Ports `encodeWatchedEpisodes`.
String? encodeWatchedEpisodes(
  Set<String> watchedKeys,
  List<WatchedVideo> videos,
) {
  if (videos.isEmpty) return null;
  final bytes = Uint8List((videos.length / 8).ceil());
  for (var i = 0; i < videos.length; i++) {
    final v = videos[i];
    if (v.season != null &&
        v.episode != null &&
        watchedKeys.contains('${v.season}:${v.episode}')) {
      bytes[i >> 3] |= 1 << (i & 7);
    }
  }
  final List<int> deflated;
  try {
    deflated = _zlib.encode(bytes);
  } catch (_) {
    return null;
  }
  final anchorVideoId = videos.last.id;
  if (anchorVideoId.isEmpty) return null;
  return '$anchorVideoId:${videos.length}:${base64.encode(deflated)}';
}

/// Decodes Stremio's `state.watched` field into the set of watched
/// `"season:episode"` keys, realigning the bitmap when the video list has grown
/// since it was written (the anchor scheme). Ports `decodeWatchedEpisodes`.
Set<String> decodeWatchedEpisodes(
  String? watchedField,
  List<WatchedVideo> videos,
) {
  final keys = <String>{};
  if (watchedField == null || watchedField.isEmpty || videos.isEmpty) {
    return keys;
  }
  final parts = watchedField.split(':');
  if (parts.length < 3) return keys;
  final b64 = parts.last;
  final anchorLength = int.tryParse(parts[parts.length - 2]);
  final anchorVideoId = parts.sublist(0, parts.length - 2).join(':');
  if (anchorLength == null || anchorLength <= 0) return keys;
  final List<int> bytes;
  try {
    bytes = _zlib.decode(base64.decode(b64));
  } catch (_) {
    return keys;
  }
  bool bit(int i) =>
      i >= 0 && i < bytes.length * 8 && (bytes[i >> 3] & (1 << (i & 7))) != 0;
  final anchorIdx = videos.indexWhere((v) => v.id == anchorVideoId);
  final offset = anchorIdx >= 0 ? anchorLength - anchorIdx - 1 : 0;
  for (var i = 0; i < videos.length; i++) {
    final v = videos[i];
    if (v.season != null && v.episode != null && bit(i + offset)) {
      keys.add('${v.season}:${v.episode}');
    }
  }
  return keys;
}
