import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/profiles_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/profiles/profile.dart';
import '../../domain/profiles/profile_password.dart';
import 'pin_entry.dart';
import 'profile_switcher.dart';

/// The full-screen, per-platform "Who's watching?" profile picker — the native,
/// remote-navigable analog of the web `ProfilePickerModal`. Tiles scale with the
/// idiom (phone/tablet/tv); a locked profile routes through [PinEntry]; the
/// primary profile can add and (in Manage mode) edit profiles. Presented as a
/// full-screen route so it takes over like Netflix's picker.
class ProfilePickerScreen extends ConsumerStatefulWidget {
  const ProfilePickerScreen({
    super.key,
    required this.tokens,
    this.dismissible = true,
  });

  /// When false the picker is a hard gate: there is no close button and system
  /// Back / the TV remote's Back cannot leave it. Used at launch, where a
  /// profile must be chosen before the app can be entered.
  final bool dismissible;

  final HarborTokens tokens;

  @override
  ConsumerState<ProfilePickerScreen> createState() =>
      _ProfilePickerScreenState();
}

class _ProfilePickerScreenState extends ConsumerState<ProfilePickerScreen> {
  Profile? _unlocking;
  bool _manage = false;

  /// Whether any profile is the primary. When none is (fresh or legacy state),
  /// the picker must still offer Add so a manageable profile can be created.
  static bool _hasPrimary(ProfilesState state) =>
      state.profiles.any((p) => p.isPrimary);

  Future<void> _select(Profile p, Profile? active) async {
    if (p.passwordHash != null &&
        p.passwordHash!.isNotEmpty &&
        p.id != active?.id &&
        !ref.read(profilesProvider.notifier).isSessionUnlocked(p.id)) {
      setState(() => _unlocking = p);
      return;
    }
    await _commit(p);
  }

  Future<void> _commit(Profile p, {bool unlocked = false}) async {
    await ref
        .read(profilesProvider.notifier)
        .selectProfile(p.id, unlocked: unlocked);
    if (!mounted) return;
    // When shown inline as the launch gate (non-dismissible), the picker is the
    // page body — not a pushed route. Selecting a profile flips
    // `activeProfileProvider` non-null, so the gate rebuilds itself into the
    // shell. Popping here would tear down the app's route instead → black
    // screen. Only pop when we were pushed as a dismissible route.
    if (widget.dismissible) Navigator.of(context).pop();
  }

  Future<void> _openEditor({Profile? profile}) => showDialog<void>(
    context: context,
    builder: (_) =>
        ProfileEditorDialog(tokens: widget.tokens, profile: profile),
  );

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final idiom = Idiom.of(context);
    final state = ref.watch(profilesProvider);
    final active = state.profiles.cast<Profile?>().firstWhere(
      (p) => p?.id == state.activeId,
      orElse: () => null,
    );
    final canManage = active?.isPrimary ?? false;

