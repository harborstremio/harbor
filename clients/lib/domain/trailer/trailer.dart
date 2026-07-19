// Trailer playback support. The web extracts a trailer via a Tauri yt-dlp
// command and plays a downloaded file; the native app resolves a directly
// playable stream URL from the YouTube id (in-window where supported) and falls
// back to opening YouTube externally. This file holds the pure, platform-free
// pieces; the actual extractor is a TrailerResolver injected at the edge.

/// The trailer stream quality preference. Ported from `Quality` /
/// `TrailerQualityPref` in `src/lib/trailer.ts`.
enum TrailerQuality {
  auto('auto'),
  p360('360p'),
  p720('720p'),
  p1080('1080p'),
  best('best');

  const TrailerQuality(this.wire);

  final String wire;

  /// The quality for a stored `trailerQuality` setting value (default auto).
  static TrailerQuality fromWire(String? value) => TrailerQuality.values
      .firstWhere((q) => q.wire == value, orElse: () => TrailerQuality.auto);
}

/// Resolves the effective quality from a preference. `auto` picks 720p — the
/// web's `getQualityHint()` derives a hint from `navigator.connection`, which
/// has no native equivalent, and 720p is exactly what it returns when the
/// connection info is absent. Ports `resolveTrailerQuality`.
TrailerQuality resolveTrailerQuality(TrailerQuality pref) =>
    pref == TrailerQuality.auto ? TrailerQuality.p720 : pref;

/// The trailer video id to use: the detail's first candidate, else the meta's
/// first trailer-stream ytId. Ports
/// `detail?.trailerCandidates?.[0] ?? meta.trailerStreams?.[0]?.ytId`.
String? trailerCandidate(
  List<String> detailCandidates,
  String? metaTrailerYtId,
) => detailCandidates.isNotEmpty ? detailCandidates.first : metaTrailerYtId;

/// The public YouTube watch URL for [ytId] — the platform fallback, opened in
/// the system browser / YouTube app when in-window extraction isn't available.
Uri youtubeWatchUrl(String ytId) =>
    Uri.https('www.youtube.com', '/watch', {'v': ytId});

/// A resolved trailer stream ready to play in-window.
class TrailerStream {
  const TrailerStream({required this.url, this.quality});

  /// A directly-playable (progressive/muxed) stream URL.
  final Uri url;

  /// The label of the chosen stream quality, if known.
  final String? quality;
}

/// Extracts a directly-playable stream for a YouTube trailer id, or null when
/// extraction isn't possible on this platform/network — in which case the caller
/// opens [youtubeWatchUrl] externally. Injectable so the trailer UI can be
/// tested without reaching YouTube.
abstract interface class TrailerResolver {
  Future<TrailerStream?> resolve(String ytId, TrailerQuality quality);
}

/// A [TrailerResolver] backed by a function — a real, reusable implementation
/// used by tests to return canned results without a network.
class FnTrailerResolver implements TrailerResolver {
  const FnTrailerResolver(this._fn);

  final Future<TrailerStream?> Function(String ytId, TrailerQuality quality)
  _fn;

  @override
  Future<TrailerStream?> resolve(String ytId, TrailerQuality quality) =>
      _fn(ytId, quality);
}
