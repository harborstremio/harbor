import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/profiles/avatar_catalog.dart';
import '../../domain/profiles/kid_config.dart';
import '../../domain/profiles/profile_password.dart';
import 'pin_entry.dart';

/// The daily watch-time options, ported 1:1 from the web `CURFEWS`.
const List<({String label, int? v})> kCurfews = [
  (label: 'No limit', v: null),
  (label: '30 min', v: 30),
  (label: '1 hour', v: 60),
  (label: '1½ hr', v: 90),
  (label: '2 hr', v: 120),
  (label: '3 hr', v: 180),
];

/// The kid age levels, ported 1:1 from the web `AGES`.
const List<int> kKidAges = [3, 5, 7, 9, 12];

/// The kid-profile setup card, ported from `kids-setup-panel.tsx`: the
/// ocean-gradient space where a parent sets the age ceiling, the daily
/// watch-time curfew, and the parent PIN that lifts Time's Up and leaves the
/// kids space. Editing the [KidConfig] flows back through [onChange]; picking a
/// built-in kid avatar flows through [onAvatarChange] (web `KID_AVATARS`).
class KidsSetupPanel extends StatelessWidget {
  const KidsSetupPanel({
    super.key,
    required this.tokens,
    required this.tr,
    required this.kid,
    required this.onChange,
    this.avatar,
    this.onAvatarChange,
  });

  final HarborTokens tokens;
  final Translations tr;
  final KidConfig kid;
  final ValueChanged<KidConfig> onChange;

  /// The profile's current avatar value + a setter, so the kids panel can offer
  /// the 5 built-in kid avatars (web `KID_AVATARS`). Null hides the avatar row.
  final String? avatar;
  final ValueChanged<String>? onAvatarChange;

  static const _teal1 = Color(0xFF2F9EC0);
  static const _teal2 = Color(0xFF1C789F);
  static const _teal3 = Color(0xFF0C4A6E);

  Future<void> _setParentPin(BuildContext context) async {
    final pin = await showPinDialog(
      context,
      tokens: tokens,
      title: tr.t('Set the parent PIN'),
      subtitle: tr.t("Used to lift Time's Up and to leave the kids space."),
      mode: PinMode.set,
    );
    if (pin != null) {
      onChange(kid.copyWith(parentPinHash: hashProfilePassword(pin)));
    }
  }

  Future<void> _changeParentPin(BuildContext context) async {
    final current = kid.parentPinHash;
    if (current == null) return;
    final ok = await showPinDialog(
      context,
      tokens: tokens,
      title: tr.t('Enter current PIN'),
      subtitle: tr.t('Confirm your current PIN, then pick a new one.'),
      mode: PinMode.verify,
      verify: (pin) => verifyProfilePassword(pin, current),
    );
    if (ok != null && context.mounted) await _setParentPin(context);
  }

