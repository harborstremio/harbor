import 'player_models.dart';

/// The host operating-system family the player runs on, coarse enough to derive
/// from `dart:io` (`iosFamily` covers iOS / iPadOS / tvOS, which all report
/// `Platform.isIOS`). Kept Flutter-free so [computePlayerCapabilities] is a pure,
/// table-testable function; the running OS is mapped in the features layer.
enum PlayerHostOs { iosFamily, android, macos, windows, linux, web, unknown }

/// Derives the real [PlayerCapabilities] for a playback [engine] on a host [os]
/// (and whether it is the ten-foot / TV idiom). Replaces the previously
/// hardcoded capability flags so the chrome can gate AirPlay / Cast / PiP / HDR
/// controls on what the active engine actually supports on this platform.
///
/// The invariants (see `docs/50` and the 2026 per-platform research):
/// * AirPlay *video* needs AVPlayer (the native/default engine) on an Apple OS —
///   libmpv cannot AirPlay video.
/// * True HDR10/Dolby-Vision/Atmos passthrough reaches the display pipeline only
///   via the native engine on a mobile Apple/Android OS, or via libmpv
///   (libplacebo + bitstream audio) on the desktop; libmpv on mobile tone-maps
///   to SDR.
/// * OS Picture-in-Picture is a native-engine, handheld/desktop feature — never
///   on the TV idiom, never through libmpv.
PlayerCapabilities computePlayerCapabilities(
  PlayerEngine engine,
  PlayerHostOs os, {
  bool isTv = false,
}) {
  final native = engine == PlayerEngine.defaultEngine; // AVPlayer / ExoPlayer
  final iosFamily = os == PlayerHostOs.iosFamily; // iOS / iPadOS / tvOS
  final apple = iosFamily || os == PlayerHostOs.macos;
  final desktop =
      os == PlayerHostOs.macos ||
      os == PlayerHostOs.windows ||
      os == PlayerHostOs.linux;
  final real = os != PlayerHostOs.web && os != PlayerHostOs.unknown;

  final airplay = native && apple;

  // Google Cast senders — the mobile OSes flutter_chrome_cast supports (iOS &
  // Android), never the ten-foot idiom (a TV is a receiver) and never desktop
  // (no supported sender there yet).
  final chromecast = (iosFamily || os == PlayerHostOs.android) && !isTv;

  final hdrPassthrough =
      (native && (iosFamily || os == PlayerHostOs.android)) ||
      (!native && desktop);

  final hardwareDecode = real;

  final pictureInPicture =
      native &&
      !isTv &&
      (iosFamily || os == PlayerHostOs.android || os == PlayerHostOs.macos);

  return PlayerCapabilities(
    engine: engine,
    airplay: airplay,
    chromecast: chromecast,
    hdrPassthrough: hdrPassthrough,
    hardwareDecode: hardwareDecode,
    pictureInPicture: pictureInPicture,
  );
}

/// The lowercased container extension of a source [url] (query and fragment
/// stripped), or null when the URL has no file extension — e.g. a debrid or
/// streaming link whose container can't be inferred.
String? sourceContainerExtension(String url) {
  var u = url;
  final q = u.indexOf('?');
  if (q >= 0) u = u.substring(0, q);
  final h = u.indexOf('#');
  if (h >= 0) u = u.substring(0, h);
  final slash = u.lastIndexOf('/');
  final name = slash >= 0 ? u.substring(slash + 1) : u;
  final dot = name.lastIndexOf('.');
  if (dot <= 0 || dot == name.length - 1) return null;
  return name.substring(dot + 1).toLowerCase();
}

// Containers AVPlayer (Apple) opens natively — so an exotic MP4/MOV/HLS keeps
// its Dolby Vision / HDR10 / Atmos instead of dropping to libmpv (which
// tone-maps to SDR on mobile). AVPlayer cannot open MKV/WebM/AVI or raw TS.
const _appleNativeContainers = {
  'mp4',
  'm4v',
  'mov',
  'm4a',
  'mp3',
  'aac',
  'm3u8',
};

// Containers ExoPlayer/media3 (Android) opens natively — broader than AVPlayer,
// notably MKV/WebM/TS with HDR/DV, so most exotic sources stay native.
const _androidNativeContainers = {
  'mp4',
  'm4v',
  'mov',
  'mkv',
  'webm',
  'ts',
  'm2ts',
  'mpeg',
  'mpg',
  'm4a',
  'mp3',
  'aac',
  'flac',
  'ogg',
  'opus',
  'm3u8',
  'mpd',
  '3gp',
};

/// Whether the platform's NATIVE engine (AVPlayer on the Apple family,
/// ExoPlayer/media3 on Android) can decode the container at [url]. Used so an
/// exotic (`notWebReady`) source can stay on the native engine — preserving
/// Dolby Vision / HDR / Atmos — rather than falling to libmpv. Conservative: an
/// unknown container, or any non-mobile OS, returns false so playback never
/// silently breaks by handing an unsupported container to the native decoder.
bool nativeEngineCanPlay(PlayerHostOs os, String url) {
  final ext = sourceContainerExtension(url);
  if (ext == null) return false;
  return switch (os) {
    PlayerHostOs.iosFamily => _appleNativeContainers.contains(ext),
    PlayerHostOs.android => _androidNativeContainers.contains(ext),
    _ => false,
  };
}
