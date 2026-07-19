import 'profile.dart';

/// A nav tab that a parent can hide behind the profile PIN. Ported from
/// `lockable-tabs.ts` (`LockableTab` + `LOCKABLE_TABS`); the key matches the web
/// so `Profile.lockedTabs` stays interoperable.
typedef LockableTab = ({String key, String label});

const List<LockableTab> kLockableTabs = [
  (key: 'discover', label: 'Discover'),
  (key: 'movies', label: 'Movies'),
  (key: 'shows', label: 'Shows'),
  (key: 'anime', label: 'Anime'),
  (key: 'sports', label: 'Sports'),
  (key: 'liveTv', label: 'Live TV'),
  (key: 'calendar', label: 'Calendar'),
  (key: 'library', label: 'My Library'),
  (key: 'addons', label: 'Addons'),
];

/// Whether a profile hides any tab. Ported from `anyTabLocked`.
bool anyTabLocked(List<String>? lockedTabs) =>
    lockedTabs != null && lockedTabs.isNotEmpty;

/// Whether the [key] tab is hidden for a profile.
bool isTabLocked(List<String>? lockedTabs, String key) =>
    lockedTabs != null && lockedTabs.contains(key);

/// Returns the locked-tabs list with [key] locked or unlocked, kept in the
/// canonical tab order. Returns null when nothing remains locked (the web
/// stores null for "no tabs hidden").
List<String>? withTabLocked(List<String>? lockedTabs, String key, bool locked) {
  final set = {...?lockedTabs};
  if (locked) {
    set.add(key);
  } else {
    set.remove(key);
  }
  if (set.isEmpty) return null;
  return [
    for (final t in kLockableTabs)
      if (set.contains(t.key)) t.key,
  ];
}

/// Whether a profile has a PIN set.
bool profileHasPin(Profile? profile) =>
    profile?.passwordHash != null && profile!.passwordHash!.isNotEmpty;

/// Whether a profile *wants* to be locked — it has a PIN and hides at least one
/// tab. Ported from the web `wantsLock`.
bool profileWantsLock(Profile? profile) =>
    profileHasPin(profile) && anyTabLocked(profile?.lockedTabs);

/// Whether a profile is currently locked: it wants a lock and the session has
/// not been unlocked (neither by entering the PIN this session nor by having
/// logged in as this profile). Ported from the web `locked`.
bool profileLocked(
  Profile? profile, {
  required bool sessionUnlocked,
  required bool loginUnlocked,
}) => profileWantsLock(profile) && !sessionUnlocked && !loginUnlocked;