  Future<void> _removeParentPin(BuildContext context) async {
    final current = kid.parentPinHash;
    if (current == null) return;
    final ok = await showPinDialog(
      context,
      tokens: tokens,
      title: tr.t('Enter current PIN'),
      subtitle: tr.t('Confirm your current PIN to remove the lock.'),
      mode: PinMode.verify,
      verify: (pin) => verifyProfilePassword(pin, current),
    );
    if (ok != null) onChange(kid.copyWith(parentPinHash: null));
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_teal1, _teal2, _teal3],
        ),
        border: Border.all(
          color: const Color(0xFF6BC5CA).withValues(alpha: 0.5),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Stack(
          children: [
            PositionedDirectional(
              end: 14,
              top: 22,
              child: Opacity(
                opacity: 0.8,
                child: Image.asset(
                  'assets/kids/doodles/lilpurpocto.png',
                  height: 50,
                ),
              ),
            ),
            PositionedDirectional(
              end: 10,
              bottom: 8,
              child: Opacity(
                opacity: 0.9,
                child: Image.asset(
                  'assets/kids/doodles/lilwhitestar2.png',
                  height: 42,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (onAvatarChange != null) ...[
                    _section(
                      tr.t('Pick an avatar'),
                      _avatarRow(),
                      caption: tr.t('A friendly face for the kids space.'),
                    ),
                    const SizedBox(height: 18),
                  ],
                  _section(
                    tr.t('Age level'),
                    Row(
                      children: [
                        for (final a in kKidAges) ...[
                          Expanded(
                            child: _pill(
                              '$a',
                              kid.age == a,
                              () => onChange(kid.copyWith(age: a)),
                            ),
                          ),
                          if (a != kKidAges.last) const SizedBox(width: 8),
                        ],
                      ],
                    ),
                    caption: tr.t('Shows titles suitable up to age {age}.', {
                      'age': kid.age,
                    }),
                  ),
                  const SizedBox(height: 18),
                  _section(
                    tr.t('Daily watch time'),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final c in kCurfews)
                          _pill(
                            tr.t(c.label),
                            kid.curfewMinutes == c.v,
                            () => onChange(kid.copyWith(curfewMinutes: c.v)),
                            wide: true,
                          ),
                      ],
                    ),
                    caption: tr.t(
                      "When time's up, the ship sails away until a parent "
                      'unlocks it.',
                    ),
                  ),
                  const SizedBox(height: 18),
                  _section(
                    tr.t('Parent PIN'),
                    _parentPinControl(context),
                    caption: tr.t(
                      "Used to lift Time's Up and to leave the kids space.",
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _parentPinControl(BuildContext context) {
    final set = kid.parentPinHash != null;
    if (!set) {
      return _actionPill(tr.t('Set parent PIN'), () => _setParentPin(context));
    }
    return Row(
      children: [
        const Icon(Icons.check_rounded, size: 16, color: Colors.white),
        const SizedBox(width: 6),
        Text(
          tr.t('PIN set'),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        const Spacer(),
        _actionPill(tr.t('Change'), () => _changeParentPin(context)),
        const SizedBox(width: 8),
        _actionPill(tr.t('Remove'), () => _removeParentPin(context)),
      ],
    );
  }

  /// The 5 built-in kid avatars as round, remote-navigable tiles on the teal
  /// card — white ring + check badge on the selected one (web `KID_AVATARS`).
  Widget _avatarRow() {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        for (final v in kKidAvatarValues)
          Focusable(
            borderRadius: 999,
            onPressed: () => onAvatarChange?.call(v),
            child: SizedBox(
              width: 60,
              height: 60,
              child: Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.2),
                      border: Border.all(
                        color: avatar == v
                            ? Colors.white
                            : Colors.white.withValues(alpha: 0.4),
                        width: avatar == v ? 4 : 2,
                      ),
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        avatarAssetForStored(v) ?? '',
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox.shrink(),
                      ),
                    ),
                  ),
                  if (avatar == v)
                    PositionedDirectional(
                      end: -2,
                      bottom: -2,
                      child: Container(
                        width: 22,
                        height: 22,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                        ),
                        child: const Icon(
                          Icons.check_rounded,
                          size: 14,
                          color: _teal3,
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

  Widget _section(String label, Widget child, {required String caption}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(height: 8),
        child,
        const SizedBox(height: 6),
        Text(
          caption,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.75),
            fontSize: 11,
          ),
        ),
      ],
    );
  }

  Widget _pill(
    String label,
    bool on,
    VoidCallback onPressed, {
    bool wide = false,
  }) {
    return Focusable(
      tokens: tokens,
      borderRadius: 12,
      onPressed: onPressed,
      child: Container(
        height: 40,
        alignment: Alignment.center,
        padding: wide ? const EdgeInsets.symmetric(horizontal: 16) : null,
        decoration: BoxDecoration(
          color: on ? Colors.white : Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: on ? _teal3 : Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  Widget _actionPill(String label, VoidCallback onPressed) {
    return Focusable(
      tokens: tokens,
      scale: 1.0,
      borderRadius: 999,
      onPressed: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