    return PopScope(
      // A launch gate cannot be escaped: no Back out of "Who's watching?".
      canPop: widget.dismissible,
      child: Scaffold(
        backgroundColor: t.canvas,
        body: SafeArea(
          child: Padding(
            padding: overscanInset(idiom),
            child: _unlocking != null
                ? _unlockBody(t)
                : _listBody(t, idiom, state, active, canManage),
          ),
        ),
      ),
    );
  }

  Widget _unlockBody(HarborTokens t) {
    final p = _unlocking!;
    final tr = ref.watch(translationsProvider);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ProfileAvatar(profile: p, tokens: t, size: 96),
            const SizedBox(height: 22),
            PinEntry(
              tokens: t,
              title: tr.t("Enter {name}'s PIN", {'name': p.name}),
              subtitle: tr.t(
                'Profile is locked. Enter the 4-digit PIN to continue.',
              ),
              mode: PinMode.verify,
              verify: (pin) => verifyProfilePassword(pin, p.passwordHash!),
              onComplete: (_) => _commit(p, unlocked: true),
              onBack: () => setState(() => _unlocking = null),
            ),
          ],
        ),
      ),
    );
  }

  Widget _listBody(
    HarborTokens t,
    Idiom idiom,
    ProfilesState state,
    Profile? active,
    bool canManage,
  ) {
    final tr = ref.watch(translationsProvider);
    final titleSize = idiom.isTv ? 46.0 : (idiom.isTablet ? 38.0 : 28.0);
    final avatarSize = idiom.isTv ? 128.0 : (idiom.isTablet ? 104.0 : 84.0);
    final spacing = idiom.isTv ? 44.0 : (idiom.isTablet ? 34.0 : 22.0);
    final runSpacing = idiom.isTv ? 32.0 : (idiom.isTablet ? 30.0 : 24.0);

    return Stack(
      children: [
        if (widget.dismissible)
          Align(
            alignment: AlignmentDirectional.topEnd,
            child: Focusable(
              tokens: t,
              scale: 1.0,
              borderRadius: 999,
              onPressed: () => Navigator.of(context).maybePop(),
              child: Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: t.canvas.withValues(alpha: 0.7),
                  shape: BoxShape.circle,
                  border: Border.all(color: t.edgeSoft),
                ),
                child: Icon(Icons.close_rounded, size: 22, color: t.inkMuted),
              ),
            ),
          ),
        Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  tr.t("Who's watching?"),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: titleSize,
                    fontWeight: FontWeight.w500,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  state.profiles.isEmpty
                      ? tr.t('Create a profile to get started.')
                      : _manage
                      ? tr.t('Select a profile to edit.')
                      : tr.t('Pick a profile to continue.'),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: t.inkMuted, fontSize: 14),
                ),
                SizedBox(height: idiom.isTv ? 56 : 40),
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.start,
                  spacing: spacing,
                  runSpacing: runSpacing,
                  children: [
                    for (final p in state.profiles)
                      _ProfileTile(
                        profile: p,
                        tokens: t,
                        tr: tr,
                        size: avatarSize,
                        autofocus: p.id == active?.id,
                        manage: _manage && (canManage || p.id == active?.id),
                        onPressed: () {
                          if (_manage && (canManage || p.id == active?.id)) {
                            _openEditor(profile: p);
                          } else {
                            _select(p, active);
                          }
                        },
                      ),
                    // The primary profile can add others. When no primary
                    // exists yet — a fresh install (empty), or a legacy state
                    // with only non-primary profiles — the Add tile must still
                    // show, or there is no way to create a manageable profile.
                    if ((canManage || !_hasPrimary(state)) && !_manage)
                      _AddTile(
                        tokens: t,
                        tr: tr,
                        size: avatarSize,
                        onPressed: () => _openEditor(),
                      ),
                  ],
                ),
                SizedBox(height: idiom.isTv ? 52 : 40),
                // Everyone can manage (at least) their own profile; the primary
                // profile can also add and edit the others.
                if (active != null)
                  Focusable(
                    tokens: t,
                    scale: 1.0,
                    borderRadius: 999,
                    onPressed: () => setState(() => _manage = !_manage),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 22,
                        vertical: 11,
                      ),
                      decoration: BoxDecoration(
                        color: _manage ? t.ink : Colors.transparent,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: _manage ? t.ink : t.edgeSoft),
                      ),
                      child: Text(
                        _manage ? tr.t('Done') : tr.t('Manage profiles'),
                        style: TextStyle(
                          color: _manage ? t.canvas : t.inkMuted,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// A single profile tile: avatar with the profile's colour ring, name, a
/// primary/kid tag, a lock badge for PIN-protected profiles, and an edit
/// affordance while managing. Ported from `profile-tile.tsx`.
class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.profile,
    required this.tokens,
    required this.tr,
    required this.size,
    required this.autofocus,
    required this.manage,
    required this.onPressed,
  });

  final Profile profile;
  final HarborTokens tokens;
  final Translations tr;
  final double size;
  final bool autofocus;
  final bool manage;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final locked =
        profile.passwordHash != null && profile.passwordHash!.isNotEmpty;
    return Focusable(
      tokens: t,
      autofocus: autofocus,
      borderRadius: 20,
      onPressed: onPressed,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: SizedBox(
          width: size + 24,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  ProfileAvatar(profile: profile, tokens: t, size: size),
                  if (locked)
                    PositionedDirectional(
                      bottom: -2,
                      end: -2,
                      child: _badge(t, Icons.lock_rounded),
                    ),
                  if (manage)
                    PositionedDirectional(
                      top: -2,
                      end: -2,
                      child: _badge(t, Icons.edit_rounded),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                profile.name.isNotEmpty ? profile.name : tr.t('Profile'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: t.ink,
                  fontSize: size >= 120 ? 16 : (size >= 100 ? 14.5 : 13.5),
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (profile.isPrimary || profile.isKid) ...[
                const SizedBox(height: 3),
                Text(
                  profile.isKid ? tr.t('KID') : tr.t('Primary').toUpperCase(),
                  style: TextStyle(
                    color: profile.isKid ? t.inkMuted : t.accent,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.8,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _badge(HarborTokens t, IconData icon) => Container(
    width: 28,
    height: 28,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: t.canvas,
      shape: BoxShape.circle,
      border: Border.all(color: t.edge),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.35),
          blurRadius: 8,
          offset: const Offset(0, 2),
        ),
      ],
    ),
    child: Icon(icon, size: 13, color: t.ink),
  );
}

/// The dashed-circle "Add profile" tile — shown to the primary profile.
class _AddTile extends StatelessWidget {
  const _AddTile({
    required this.tokens,
    required this.tr,
    required this.size,
    required this.onPressed,
  });

  final HarborTokens tokens;
  final Translations tr;
  final double size;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 20,
      onPressed: onPressed,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: SizedBox(
          width: size + 24,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CustomPaint(
                painter: _DashedCirclePainter(color: t.edge),
                child: SizedBox(
                  width: size,
                  height: size,
                  child: Icon(
                    Icons.add_rounded,
                    size: size * 0.32,
                    color: t.inkSubtle,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                tr.t('Add profile'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: size >= 120 ? 16 : (size >= 100 ? 14.5 : 13.5),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedCirclePainter extends CustomPainter {
  const _DashedCirclePainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 1;
    const dash = 0.28; // radians drawn
    const gap = 0.16; // radians skipped
    var a = 0.0;
    while (a < math.pi * 2) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        a,
        dash,
        false,
        paint,
      );
      a += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_DashedCirclePainter old) => old.color != color;
}
