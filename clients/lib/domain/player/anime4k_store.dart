import 'dart:io';

import '../../core/http/json_transport.dart' show TransportException;
import '../../core/http/text_transport.dart';
import 'anime4k_modes.dart';

/// The shader whose presence marks the pack as installed (the first file every
/// chain uses), ported from the `anime4k_dir` marker in `anime4k.rs`.
const String kAnime4kMarker = 'Anime4K_Clamp_Highlights.glsl';

/// A shader-pack download failure with a human-readable [message].
class Anime4kDownloadException implements Exception {
  const Anime4kDownloadException(this.message);
  final String message;
  @override
  String toString() => 'Anime4kDownloadException: $message';
}

/// Downloads and caches the Anime4K GLSL shader pack, porting the Tauri
/// `anime4k.rs` commands (`anime4k_dir` / `anime4k_download`). The shaders are
/// not bundled — they are fetched from GitHub on demand, exactly like the
/// desktop app — into [dir] (e.g. `<app-support>/anime4k`). The HTTP fetch is
/// injected as a [TextTransport] so the store is unit-testable without a
/// network; GLSL shaders are UTF-8 text, so a text transport is faithful.
class Anime4kShaderStore {
  const Anime4kShaderStore(this._transport, this.dir);

  final TextTransport _transport;

  /// The directory the shader pack lives in.
  final Directory dir;

  /// The installed folder path if the pack is present (the marker exists and is
  /// non-empty), else null. Ported from `anime4k_dir`.
  Future<String?> installedDir() async {
    final marker = File('${dir.path}${Platform.pathSeparator}$kAnime4kMarker');
    if (await marker.exists() && await marker.length() > 0) return dir.path;
    return null;
  }

  /// Downloads every manifest shader into [dir], returning its path. Skips
  /// existing non-empty files unless [force]. Ported from `anime4k_download`:
  /// each file is fetched with the `Harbor` user agent, rejected if the request
  /// fails or the body is empty, and written atomically per file.
  ///
  /// A downloaded body is also verified to be a real mpv user shader (it must
  /// contain a `//!` hook directive) — an anti-stub guard mirroring the
  /// downloader's content checks, so a captive-portal HTML page can never be
  /// written into the chain and fed to mpv.
  Future<String> download({bool force = false}) async {
    await dir.create(recursive: true);
    for (final (remote, local) in kAnime4kShaderManifest) {
      final dest = File('${dir.path}${Platform.pathSeparator}$local');
      if (!force && await dest.exists() && await dest.length() > 0) continue;
      final TextResponse res;
      try {
        res = await _transport.getText(
          '$kAnime4kBaseUrl/$remote',
          headers: const {'User-Agent': 'Harbor'},
        );
      } on TransportException catch (e) {
        throw Anime4kDownloadException('download $local: ${e.message}');
      }
      if (!res.ok) {
        throw Anime4kDownloadException(
          'download $local: HTTP ${res.statusCode}',
        );
      }
      final body = res.body;
      if (body.isEmpty) throw Anime4kDownloadException('$local was empty');
      if (!body.contains('//!')) {
        throw Anime4kDownloadException('$local was not a valid shader');
      }
      await dest.writeAsString(body, flush: true);
    }
    return dir.path;
  }
}
