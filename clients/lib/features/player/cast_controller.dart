import 'dart:io';

import 'package:flutter_chrome_cast/flutter_chrome_cast.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/player/player_models.dart';

/// The Cast content MIME type inferred from a source URL's extension — the
/// Default Media Receiver needs the right type to pick a pipeline (HLS/DASH vs a
/// progressive file). Defaults to `video/mp4`.
String castContentType(String url) {
  var path = url.toLowerCase();
  final q = path.indexOf('?');
  if (q >= 0) path = path.substring(0, q);
  if (path.endsWith('.m3u8')) return 'application/x-mpegurl';
  if (path.endsWith('.mpd')) return 'application/dash+xml';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mkv')) return 'video/x-matroska';
  if (path.endsWith('.mov')) return 'video/quicktime';
  if (path.endsWith('.ts')) return 'video/mp2t';
  return 'video/mp4';
}

/// Builds a Cast media payload from a Harbor [source] — pure and testable. Live
/// sources cast as a LIVE stream; each external subtitle becomes a text track.
GoogleCastMediaInformation buildCastMedia(
  PlayerSource source, {
  String? title,
  String? poster,
}) {
  return GoogleCastMediaInformation(
    contentId: source.url,
    contentUrl: Uri.parse(source.url),
    streamType: source.isLive
        ? CastMediaStreamType.live
        : CastMediaStreamType.buffered,
    contentType: castContentType(source.url),
    metadata: GoogleCastMovieMediaMetadata(
      title: title ?? '',
      images: [
        if (poster != null && poster.isNotEmpty)
          GoogleCastImage(url: Uri.parse(poster)),
      ],
    ),
    tracks: [
      for (var i = 0; i < source.subtitles.length; i++)
        GoogleCastMediaTrack(
          trackId: i + 1,
          type: TrackType.text,
          trackContentId: source.subtitles[i].url,
          trackContentType: 'text/vtt',
          name: source.subtitles[i].lang ?? 'Subtitle ${i + 1}',
          subtype: TextTrackType.subtitles,
        ),
    ],
  );
}

/// Wraps `flutter_chrome_cast` for the player: device discovery, session connect,
/// media load, and remote transport. Only used on Cast-sender platforms (the
/// chrome gates it on `PlayerCapabilities.chromecast`, which is false on a TV),
/// so `CastContext` is never initialized on a receiver device.
class CastController {
  bool _initialized = false;

  /// Initializes the shared Cast context once with the Default Media Receiver.
  void ensureInitialized() {
    if (_initialized) return;
    _initialized = true;
    const appId = GoogleCastDiscoveryCriteria.kDefaultApplicationId;
    final GoogleCastOptions options = Platform.isIOS
        ? IOSGoogleCastOptions(
            GoogleCastDiscoveryCriteriaInitialize.initWithApplicationID(appId),
          )
        : GoogleCastOptionsAndroid(appId: appId);
    GoogleCastContext.instance.setSharedInstanceWithOptions(options);
  }

  Stream<List<GoogleCastDevice>> get devicesStream =>
      GoogleCastDiscoveryManager.instance.devicesStream;

  List<GoogleCastDevice> get devices =>
      GoogleCastDiscoveryManager.instance.devices;

  Stream<GoogleCastSession?> get sessionStream =>
      GoogleCastSessionManager.instance.currentSessionStream;

  GoogleCastSession? get session =>
      GoogleCastSessionManager.instance.currentSession;

  bool get isConnected =>
      session?.connectionState == GoogleCastConnectState.connected;

  Stream<Duration> get positionStream =>
      GoogleCastRemoteMediaClient.instance.playerPositionStream;

  Future<void> startDiscovery() async {
    ensureInitialized();
    await GoogleCastDiscoveryManager.instance.startDiscovery();
  }

  Future<void> stopDiscovery() =>
      GoogleCastDiscoveryManager.instance.stopDiscovery();

  Future<bool> connect(GoogleCastDevice device) =>
      GoogleCastSessionManager.instance.startSessionWithDevice(device);

  Future<void> disconnect() =>
      GoogleCastSessionManager.instance.endSessionAndStopCasting();

  /// Loads [source] onto the connected receiver, resuming at [startAtSec] and
  /// carrying the title, poster, and any external subtitle tracks.
  Future<void> loadSource(
    PlayerSource source, {
    String? title,
    String? poster,
    double startAtSec = 0,
  }) => GoogleCastRemoteMediaClient.instance.loadMedia(
    buildCastMedia(source, title: title, poster: poster),
    autoPlay: true,
    playPosition: Duration(milliseconds: (startAtSec * 1000).round()),
  );

  Future<void> play() => GoogleCastRemoteMediaClient.instance.play();

  Future<void> pause() => GoogleCastRemoteMediaClient.instance.pause();

  Future<void> seekTo(double sec) => GoogleCastRemoteMediaClient.instance.seek(
    GoogleCastMediaSeekOption(
      position: Duration(milliseconds: (sec * 1000).round()),
    ),
  );
}

/// The app-wide Cast controller.
final castControllerProvider = Provider<CastController>(
  (ref) => CastController(),
);

/// The current Cast session (null when not connected). Watched by the chrome to
/// reflect the cast connection and route transport to the receiver.
final castSessionProvider = StreamProvider<GoogleCastSession?>(
  (ref) => ref.watch(castControllerProvider).sessionStream,
);
