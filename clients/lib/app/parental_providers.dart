import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/profiles/parental.dart';
import '../domain/profiles/profile_password.dart';
import 'profiles_providers.dart';

/// The live parental state for the active profile.
class ParentalState {
  const ParentalState({
    required this.locked,
    required this.hasPin,
    required this.lockedTabs,
  });

  /// Whether the profile is currently locked (PIN + hidden tabs, not yet
  /// unlocked this session).
  final bool locked;
  final bool hasPin;

  /// The keys of the tabs the profile hides.
  final List<String> lockedTabs;
}

/// Drives the profile PIN lock, ported from the web `useParental`: a profile
/// that has a PIN and hides tabs is locked until the PIN is entered this
/// session; switching profiles re-locks. Persists the PIN hash and hidden tabs
/// onto the profile via [ProfilesController].
class ParentalController extends Notifier<ParentalState> {
  final Set<String> _unlockedIds = {};
  String? _lastProfileId;

  @override
  ParentalState build() {
    final profile = ref.watch(activeProfileProvider);
    // Switching profiles clears any session unlock (matches the web resetting
    // `sessionUnlockedFor` on the active-profile change).
    if (profile?.id != _lastProfileId) {
      _unlockedIds.clear();
      _lastProfileId = profile?.id;
    }
    final unlocked = profile != null && _unlockedIds.contains(profile.id);
    return ParentalState(
      locked: profileLocked(
        profile,
        sessionUnlocked: unlocked,
        loginUnlocked: false,
      ),
      hasPin: profileHasPin(profile),
      lockedTabs: profile?.lockedTabs ?? const [],
    );
  }

  void _refresh() {
    final profile = ref.read(activeProfileProvider);
    final unlocked = profile != null && _unlockedIds.contains(profile.id);
    state = ParentalState(
      locked: profileLocked(
        profile,
        sessionUnlocked: unlocked,
        loginUnlocked: false,
      ),
      hasPin: profileHasPin(profile),
      lockedTabs: profile?.lockedTabs ?? const [],
    );
  }

  /// Sets (or replaces) the active profile's PIN and unlocks it.
  Future<void> setPin(String pin) async {
    final profile = ref.read(activeProfileProvider);
    if (profile == null) return;
    final hash = hashProfilePassword(pin);
    await ref
        .read(profilesProvider.notifier)
        .updateActiveProfile((p) => p.copyWith(passwordHash: hash));
    _unlockedIds.add(profile.id);
    _refresh();
  }

  /// Removes the active profile's PIN.
  Future<void> clearPin() async {
    final profile = ref.read(activeProfileProvider);
    if (profile == null) return;
    await ref
        .read(profilesProvider.notifier)
        .updateActiveProfile((p) => p.copyWith(passwordHash: null));
    _unlockedIds.add(profile.id);
    _refresh();
  }

  /// Re-locks the active profile (forgets this session's unlock).
  void lock() {
    final profile = ref.read(activeProfileProvider);
    if (profile != null) _unlockedIds.remove(profile.id);
    _refresh();
  }

  /// Unlocks the active profile if [pin] is correct (or there is no PIN).
  /// Returns whether it is now unlocked.
  Future<bool> unlock(String pin) async {
    final profile = ref.read(activeProfileProvider);
    if (profile == null) return false;
    final hash = profile.passwordHash;
    if (hash == null || hash.isEmpty || verifyProfilePassword(pin, hash)) {
      _unlockedIds.add(profile.id);
      _refresh();
      return true;
    }
    return false;
  }

  /// Hides or reveals a lockable tab for the active profile.
  Future<void> setTabHidden(String tabKey, bool hidden) async {
    final profile = ref.read(activeProfileProvider);
    if (profile == null) return;
    await ref
        .read(profilesProvider.notifier)
        .updateActiveProfile(
          (p) => p.copyWith(
            lockedTabs: withTabLocked(p.lockedTabs, tabKey, hidden),
          ),
        );
    _refresh();
  }
}

final parentalProvider = NotifierProvider<ParentalController, ParentalState>(
  ParentalController.new,
);
