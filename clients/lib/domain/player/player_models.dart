/// The reactive player data model, ported from the `PlayerBridge` contract in
/// `src/lib/player/bridge.ts` (`docs/50` §2). Engine-agnostic: both the default
/// (platform video) and advanced (libmpv) engines produce these.
library;

/// Playback lifecycle state.
enum PlayerStatus { idle, loading, ready, playing, paused, ended, error }

/// The classified cause of a playback error (null when there is no error).
enum PlayerErrorCode { decode, codec, network, source, unknown }

/// Which engine backs a bridge.
enum PlayerEngine { defaultEngine, advanced }

/// A subtitle attached to a [PlayerSource].
class SourceSubtitle {
  const SourceSubtitle({required this.url, this.id, this.lang, this.m});
  final String url;
  final String? id;
  final String? lang;
  final String? m;
}

/// The argument to `PlayerBridge.load`.
class PlayerSource {
  const PlayerSource({
    required this.url,
    this.subtitles = const [],
    this.notWebReady = false,
    this.startAtSec,
    this.isLive = false,
    this.headers,
  });

  final String url;
  final List<SourceSubtitle> subtitles;

  /// Needs the advanced decoder (mpv); the default engine treats it as live/TS.
  final bool notWebReady;

  /// Resume position in seconds.
  final double? startAtSec;
  final bool isLive;

  /// Request headers (Referer/User-Agent/Cookie) for IPTV and some CDNs.
  final Map<String, String>? headers;
}

/// An audio or subtitle track.
class TrackInfo {
  const TrackInfo({
    required this.id,
    required this.label,
    required this.kind,
    required this.selected,
    this.lang,
    this.codec,
    this.channels,
    this.channelCount,
    this.title,
    this.external = false,
    this.externalFilename,
    this.forced = false,
    this.isDefault = false,
    this.hearingImpaired = false,
    this.url,
  });

  final String id;
  final String label;

  /// `audio` or `subtitle`.
  final String kind;
  final bool selected;
  final String? lang;
  final String? codec;
  final String? channels;
  final int? channelCount;
  final String? title;
  final bool external;
  final String? externalFilename;
  final bool forced;
  final bool isDefault;
  final bool hearingImpaired;
  final String? url;
}

/// A chapter marker.
class Chapter {
  const Chapter({required this.startSec, this.title});
  final double startSec;
  final String? title;
}

/// What an engine can do.
class PlayerCapabilities {
  const PlayerCapabilities({
    required this.engine,
    this.pictureInPicture = false,
    this.airplay = false,
    this.chromecast = false,
    this.hdrPassthrough = false,
    this.hardwareDecode = false,
  });

  final PlayerEngine engine;
  final bool pictureInPicture;
  final bool airplay;
  final bool chromecast;
  final bool hdrPassthrough;
  final bool hardwareDecode;
}

/// The reactive player state pushed to subscribers. Position/buffer are also
/// mirrored into the lightweight playback clock; snapshot changes that only
/// touch position are ignored for re-render decisions.
class PlayerSnapshot {
  const PlayerSnapshot({
    this.status = PlayerStatus.idle,
    this.positionSec = 0,
    this.durationSec = 0,
    this.bufferedSec = 0,
    this.buffering = false,
    this.volume = 1,
    this.muted = false,
    this.rate = 1,
    this.audioTracks = const [],
    this.subtitleTracks = const [],
    this.chapters = const [],
    this.subDelaySec = 0,
    this.audioDelaySec = 0,
    this.subText = '',
    this.subStartSec,
    this.audioNormalize = false,
    this.videoWidth = 0,
    this.videoHeight = 0,
    this.hdrGamma = '',
    this.errorMessage,
    this.errorCode,
    this.noAudio = false,
  });

  final PlayerStatus status;
  final double positionSec;
  final double durationSec;
  final double bufferedSec;
  final bool buffering;
  final double volume;
  final bool muted;
  final double rate;
  final List<TrackInfo> audioTracks;
  final List<TrackInfo> subtitleTracks;
  final List<Chapter> chapters;
  final double subDelaySec;
  final double audioDelaySec;
  final String subText;
  final double? subStartSec;
  final bool audioNormalize;
  final int videoWidth;
  final int videoHeight;

  /// The HDR transfer function (`""`, `pq`, `hlg`, …).
  final String hdrGamma;
  final String? errorMessage;
  final PlayerErrorCode? errorCode;
  final bool noAudio;

  /// The default idle snapshot (status idle, volume 1).
  static const empty = PlayerSnapshot();

  PlayerSnapshot copyWith({
    PlayerStatus? status,
    double? positionSec,
    double? durationSec,
    double? bufferedSec,
    bool? buffering,
    double? volume,
    bool? muted,
    double? rate,
    List<TrackInfo>? audioTracks,
    List<TrackInfo>? subtitleTracks,
    List<Chapter>? chapters,
    double? subDelaySec,
    double? audioDelaySec,
    String? subText,
    double? subStartSec,
    bool? audioNormalize,
    int? videoWidth,
    int? videoHeight,
    String? hdrGamma,
    String? errorMessage,
    PlayerErrorCode? errorCode,
    bool? noAudio,
    bool clearError = false,
  }) => PlayerSnapshot(
    status: status ?? this.status,
    positionSec: positionSec ?? this.positionSec,
    durationSec: durationSec ?? this.durationSec,
    bufferedSec: bufferedSec ?? this.bufferedSec,
    buffering: buffering ?? this.buffering,
    volume: volume ?? this.volume,
    muted: muted ?? this.muted,
    rate: rate ?? this.rate,
    audioTracks: audioTracks ?? this.audioTracks,
    subtitleTracks: subtitleTracks ?? this.subtitleTracks,
    chapters: chapters ?? this.chapters,
    subDelaySec: subDelaySec ?? this.subDelaySec,
    audioDelaySec: audioDelaySec ?? this.audioDelaySec,
    subText: subText ?? this.subText,
    subStartSec: subStartSec ?? this.subStartSec,
    audioNormalize: audioNormalize ?? this.audioNormalize,
    videoWidth: videoWidth ?? this.videoWidth,
    videoHeight: videoHeight ?? this.videoHeight,
    hdrGamma: hdrGamma ?? this.hdrGamma,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    errorCode: clearError ? null : (errorCode ?? this.errorCode),
    noAudio: noAudio ?? this.noAudio,
  );

  /// Whether two snapshots differ in any field other than the hot-path clock
  /// fields (position/buffered), matching `snapChangedIgnoringClock`.
  bool differsIgnoringClock(PlayerSnapshot other) =>
      status != other.status ||
      durationSec != other.durationSec ||
      buffering != other.buffering ||
      volume != other.volume ||
      muted != other.muted ||
      rate != other.rate ||
      audioTracks.length != other.audioTracks.length ||
      subtitleTracks.length != other.subtitleTracks.length ||
      chapters.length != other.chapters.length ||
      subDelaySec != other.subDelaySec ||
      audioDelaySec != other.audioDelaySec ||
      subText != other.subText ||
      audioNormalize != other.audioNormalize ||
      videoWidth != other.videoWidth ||
      videoHeight != other.videoHeight ||
      hdrGamma != other.hdrGamma ||
      errorMessage != other.errorMessage ||
      errorCode != other.errorCode ||
      noAudio != other.noAudio;
}
