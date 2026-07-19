import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// The manually-set watched state for individual series episodes.
///
/// Ported from `manual-watched.ts`: a tri-state store backed by two lists — a
/// watched set (`harbor.manualwatched.v1`) and an explicit unwatched set
/// (`harbor.manualunwatched.v1`). Marking an episode watched (from the player
/// on finish, or a mark-season action) adds its key to the watched set and
/// clears any unwatched entry; the explicit unwatched set lets a viewer
/// override a tracker/resume signal that would otherwise report the episode as
/// watched.
class ManualWatchedStore {
  ManualWatchedStore(this._kv);

  static const _watchedKeyStore = 'harbor.manualwatched.v1';
  static const _unwatchedKeyStore = 'harbor.manualunwatched.v1';

  final KvStore _kv;

  /// The per-episode key, `metaId|season|episode` (matching `manual-watched`).
  static String episodeKey(String metaId, int season, int episode) =>
      '$metaId|$season|$episode';

  Set<String> _loadSet(String storeKey) {
    final raw = _kv.getString(storeKey);
    if (raw == null || raw.isEmpty) return {};
    try {
      final p = jsonDecode(raw);
      return p is List
          ? {
              for (final e in p)
                if (e is String) e,
            }
          : {};
    } catch (_) {
      return {};
    }
  }

  /// The set of watched-episode keys — the reactive value the episode grid
  /// reads to render a check.
  Set<String> loadWatched() => _loadSet(_watchedKeyStore);

  Set<String> loadUnwatched() => _loadSet(_unwatchedKeyStore);

  /// `true` watched, `false` explicitly unwatched, `null` unset — mirrors
  /// `manualWatchedState`.
  bool? state(String metaId, int season, int episode) {
    final k = episodeKey(metaId, season, episode);
    if (loadWatched().contains(k)) return true;
    if (loadUnwatched().contains(k)) return false;
    return null;
  }

  bool isWatched(String metaId, int season, int episode) =>
      loadWatched().contains(episodeKey(metaId, season, episode));

  /// Sets one episode's manual state, moving its key between the two sets, and
  /// returns the resulting watched set.
  Future<Set<String>> set(
    String metaId,
    int season,
    int episode,
    bool watched,
  ) => setMany(metaId, [(season, episode)], watched);

  /// Sets many episodes at once (a mark-season action), persisting both sets in
  /// a single write, and returns the resulting watched set.
  Future<Set<String>> setMany(
    String metaId,
    List<(int season, int episode)> episodes,
    bool watched,
  ) async {
    final on = loadWatched();
    final off = loadUnwatched();
    var changed = false;
    for (final (season, episode) in episodes) {
      final k = episodeKey(metaId, season, episode);
      if (watched) {
        changed |= on.add(k);
        changed |= off.remove(k);
      } else {
        changed |= on.remove(k);
        changed |= off.add(k);
      }
    }
    if (changed) {
      await _kv.setString(_watchedKeyStore, jsonEncode(on.toList()));
      await _kv.setString(_unwatchedKeyStore, jsonEncode(off.toList()));
    }
    return on;
  }
}
