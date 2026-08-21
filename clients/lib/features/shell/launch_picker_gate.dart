import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/curfew_providers.dart';
import '../../app/deep_link_providers.dart';
import '../../app/profiles_providers.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../domain/profiles/curfew.dart';
import '../../domain/profiles/picker_gating.dart';
import '../kids/curfew_guard.dart';
import '../kids/kids_confinement.dart';
import 'app_shell.dart';
import 'profile_picker_screen.dart';
import 'profile_switcher.dart';

/// True once the "launch" picker has been shown this app session — the `launch`
/// interval opens the picker only once per launch, mirroring the web
/// session-storage flag `harbor.pickerShown`.
bool _launchPickerShownThisSession = false;

/// Wraps the shell and, at launch (and on return for the timed intervals),
/// applies the profile-picker gating: auto-selects a `defaultProfileId`, or
/// opens the "Who's watching?" picker per `profilePromptInterval`. Ported from
/// the web profiles-store `pickerOpen` initializer and its focus re-prompt.
class LaunchPickerGate extends ConsumerStatefulWidget {
  const LaunchPickerGate({super.key, this.child = const AppShell()});

  /// The shell the gate renders; overridable so tests can drive the gating
  /// without pumping the whole shell.
  final Widget child;

  @override
  ConsumerState<LaunchPickerGate> createState() => _LaunchPickerGateState();
}

class _LaunchPickerGateState extends ConsumerState<LaunchPickerGate>
    with WidgetsBindingObserver {
  bool _pickerOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootGate());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  ProfilePromptInterval _interval() {
    final settings = ref.read(settingsProvider);
    return parseProfilePromptInterval(
      settings.getString('profilePromptInterval'),
      skipProfileScreen: settings.getBool('skipProfileScreen'),
    );
  }

  void _bootGate() {
    if (!mounted) return;
    final state = ref.read(profilesProvider);
    final interval = _interval();
    final def = launchDefaultProfile(
      state.profiles,
      ref.read(settingsProvider).getString('defaultProfileId'),
    );
    // A default profile is opened as the active one, skipping the picker.
    if (def != null && state.activeId != def.id) {
      ref.read(profilesProvider.notifier).setActive(def.id);
    }
    // With no active profile, [build] renders the required picker inline —
    // pushing a second one over it would stack two "Who's watching?" screens.
    if ((def?.id ?? state.activeId) == null) return;
    final open = shouldOpenPickerOnLaunch(
      activeId: def?.id ?? state.activeId,
      profileCount: state.profiles.length,
      hasLaunchDefault: def != null,
      interval: interval,
      launchShownThisSession: _launchPickerShownThisSession,
      lastSelectAtMs: ref.read(profilesRepoProvider).lastSelectAt(),
      nowMs: DateTime.now().millisecondsSinceEpoch,
    );
    if (interval == ProfilePromptInterval.launch) {
      _launchPickerShownThisSession = true;
    }
    if (open) _openPicker();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState lifecycle) {
    if (lifecycle != AppLifecycleState.resumed || !mounted) return;
    final state = ref.read(profilesProvider);
    if (shouldRepromptOnResume(
      activeId: state.activeId,
      profileCount: state.profiles.length,
      interval: _interval(),
      lastSelectAtMs: ref.read(profilesRepoProvider).lastSelectAt(),
      nowMs: DateTime.now().millisecondsSinceEpoch,
    )) {
      _openPicker();
    }
  }

  Future<void> _openPicker() async {
    if (_pickerOpen || !mounted) return;
    _pickerOpen = true;
    try {
      await showProfileSwitcher(context, ref, ref.read(tokensProvider));
    } finally {
      _pickerOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    // A `harbor://profiles` deep link / "Who's watching?" assistant phrase parks
    // a request the link bridge can't present itself (it has no context); open
    // the picker here and clear it.
    ref.listen<bool>(pendingProfilePickerProvider, (_, requested) {
      if (requested) {
        ref.read(pendingProfilePickerProvider.notifier).clear();
        _openPicker();
      }
    });
    // A profile is required to enter the app on every platform: without an
    // active one the shell is not built at all, and the picker it shows instead
    // cannot be dismissed. A stored/default profile satisfies this without the
    // user ever seeing it, so `defaultProfileId` / `skipProfileScreen` /
    // `profilePromptInterval` keep working — they just auto-pick.
    final profile = ref.watch(activeProfileProvider);
    if (profile == null) {
      return ProfilePickerScreen(
        tokens: ref.watch(tokensProvider),
        dismissible: false,
      );
    }
    // While a kid profile is curfew-locked, take the app behind the lockdown out
    // of the focus tree so a TV D-pad cannot walk to the hidden content and
    // navigate away — the lockdown (a Stack sibling, not a route) can only be
    // trapped from here.
    final locked = curfewLocked(
      ref.watch(curfewControllerProvider),
      profile.kid?.curfewMinutes,
    );
    return Stack(
      children: [
        Positioned.fill(
          child: ExcludeFocus(excluding: locked, child: widget.child),
        ),
        const KidsConfinementGuard(),
        const CurfewGuard(),
      ],
    );
  }
}

/// Resets the once-per-session launch flag so each test starts clean.
@visibleForTesting
void resetLaunchPickerShown() => _launchPickerShownThisSession = false;
