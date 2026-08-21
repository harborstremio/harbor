import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/profiles/profile.dart';
import 'providers.dart';

/// The reactive profile state — the profile list and the active id — kept in
/// sync with [ProfilesRepository]. Widgets watch this (rather than reading the
/// repo once) so profile edits and switches re-render immediately.
class ProfilesController extends Notifier<ProfilesState> {
  @override
  ProfilesState build() => ref.watch(profilesRepoProvider).load();

  /// Profiles unlocked (via PIN) during this app session — a locked profile the
  /// user has already unlocked isn't re-challenged until the app restarts.
  /// Mirrors the web `sessionUnlockedIds`.
  final Set<String> _sessionUnlockedIds = {};

  /// Whether [id] has been PIN-unlocked this session.
  bool isSessionUnlocked(String id) => _sessionUnlockedIds.contains(id);

  Profile? get activeProfile {
    final id = state.activeId;
    if (id == null) return null;
    for (final p in state.profiles) {
      if (p.id == id) return p;
    }
    return null;
  }

  Future<void> _persist(ProfilesState next) async {
    await ref.read(profilesRepoProvider).save(next);
    state = next;
  }

  /// Switches the active profile (no-op for an unknown id).
  Future<void> setActive(String id) {
    if (!state.profiles.any((p) => p.id == id)) return Future.value();
    return _persist(state.copyWith(activeId: id));
  }

  /// Selects [id] as active, stamping the last-select time and — when [unlocked]
  /// — remembering that this session cleared its PIN. Ported from the web
  /// `selectProfile`; the picker route closes itself on return.
  Future<void> selectProfile(
    String id, {
    bool unlocked = false,
    int? nowMs,
  }) async {
    if (!state.profiles.any((p) => p.id == id)) return;
    if (unlocked) _sessionUnlockedIds.add(id);
    await ref.read(profilesRepoProvider).markSelectedNow(nowMs);
    await setActive(id);
  }

  /// Applies [change] to the profile with [id] and persists.
  Future<void> updateProfile(String id, Profile Function(Profile) change) {
    final idx = state.profiles.indexWhere((p) => p.id == id);
    if (idx < 0) return Future.value();
    final profiles = [...state.profiles];
    profiles[idx] = change(profiles[idx]);
    return _persist(state.copyWith(profiles: profiles));
  }

  /// Applies [change] to the currently active profile and persists.
  Future<void> updateActiveProfile(Profile Function(Profile) change) {
    final id = state.activeId;
    if (id == null) return Future.value();
    return updateProfile(id, change);
  }

  /// Creates a new profile (delegating its Stremio session to the primary) and
  /// persists it. Ported from the web `createProfile`: [avatar], [color], and a
  /// rich [kid] config can be set at creation; [color] defaults to the next
  /// unused palette colour. Returns the new id.
  Future<String> createProfile({
    required String name,
    String? avatar,
    String? color,
    KidConfig? kid,
    int? nowMs,
  }) async {
    final primary = state.profiles.firstWhere(
      (p) => p.isPrimary,
      orElse: () => state.profiles.isNotEmpty
          ? state.profiles.first
          : const Profile(id: '', name: ''),
    );
    final trimmed = name.trim();
    final safeName = (trimmed.isEmpty)
        ? 'Profile'
        : (trimmed.length > 32 ? trimmed.substring(0, 32) : trimmed);
    final id = 'p-${nowMs ?? DateTime.now().microsecondsSinceEpoch}';
    final profile = Profile(
      id: id,
      name: safeName,
      avatar: avatar,
      color: color ?? pickProfileColor(state.profiles),
      shareStremioWith: primary.id.isEmpty ? null : primary.id,
      kid: kid,
      settingsLinked: true,
      createdAt: nowMs ?? DateTime.now().millisecondsSinceEpoch,
    );
    await _persist(state.copyWith(profiles: [...state.profiles, profile]));
    return id;
  }

  /// Convenience wrapper over [createProfile] for the simple add flow (name +
  /// kid toggle); the kid toggle maps to [kDefaultKid].
  Future<String> addProfile({
    required String name,
    bool kid = false,
    int? nowMs,
  }) => createProfile(name: name, kid: kid ? kDefaultKid : null, nowMs: nowMs);

  /// Deletes a profile and wipes its per-profile data. The primary profile can't
  /// be deleted; deleting the active one switches to the primary (or the first
  /// remaining), and any profile that delegated its Stremio session to the
  /// deleted one has that link cleared. Ported from the web `deleteProfile`.
  Future<void> deleteProfile(String id) async {
    final target = state.profiles.where((p) => p.id == id).firstOrNull;
    if (target == null || target.isPrimary || state.profiles.length <= 1) {
      return;
    }
    final remaining = [
      for (final p in state.profiles)
        if (p.id != id)
          p.shareStremioWith == id ? p.copyWith(shareStremioWith: null) : p,
    ];
    var activeId = state.activeId;
    if (activeId == id) {
      final fallback = remaining.firstWhere(
        (p) => p.isPrimary,
        orElse: () => remaining.first,
      );
      activeId = fallback.id;
    }
    _sessionUnlockedIds.remove(id);
    await ref.read(profilesRepoProvider).wipeProfileScopedKeys(id);
    await _persist(ProfilesState(profiles: remaining, activeId: activeId));
  }
}

final profilesProvider = NotifierProvider<ProfilesController, ProfilesState>(
  ProfilesController.new,
);

/// The active profile, reactively — null when there is no active profile.
final activeProfileProvider = Provider<Profile?>((ref) {
  final state = ref.watch(profilesProvider);
  final id = state.activeId;
  if (id == null) return null;
  for (final p in state.profiles) {
    if (p.id == id) return p;
  }
  return null;
});
