import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/iptv/playlist_form.dart';
import 'iptv_providers.dart';
import 'providers.dart';

/// Adds, edits, removes, and reorders IPTV sources in the `iptvPlaylists`
/// setting, materializing forms and clearing/purging caches. Ports
/// `views/live/hooks/use-playlist-mutations.ts`.
class IptvSourceMutations {
  IptvSourceMutations(this._ref);
  final Ref _ref;

  List<Map<String, dynamic>> _current() {
    final raw = _ref.read(settingsProvider)['iptvPlaylists'];
    return raw is List
        ? [
            for (final e in raw)
              if (e is Map) e.cast<String, dynamic>(),
          ]
        : <Map<String, dynamic>>[];
  }

  Future<void> _save(List<Map<String, dynamic>> next) =>
      _ref.read(settingsProvider.notifier).setValue('iptvPlaylists', next);

  /// Appends a new source, returning its generated (or provided) id. Ports
  /// `addPlaylist`.
  Future<String> add(PlaylistFormValue value, {String? id}) async {
    final sourceId =
        id ??
        'pl-${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(1000)}';
    await _save([..._current(), materializePlaylistEntry(sourceId, value)]);
    return sourceId;
  }

  /// Replaces a source and clears its cached playlist + EPG. Ports
  /// `editPlaylist`.
  Future<void> edit(String id, PlaylistFormValue value) async {
    final next = [
      for (final s in _current())
        if (s['id'] == id) materializePlaylistEntry(id, value) else s,
    ];
    await _save(next);
    _ref.read(iptvPlaylistStoreProvider).clear(id);
    _ref.read(epgStoreProvider).clear(id);
  }

  /// Removes a source and purges every per-source cache/preference for it.
  /// Ports `removePlaylist`.
  Future<void> remove(String id) async {
    await _save([
      for (final s in _current())
        if (s['id'] != id) s,
    ]);
    await _ref.read(iptvSourceCleanupProvider)(id);
  }

  /// Moves the source at [id] by [delta] positions. Ports `reorderPlaylist`.
  Future<void> reorder(String id, int delta) async {
    final list = _current();
    final i = list.indexWhere((s) => s['id'] == id);
    final j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    final next = [...list];
    final tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    await _save(next);
  }
}

final iptvSourceMutationsProvider = Provider<IptvSourceMutations>(
  (ref) => IptvSourceMutations(ref),
);
