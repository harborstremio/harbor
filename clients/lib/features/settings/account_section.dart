import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/stremio_auth.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/auth/auth_repository.dart';
import 'settings_controls.dart';

/// The Account section — Stremio device-code sign-in and the signed-in state.
/// Reads [stremioSessionProvider]; sign-in drives [stremioLinkProvider].
class AccountSection extends ConsumerWidget {
  const AccountSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final tr = ref.watch(translationsProvider);
    final session = ref.watch(stremioSessionProvider);
    return SettingsSection(
      tokens: t,
      title: tr.t('Account'),
      subtitle: tr.t(
        'Sign in to Stremio to sync your library and add-ons across devices.',
      ),
      children: [
        session.when(
          loading: () => _box(t, const Center(child: _Spinner())),
          error: (e, _) =>
              _box(t, _muted(t, tr.t('Could not load your account.'))),
          data: (s) => s == null ? _signIn(ref, t) : _signedIn(ref, t, s),
        ),
      ],
    );
  }

  Widget _signedIn(WidgetRef ref, HarborTokens t, AuthSession s) {
    final tr = ref.watch(translationsProvider);
    final who = s.user.email.isNotEmpty ? s.user.email : tr.t('Signed in');
    return _box(
      t,
      Row(
        children: [
          Icon(Icons.check_circle, color: t.success, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              who,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.ink,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Focusable(
            tokens: t,
            scale: 1.0,
            borderRadius: 999,
            onPressed: () =>
                ref.read(stremioSessionProvider.notifier).signOut(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: t.edge),
              ),
              child: Text(
                tr.t('Sign out'),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _signIn(WidgetRef ref, HarborTokens t) {
    final tr = ref.watch(translationsProvider);
    final link = ref.watch(stremioLinkProvider);
    return switch (link) {
      LinkStarting() => _box(t, const Center(child: _Spinner())),
      LinkPending(:final code, :final link) => _box(
        t,
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              link == null
                  ? tr.t('On your phone, open Stremio and enter this code:')
                  : tr.t('On your phone, open {link} and enter this code:', {
                      'link': link,
                    }),
              style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 12),
            Text(
              code,
              style: TextStyle(
                color: t.accent,
                fontSize: 30,
                fontWeight: FontWeight.w700,
                letterSpacing: 4,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const _Spinner(),
                const SizedBox(width: 10),
                Text(
                  tr.t('Waiting for confirmation…'),
                  style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                ),
                const Spacer(),
                _textButton(
                  t,
                  tr.t('Cancel'),
                  () => ref.read(stremioLinkProvider.notifier).cancel(),
                ),
              ],
            ),
          ],
        ),
      ),
      LinkError(:final message) => _box(
        t,
        Row(
          children: [
            Expanded(child: _muted(t, message)),
            _textButton(
              t,
              tr.t('Try again'),
              () => ref.read(stremioLinkProvider.notifier).start(),
            ),
          ],
        ),
      ),
      // Idle or Done (session pending): offer the sign-in button.
      _ => Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 12,
        onPressed: () => ref.read(stremioLinkProvider.notifier).start(),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          decoration: BoxDecoration(
            color: t.accentSoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.accent),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.login, color: t.accent, size: 18),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  tr.t('Sign in with Stremio'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.accent,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    };
  }

  Widget _box(HarborTokens t, Widget child) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: t.edgeSoft),
    ),
    child: child,
  );

  Widget _muted(HarborTokens t, String s) =>
      Text(s, style: TextStyle(color: t.inkMuted, fontSize: 13));

  Widget _textButton(HarborTokens t, String label, VoidCallback onTap) =>
      Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 8,
        onPressed: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Text(
            label,
            style: TextStyle(
              color: t.accent,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      );
}

class _Spinner extends StatelessWidget {
  const _Spinner();
  @override
  Widget build(BuildContext context) => const SizedBox(
    width: 16,
    height: 16,
    child: CircularProgressIndicator(strokeWidth: 2),
  );
}
