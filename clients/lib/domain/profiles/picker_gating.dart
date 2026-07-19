import 'profile.dart';

/// How often the "Who's watching?" picker is shown on launch/return, mirroring
/// the web `ProfilePromptInterval` union (`launch` | `15m` | `30m` | `never`).
enum ProfilePromptInterval { launch, m15, m30, never }

/// Parses the stored `profilePromptInterval`, falling back to `never` when the
/// legacy `skipProfileScreen` flag is set, else `launch`. Ported from
/// `readProfilePromptInterval`.
ProfilePromptInterval parseProfilePromptInterval(
  String? raw, {
  bool skipProfileScreen = false,
}) {
  switch (raw) {
    case 'launch':
      return ProfilePromptInterval.launch;
    case '15m':
      return ProfilePromptInterval.m15;
    case '30m':
      return ProfilePromptInterval.m30;
    case 'never':
      return ProfilePromptInterval.never;
  }
  return skipProfileScreen
      ? ProfilePromptInterval.never
      : ProfilePromptInterval.launch;
}

/// The re-prompt window in minutes (0 for `launch`/`never`). From
/// `intervalMinutes`.
int intervalMinutes(ProfilePromptInterval i) => switch (i) {
  ProfilePromptInterval.m15 => 15,
  ProfilePromptInterval.m30 => 30,
  _ => 0,
};

/// The profile to auto-open as, when `defaultProfileId` names an existing,
/// unlocked profile — the app then skips the picker. A PIN-locked default is
/// ignored (you must still pass the lock). Ported from `launchDefault`.
Profile? launchDefaultProfile(List<Profile> profiles, String defaultProfileId) {
  if (defaultProfileId.isEmpty) return null;
  for (final p in profiles) {
    if (p.id == defaultProfileId) {
      final locked = p.passwordHash != null && p.passwordHash!.isNotEmpty;
      return locked ? null : p;
    }
  }
  return null;
}

/// Whether the picker should open at launch. Ported 1:1 from the web
/// `pickerOpen` initializer, with one clientv2 guard: an empty profile store
/// (the web always seeds a primary) never opens the picker.
bool shouldOpenPickerOnLaunch({
  required String? activeId,
  required int profileCount,
  required bool hasLaunchDefault,
  required ProfilePromptInterval interval,
  required bool launchShownThisSession,
  required int lastSelectAtMs,
  required int nowMs,
}) {
  if (profileCount == 0) return false;
  if (activeId == null) return true;
  if (profileCount <= 1) return false;
  if (hasLaunchDefault) return false;
  switch (interval) {
    case ProfilePromptInterval.never:
      return false;
    case ProfilePromptInterval.launch:
      return !launchShownThisSession;
    case ProfilePromptInterval.m15:
    case ProfilePromptInterval.m30:
      return nowMs - lastSelectAtMs >= intervalMinutes(interval) * 60000;
  }
}

/// Whether returning to the app (resume/focus) should re-open the picker — only
/// for the timed intervals, once the window has elapsed. Ported from the web
/// window `focus` handler.
bool shouldRepromptOnResume({
  required String? activeId,
  required int profileCount,
  required ProfilePromptInterval interval,
  required int lastSelectAtMs,
  required int nowMs,
}) {
  final mins = intervalMinutes(interval);
  if (mins <= 0 || activeId == null || profileCount <= 1) return false;
  return nowMs - lastSelectAtMs >= mins * 60000;
}
