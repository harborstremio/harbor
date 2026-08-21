import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../domain/player/anime4k_store.dart';
import 'iptv_providers.dart' show textTransportProvider;

/// The Anime4K shader store, backed by the app-support directory (the Flutter
/// equivalent of the Tauri app-data dir the desktop build uses) and the shared
/// text transport. Resolved lazily on first use.
final anime4kStoreProvider = FutureProvider<Anime4kShaderStore>((ref) async {
  final base = await getApplicationSupportDirectory();
  final dir = Directory('${base.path}${Platform.pathSeparator}anime4k');
  return Anime4kShaderStore(ref.watch(textTransportProvider), dir);
});
