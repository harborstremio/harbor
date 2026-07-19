import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/parental_providers.dart';
import '../../app/profiles_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/profiles/parental.dart';
import '../shell/parental_pin_dialog.dart';
import 'settings_controls.dart';

/// The "Parental controls" settings section: set or remove a PIN for the active
/// profile and choose which sidebar tabs it protects. Ported from the web
/// profile-editor PIN & sidebar-locks controls.
class ParentalSection extends ConsumerWidget {
  const ParentalSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final tr = ref.watch(translationsProvider);
    final parental = ref.watch(parentalProvider);
    final profile = ref.watch(activeProfileProvider);

    if (profile == null) {
      return SettingsSection(
        tokens: t,
        title: tr.t('Parental controls'),
        children: [
          Text(
            tr.t('Create or select a profile to set up parental controls.'),
            style: TextStyle(color: t.inkMuted, fontSize: 13.5),
          ),
        ],
      );
    }

    final lockedCount = parental.lockedTabs.length;
    return SettingsSection(
      tokens: t,
      title: tr.t('Parental controls'),
      subtitle: tr.t(
        'Set a PIN and choose which sidebar tabs it protects for {name}.',
        {'name': profile.name},
      ),
      children: [
        _pinRow(context, ref, t, parental.hasPin),
        const SizedBox(height: 18),
        Text(
          lockedCount == 0
              ? tr.t('LOCKED TABS · none')
              : tr.t('LOCKED TABS · {n}', {'n': lockedCount}),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.6,
          ),
        ),
        const SizedBox(height: 4),
        if (!parental.hasPin)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              tr.t('Set a PIN above to enforce these locks.'),
              style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
            ),
          ),
        for (final tab in kLockableTabs)
          SettingToggleRow(
            tokens: t,
            label: tr.t(tab.label),
            value: isTabLocked(parental.lockedTabs, tab.key),
            onChanged: (v) =>
                ref.read(parentalProvider.notifier).setTabHidden(tab.key, v),
          ),
      ],
    );
  }

  Widget _pinRow(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
    bool hasPin,
  ) {
    final tr = ref.watch(translationsProvider);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          Icon(
            hasPin ? Icons.lock_rounded : Icons.lock_open_rounded,
            size: 20,
            color: hasPin ? t.accent : t.inkMuted,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr.t('PIN'),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  hasPin ? tr.t('A PIN is set.') : tr.t('No PIN set.'),
                  style: TextStyle(color: t.inkMuted, fontSize: 12.5),
                ),
              ],
            ),
          ),
          if (hasPin) ...[
            _pill(t, tr.t('Change'), () => _changePin(context, ref, t)),
            const SizedBox(width: 8),
            _pill(
              t,
              tr.t('Remove'),
              () => _removePin(context, ref, t),
              danger: true,
            ),
          ] else
            _pill(
              t,
              tr.t('Set PIN'),
              () => _setPin(context, ref, t),
              primary: true,
            ),
        ],
      ),
    );
  }

  Widget _pill(
    HarborTokens t,
    String label,
    VoidCallback onTap, {
    bool primary = false,
    bool danger = false,
  }) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: primary ? t.accent : t.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: primary ? t.accent : t.edgeSoft),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: primary ? t.canvas : (danger ? t.danger : t.inkMuted),
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );

  Future<void> _setPin(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
  ) async {
    final pin = await showDialog<String>(
      context: context,
      builder: (_) =>
          SetPinDialog(tokens: t, tr: ref.read(translationsProvider)),
    );
    if (pin != null && pin.isNotEmpty) {
      await ref.read(parentalProvider.notifier).setPin(pin);
    }
  }

  Future<void> _changePin(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => ParentalPinDialog(
        tokens: t,
        tr: ref.read(translationsProvider),
        title: 'Enter current PIN',
        subtitle: 'Confirm your current PIN, then pick a new one.',
        verify: (pin) => ref.read(parentalProvider.notifier).unlock(pin),
      ),
    );
    if (ok == true && context.mounted) await _setPin(context, ref, t);
  }

  Future<void> _removePin(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => ParentalPinDialog(
        tokens: t,
        tr: ref.read(translationsProvider),
        title: 'Enter current PIN',
        subtitle: 'Confirm your current PIN to remove the lock.',
        verify: (pin) => ref.read(parentalProvider.notifier).unlock(pin),
      ),
    );
    if (ok == true) await ref.read(parentalProvider.notifier).clearPin();
  }
}
