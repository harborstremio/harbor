import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// Whether a meta looks like Japanese animation — a Japanese production with an
/// "animation"/"anime" genre. Ported 1:1 from `isJapaneseAnime`.
bool isJapaneseAnime({String? country, required List<String> genres}) {
  if (!(country ?? '').toLowerCase().contains('japan')) return false;
  return genres.any((g) {
    final l = g.toLowerCase();
    return l == 'animation' || l == 'anime';
  });
}

final _imdbId = RegExp(r'^tt\d+$');

/// Whether [id] is a bare IMDb id (`tt` + digits) — the only ids the detector
/// probes (Kitsu/MAL ids are already known anime).
bool isImdbId(String id) => _imdbId.hasMatch(id);

/// Remembers which IMDb-id titles have been detected as anime, so continue-
/// watching rows can route them through the anime experience. Persisted to
/// [KvStore] under `harbor.anime.detected.v1`, mirroring the module store in
/// `anime-detect.ts`.
class AnimeDetectStore {
  AnimeDetectStore(this._kv) : _detected = _load(_kv);

  final KvStore _kv;
  final Set<String> _detected;

  static const _key = 'harbor.anime.detected.v1';

  static Set<String> _load(KvStore kv) {
    final raw = kv.getString(_key);
    if (raw == null) return {};
    try {
      final parsed = jsonDecode(raw);
      return parsed is List
          ? {
              for (final x in parsed)
                if (x is String) x,
            }
          : {};
    } catch (_) {
      return {};
    }
  }

  /// A snapshot of the detected ids.
  Set<String> get detected => {..._detected};

  bool isDetected(String id) => _detected.contains(id);

  /// Marks [id] as detected anime; returns whether it was newly added.
  bool add(String id) {
    if (!_detected.add(id)) return false;
    _kv.setString(_key, jsonEncode(_detected.toList()));
    return true;
  }
}
