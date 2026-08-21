import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/curfew_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/profiles_providers.dart';
import '../../app/theme_controller.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';
import '../../domain/profiles/curfew.dart';
import '../../domain/profiles/profile.dart';
import '../../domain/profiles/profile_password.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../shell/pin_entry.dart';
import '../shell/profile_switcher.dart';

/// Enforces a kid profile's daily watch-time curfew: it accrues a second every
/// tick while the player is open and not yet locked, and — once the limit is
/// reached — sails a full-screen "Time's up!" lockdown over the app, exiting the
/// player so its audio stops. A parent PIN lifts it for the rest of the day.
/// Ported from the web `CurfewGuard`.
class CurfewGuard extends ConsumerStatefulWidget {
  const CurfewGuard({super.key});

  @override
  ConsumerState<CurfewGuard> createState() => _CurfewGuardState();
}

class _CurfewGuardState extends ConsumerState<CurfewGuard> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _maybeTick());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _maybeTick() {
    if (!mounted) return;
    final limit = ref.read(activeProfileProvider)?.kid?.curfewMinutes;
    if (limit == null) return;
    if (ref.read(activeFrameProvider).kind != FrameKind.player) return;
    if (curfewLocked(ref.read(curfewControllerProvider), limit)) return;
    ref.read(curfewControllerProvider.notifier).tick();
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(activeProfileProvider);
    final limit = profile?.kid?.curfewMinutes;
    final locked = curfewLocked(ref.watch(curfewControllerProvider), limit);
    if (!locked || profile == null) return const SizedBox.shrink();

    // Exit the player behind the lockdown so its audio stops.
    if (ref.watch(activeFrameProvider).kind == FrameKind.player) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && ref.read(activeFrameProvider).kind == FrameKind.player) {
          // exitPlayer (not back) so an auto-play picker underneath doesn't
          // re-fire and relaunch the player behind the lockdown.
          ref.read(navControllerProvider.notifier).exitPlayer();
        }
      });
    }

    return Positioned.fill(
      child: _CurfewLockdown(
        tokens: ref.watch(tokensProvider),
        tr: ref.watch(translationsProvider),
        profile: profile,
        onUnlock: () => ref.read(curfewControllerProvider.notifier).unlock(),
        onSwitch: () =>
            showProfileSwitcher(context, ref, ref.read(tokensProvider)),
      ),
    );
  }
}

class _CurfewLockdown extends StatelessWidget {
  const _CurfewLockdown({
    required this.tokens,
    required this.tr,
    required this.profile,
    required this.onUnlock,
    required this.onSwitch,
  });

  final HarborTokens tokens;
  final Translations tr;
  final Profile profile;
  final VoidCallback onUnlock;
  final VoidCallback onSwitch;

  static const _top = Color(0xFF3AA6C4);
  static const _mid = Color(0xFF1C789F);
  static const _bottom = Color(0xFF0A3D5C);

  Future<void> _enterPin(BuildContext context, String hash) async {
    final pin = await showPinDialog(
      context,
      tokens: tokens,
      title: tr.t('Enter the parent PIN'),
      subtitle: tr.t('A grown-up can enter the parent PIN to keep watching.'),
      mode: PinMode.verify,
      verify: (p) => verifyProfilePassword(p, hash),
    );
    if (pin != null) onUnlock();
  }

  @override
  Widget build(BuildContext context) {
    final hash = profile.kid?.parentPinHash;
    return Material(
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [_top, _mid, _bottom],
          ),
        ),
        child: Stack(
          children: [
            const PositionedDirectional(
              start: 24,
              bottom: 40,
              child: Opacity(
                opacity: 0.8,
                child: _Doodle('liloctored.png', 96),
              ),
            ),
            const PositionedDirectional(
              end: 32,
              bottom: 60,
              child: Opacity(
                opacity: 0.7,
                child: _Doodle('lilpurpocto.png', 80),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Opacity(
                opacity: 0.5,
                child: Image.asset(
                  'assets/kids/doodles/bubbles.png',
                  height: 90,
                  fit: BoxFit.fitWidth,
                ),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.sailing_rounded,
                      size: 92,
                      color: Colors.white,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      tr.t("Time's up!"),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 56,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 460),
                      child: Text(
                        tr.t(
                          'The ship is sailing away. Thanks for watching with '
                          "Harbor, it's time to listen to your grown-ups.",
                        ),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 17,
                          height: 1.4,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    if (hash != null) ...[
                      _pill(
                        context,
                        Icons.lock_open_rounded,
                        tr.t('Enter the parent PIN'),
                        () => _enterPin(context, hash),
                        filled: true,
                        autofocus: true,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        tr.t(
                          'A grown-up can enter the parent PIN to keep watching.',
                        ),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 13,
                        ),
                      ),
                    ] else
                      Text(
                        tr.t('Ask a grown-up to switch profiles.'),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 14,
                        ),
                      ),
                    const SizedBox(height: 22),
                    _pill(
                      context,
                      Icons.switch_account_rounded,
                      tr.t('Switch profile'),
                      onSwitch,
                      // The only control when there is no parent PIN — land the
                      // remote here so the lockdown is never focus-less.
                      autofocus: hash == null,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pill(
    BuildContext context,
    IconData icon,
    String label,
    VoidCallback onPressed, {
    bool filled = false,
    bool autofocus = false,
  }) {
    return Focusable(
      tokens: tokens,
      borderRadius: 999,
      autofocus: autofocus,
      onPressed: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
        decoration: BoxDecoration(
          color: filled ? Colors.white : Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(999),
          border: filled
              ? null
              : Border.all(color: Colors.white.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: filled ? _bottom : Colors.white),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: filled ? _bottom : Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Doodle extends StatelessWidget {
  const _Doodle(this.name, this.height);
  final String name;
  final double height;

  @override
  Widget build(BuildContext context) =>
      Image.asset('assets/kids/doodles/$name', height: height);
}
