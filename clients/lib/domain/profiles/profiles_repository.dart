import 'dart:convert';

import '../../core/storage/kv_store.dart';
import 'profile.dart';

/// Reads and writes the profile state and resolves the two identity questions
/// the rest of the app depends on: which settings blob the active profile uses,
/// and which profile owns the Stremio session. Semantics match Harbor exactly
/// (`docs/20` §1.3–1.6, `docs/30`).
class ProfilesRepository {
  ProfilesRepository(this._kv);

  final KvStore _kv;

  static const stateKey = 'harbor.profiles.v1';
  static const sharedSettingsKey = 'harbor.settings.shared';
  static const mirrorSettingsKey = 'harbor.settings';

  /// When the active profile was last picked (for the picker re-prompt gating).
  static const lastSelectKey = 'harbor.profile.lastSelectAt';

  /// The literal fallback id Harbor uses when there is no active profile.
  static const defaultProfileId = 'default';

  /// The per-profile KV keys wiped when a profile is deleted — its auth,
  /// library, settings, and per-tracker session/cache blobs. Ported 1:1 from the
  /// web `deleteProfile` cleanup so a deleted profile leaves nothing behind.
  static List<String> scopedKeysFor(String id) => [
    'harbor.auth.$id',
    'harbor.favorites.v1.$id',
    'harbor.localwatchlist.v1.$id',
    'harbor.settings.$id',
    'harbor.trakt.session.v1.$id',
    'harbor.simkl.session.v1.$id',
    'harbor.anilist.session.v1.$id',
    'harbor.mal.session.v1.$id',
    'harbor.simkl.cache.v2.$id',
    'harbor.anilist.synced.v1.$id',
    'harbor.mal.synced.v1.$id',
  ];

  /// Removes every [scopedKeysFor] blob for [id].
  Future<void> wipeProfileScopedKeys(String id) async {
    for (final key in scopedKeysFor(id)) {
      await _kv.remove(key);
    }
  }

  /// Stamps [lastSelectKey] with the selection time (`markProfileSelectedNow`).
  Future<void> markSelectedNow([int? nowMs]) => _kv.setString(
    lastSelectKey,
    '${nowMs ?? DateTime.now().millisecondsSinceEpoch}',
  );

  /// Reads [lastSelectKey] (0 when unset) — `readLastProfileSelectAt`.
  int lastSelectAt() => int.tryParse(_kv.getString(lastSelectKey) ?? '') ?? 0;

  ProfilesState load() {
    final raw = _kv.getString(stateKey);
    if (raw == null || raw.isEmpty) return ProfilesState.empty;
    try {
      return ProfilesState.fromJson(
        (jsonDecode(raw) as Map).cast<String, dynamic>(),
      );
    } catch (_) {
      return ProfilesState.empty;
    }
  }

  /// Auto-creates the primary profile on first run, so the app is never in a
  /// no-profile state — a 1:1 port of the web profiles-store initializer
  /// (`profiles.tsx`: `if (loaded.profiles.length === 0) { … primary … }`).
  /// Persists it and returns the seeded state; a no-op when a profile already
  /// exists. [avatar]/[color] carry the Harbor identity (harborAvatar/color);
  /// [name] the default primary name; all optional so callers can pass what the
  /// settings hold. [nowMs] stamps the id/createdAt (deterministic in tests).
  Future<ProfilesState> ensureDefaultProfile({
    String? name,
    String? avatar,
    String? color,
    int? nowMs,
  }) async {
    final loaded = load();
    if (loaded.profiles.isNotEmpty) return loaded;
    final ms = nowMs ?? DateTime.now().millisecondsSinceEpoch;
    final primary = Profile(
      id: 'p-$ms',
      name: (name != null && name.trim().isNotEmpty) ? name.trim() : 'Profile',
      avatar: avatar,
      color: color ?? kProfileColors.first,
      isPrimary: true,
      settingsLinked: true,
      createdAt: ms,
    );
    final seeded = ProfilesState(profiles: [primary], activeId: primary.id);
    await save(seeded);
    return seeded;
  }

  Future<void> save(ProfilesState state) =>
      _kv.setString(stateKey, jsonEncode(state.toJson()));

  /// `activeId || "default"` — a null OR empty active id resolves to `default`
  /// (JS `||` truthiness, not just null-coalescing).
  static String _orDefault(String? activeId) =>
      (activeId != null && activeId.isNotEmpty) ? activeId : defaultProfileId;

  String activeProfileId() => _orDefault(load().activeId);

  Profile? activeProfile() {
    final state = load();
    final id = state.activeId;
    if (id == null) return null;
    for (final p in state.profiles) {
      if (p.id == id) return p;
    }
    return null;
  }

  /// `linked ? harbor.settings.shared : harbor.settings.<profileId>`.
  static String sourceKeyFor(String profileId, bool linked) =>
      linked ? sharedSettingsKey : 'harbor.settings.$profileId';

  /// The settings blob key the active profile reads/writes.
  String settingsSourceKey() {
    final active = activeProfile();
    final linked = active?.linked ?? true; // linked by default
    return sourceKeyFor(activeProfileId(), linked);
  }

  /// Which profile owns the Stremio session: the active profile, unless it
  /// delegates via `shareStremioWith` to another existing profile.
  String stremioSourceProfileId() {
    final state = load();
    final id = _orDefault(state.activeId);
    Profile? active;
    for (final p in state.profiles) {
      if (p.id == id) {
        active = p;
        break;
      }
    }
    if (active == null) return id;
    final share = active.shareStremioWith;
    if (share == null) return active.id;
    final exists = state.profiles.any((p) => p.id == share);
    return exists ? share : active.id;
  }
}
