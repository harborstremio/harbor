import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../app/providers.dart';
import '../../domain/player/player_capabilities.dart';
import '../../domain/player/player_models.dart';
import 'flutter_player_bridge.dart';
import 'media_kit_bridge.dart';
import 'player_host_os.dart';
import 'video_player_bridge.dart';

/// Resolves (and creates) the directory player screenshots are written to — an
/// app-documents "Harbor Screenshots" folder, the native-idiom equivalent of the
/// desktop Pictures/Harbor target. Injected so tests can supply a temp dir.
final screenshotsDirProvider = Provider<Future<String> Function()>((ref) {
  return () async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}/Harbor Screenshots');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir.path;
  };
});

/// Whether the advanced (libmpv) engine should back [source] on host [os],
/// ported from the `pickBridge` heuristic (`docs/50` §1) and made platform-aware
/// so native Dolby Vision / HDR / Atmos are preserved:
/// * web-ready live always uses the default (native) engine;
/// * `mpv`/`html5` force an engine (except web-ready live, above);
/// * `auto` + a web-ready source → native;
/// * `auto` + an exotic (`notWebReady`) source → libmpv on the desktop (its
///   strength), but on mobile/TV it STAYS on the native engine when that OS's
///   decoder can open the container ([nativeEngineCanPlay], preserving DV/HDR/
///   Atmos), dropping to libmpv only for containers the native decoder cannot
///   open (MKV on Apple, AVI, unknown links, …).
bool useAdvancedEngine(
  String playerEngine,
  PlayerSource source,
  PlayerHostOs os,
) {
  if (source.isLive && !source.notWebReady) return false;
  if (playerEngine == 'mpv') return true;
  if (playerEngine == 'html5') return false;
  // Container-accurate routing: a KNOWN container the platform's native decoder
  // cannot open must use libmpv even when the add-on never set notWebReady —
  // otherwise an unflagged `.mkv`/`.avi` is handed to AVPlayer/ExoPlayer and
  // fails to open (iOS AVPlayer cannot play MKV/AVI at all; ExoPlayer cannot
  // reliably play AVI). Read from the URL extension; extension-less debrid/HLS
  // links have no inferable container and fall through to the hint-based path.
  final mobile = os == PlayerHostOs.iosFamily || os == PlayerHostOs.android;
  if (mobile &&
      sourceContainerExtension(source.url) != null &&
      !nativeEngineCanPlay(os, source.url)) {
    return true;
  }
  if (!source.notWebReady) return false;
  final desktop =
      os == PlayerHostOs.macos ||
      os == PlayerHostOs.windows ||
      os == PlayerHostOs.linux;
  if (desktop) return true;
  return !nativeEngineCanPlay(os, source.url);
}

/// Builds the player engine for a source. Overridden in tests with a fake.
final playerBridgeFactoryProvider =
    Provider<FlutterPlayerBridge Function(PlayerSource)>((ref) {
      final engine = ref.watch(settingsProvider).getString('playerEngine');
      final host = currentPlayerHostOs();
      return (source) => useAdvancedEngine(engine, source, host)
          ? MediaKitBridge()
          : VideoPlayerBridge();
    });
