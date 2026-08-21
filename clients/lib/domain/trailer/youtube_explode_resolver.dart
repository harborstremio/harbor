import 'package:youtube_explode_dart/youtube_explode_dart.dart';

import 'trailer.dart';

/// A muxed (video+audio) stream reduced to what the quality picker needs.
class MuxedCandidate {
  const MuxedCandidate({
    required this.url,
    required this.qualityLabel,
    required this.height,
    required this.bitrate,
  });

  final Uri url;
  final String qualityLabel;
  final int height;
  final int bitrate;
}

/// Picks the muxed stream nearest [quality] from [streams] (pure + testable).
/// YouTube's muxed streams cap at ~720p, so 1080p and `best` resolve to the
/// highest available; a target quality prefers the highest stream at or below
/// it, else the closest above.
MuxedCandidate? pickTrailerStream(
  List<MuxedCandidate> streams,
  TrailerQuality quality,
) {
  if (streams.isEmpty) return null;
  final sorted = [...streams]
    ..sort((a, b) {
      final byHeight = b.height.compareTo(a.height);
      return byHeight != 0 ? byHeight : b.bitrate.compareTo(a.bitrate);
    });

  final int? target = switch (resolveTrailerQuality(quality)) {
    TrailerQuality.p360 => 360,
    TrailerQuality.p720 => 720,
    TrailerQuality.p1080 => 1080,
    TrailerQuality.best || TrailerQuality.auto => null,
  };
  if (target == null) return sorted.first; // best → highest available

  final atOrBelow = sorted.where((s) => s.height <= target).toList();
  if (atOrBelow.isNotEmpty) return atOrBelow.first; // highest ≤ target
  return sorted.last; // all above target → the closest (smallest) one
}

/// The production [TrailerResolver]: extracts a directly-playable muxed stream
/// URL for a YouTube trailer id with `youtube_explode_dart` (pure Dart, no
/// native sidecar). Returns null on any failure (age/region gated, extraction
/// broken) so the caller opens [youtubeWatchUrl] externally instead.
class YoutubeExplodeTrailerResolver implements TrailerResolver {
  YoutubeExplodeTrailerResolver([YoutubeExplode? yt])
    : _yt = yt ?? YoutubeExplode();

  final YoutubeExplode _yt;

  @override
  Future<TrailerStream?> resolve(String ytId, TrailerQuality quality) async {
    try {
      final manifest = await _yt.videos.streamsClient.getManifest(ytId);
      final candidates = [
        for (final s in manifest.muxed)
          MuxedCandidate(
            url: s.url,
            qualityLabel: s.qualityLabel,
            height: s.videoResolution.height,
            bitrate: s.bitrate.bitsPerSecond,
          ),
      ];
      final pick = pickTrailerStream(candidates, quality);
      return pick == null
          ? null
          : TrailerStream(url: pick.url, quality: pick.qualityLabel);
    } catch (_) {
      return null;
    }
  }

  /// Releases the underlying HTTP client.
  void close() => _yt.close();
}
