import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../app/i18n_providers.dart';
import '../../app/profiles_providers.dart';
import '../../app/providers.dart';
import '../../app/trakt_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import 'settings_controls.dart';

/// The Trakt section — device-code connect and the connected state. Reads
/// [traktConnectedProvider]/[traktUsernameProvider]; connect drives
/// [traktConnectProvider]. Mirrors the web Trakt settings.
class TraktSection extends ConsumerStatefulWidget {
  const TraktSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  ConsumerState<TraktSection> createState() => _TraktSectionState();
}

class _TraktSectionState extends ConsumerState<TraktSection> {
  /// Web `confirmDisconnect`: the destructive Trakt teardown is gated behind a
  /// second confirming tap.
  bool _confirmDisconnect = false;

  /// The mount-time reconcile runs at most once. It must NOT re-fire on every
  /// rebuild: another identity effect (e.g. AnilistAvatarSync) can change
  /// harborAvatar, rebuilding this section — a build-time re-push would then
  /// ping-pong with that effect when both avatar toggles are on.
  bool _didInitialReconcile = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final connectState = ref.watch(traktConnectProvider);
    final connected = ref.watch(traktConnectedProvider);
    final settings = ref.watch(settingsProvider);
    final ctrl = ref.read(settingsProvider.notifier);
    final showComments = settings.getBool('showTraktComments');
    final traktAvatar = ref.watch(traktAvatarProvider).asData?.value;

    // Auto-push reconciler (web trakt-panel useEffect): mirror the Trakt avatar
    // into the identity while "use my Trakt avatar" is on. `ref.listen` covers
    // the avatar arriving/changing after the panel is open; the one-time
    // post-frame covers it already being cached when the panel mounts.
    ref.listen(traktAvatarProvider, (_, next) {
      _reconcileTraktAvatar(ref, next.asData?.value);
    });
    if (!_didInitialReconcile && traktAvatar != null) {
      _didInitialReconcile = true;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _reconcileTraktAvatar(ref, traktAvatar),
      );
    }

    return SettingsSection(
      tokens: t,
      title: 'Trakt',
      subtitle: tr.t(
        'Connect Trakt to scrobble playback and sync your watchlist and '
        'watched history.',
      ),
      children: [
        connected || connectState is TraktConnectDone
            ? _connected(ref, t, traktAvatar)
            : _connect(ref, t, connectState),
        if ((connected || connectState is TraktConnectDone) &&
            traktAvatar != null)
          SettingToggleRow(
            tokens: t,
            label: tr.t('Use my Trakt avatar as my Harbor avatar'),
            sub: tr.t(
              'Wear your Trakt profile picture across Harbor instead of the '
              'default.',
            ),
            value: settings.getBool('useTraktAvatar'),
            onChanged: (v) => _toggleTraktAvatar(ref, v, traktAvatar),
          ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show comments on detail pages'),
          sub: tr.t(
            'Turn on to show the Trakt comments section on movies, shows, '
            'and episodes.',
          ),
          value: showComments,
          onChanged: (v) => ctrl.setValue('showTraktComments', v),
        ),
        if (showComments)
          SettingToggleRow(
            tokens: t,
            label: tr.t('Blur comments by default'),
            sub: tr.t(
              'Comments are blurred until you reveal them, even if they are '
              'not tagged as spoilers.',
            ),
            value: settings.getBool('blurComments'),
            onChanged: (v) => ctrl.setValue('blurComments', v),
          ),
      ],
    );
  }

  /// Idempotent auto-push: mirror [url] into the identity when the toggle is on
  /// and it isn't already the current avatar (web's `harborAvatar !== traktAvatar`
  /// guard). Reads fresh settings so a deferred callback can't act on stale state.
  Future<void> _reconcileTraktAvatar(WidgetRef ref, String? url) async {
    if (url == null) return;
    final s = ref.read(settingsProvider);
    if (s.getBool('useTraktAvatar') && s['harborAvatar'] != url) {
      await _pushAvatar(ref, url);
    }
  }

  /// Writes an avatar url (or null to clear) to BOTH the global identity mirror
  /// (`harborAvatar`) and the active profile — web trakt-panel `pushAvatar`.
  Future<void> _pushAvatar(WidgetRef ref, String? url) async {
    await ref.read(settingsProvider.notifier).setValue('harborAvatar', url);
    final active = ref.read(activeProfileProvider);
    if (active != null) {
      await ref
          .read(profilesProvider.notifier)
          .updateProfile(active.id, (p) => p.copyWith(avatar: url));
    }
  }

  /// Web `toggleTraktAvatar`: turning it on adopts the Trakt picture; turning it
  /// off clears the avatar only if it is still the Trakt one. Writes are awaited
  /// in sequence — `setValue` reads state before its async persist, so two
  /// un-awaited settings writes would race and the later one clobber the first.
  Future<void> _toggleTraktAvatar(
    WidgetRef ref,
    bool on,
    String? traktAvatar,
  ) async {
    final ctrl = ref.read(settingsProvider.notifier);
    if (on) {
      if (traktAvatar != null) await _pushAvatar(ref, traktAvatar);
      await ctrl.setValue('useTraktAvatar', true);
    } else {
      await ctrl.setValue('useTraktAvatar', false);
      if (ref.read(settingsProvider)['harborAvatar'] == traktAvatar) {
        await _pushAvatar(ref, null);
      }
    }
  }

  /// Web disconnect: drop the Trakt avatar if it is the one on show, force the
  /// toggle off, then tear down the session.
  Future<void> _disconnect(WidgetRef ref, String? traktAvatar) async {
    final s = ref.read(settingsProvider);
    if (s.getBool('useTraktAvatar') && s['harborAvatar'] == traktAvatar) {
      await _pushAvatar(ref, null);
    }
    await ref.read(settingsProvider.notifier).setValue('useTraktAvatar', false);
    ref.read(traktConnectProvider.notifier).disconnect();
  }

  Widget _connected(WidgetRef ref, HarborTokens t, String? traktAvatar) {
    final tr = ref.watch(translationsProvider);
    final username = ref.watch(traktUsernameProvider);
    final who = (username != null && username.isNotEmpty)
        ? tr.t('Connected as {name}', {'name': username})
        : tr.t('Connected');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _box(
          t,
          Row(
            children: [
              if (traktAvatar != null)
                ClipOval(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CachedNetworkImage(
                      imageUrl: traktAvatar,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) =>
                          Icon(Icons.check_circle, color: t.success, size: 20),
                    ),
                  ),
                )
              else
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
              if (!_confirmDisconnect)
                Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 999,
                  onPressed: () => setState(() => _confirmDisconnect = true),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: t.edge),
                    ),
                    child: Text(
                      tr.t('Disconnect'),
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
        ),
        if (_confirmDisconnect) ...[
          const SizedBox(height: 10),
          _confirmDisconnectPanel(ref, t, tr, traktAvatar),
        ],
      ],
    );
  }

  /// The destructive-action guard (web trakt-panel `confirmDisconnect` panel):
  /// a warning with Cancel / Disconnect. Only the confirm button tears down.
  Widget _confirmDisconnectPanel(
    WidgetRef ref,
    HarborTokens t,
    Translations tr,
    String? traktAvatar,
  ) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: t.danger.withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: t.danger.withValues(alpha: 0.3)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(
            tr.t(
              'Disconnect Trakt? Scrobbles and syncs will stop until you '
              'reconnect.',
            ),
            style: TextStyle(color: t.danger, fontSize: 12.5, height: 1.35),
          ),
        ),
        const SizedBox(width: 10),
        _textButton(
          t,
          tr.t('Cancel'),
          () => setState(() => _confirmDisconnect = false),
        ),
        const SizedBox(width: 6),
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 8,
          onPressed: () {
            _disconnect(ref, traktAvatar);
            setState(() => _confirmDisconnect = false);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: t.danger.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              tr.t('Disconnect'),
              style: TextStyle(
                color: t.danger,
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _connect(WidgetRef ref, HarborTokens t, TraktConnectState state) {
    final tr = ref.watch(translationsProvider);
    return switch (state) {
      TraktConnectStarting() => _box(t, const Center(child: _Spinner())),
      TraktConnectPending(:final userCode, :final verificationUrl) => _box(
        t,
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tr.t(
                          'Scan to open {url} on your phone, then enter this '
                          'code:',
                          {'url': verificationUrl},
                        ),
                        style: TextStyle(
                          color: t.inkMuted,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        userCode,
                        style: TextStyle(
                          color: t.accent,
                          fontSize: 30,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: QrImageView(
                    data: verificationUrl,
                    size: 108,
                    backgroundColor: Colors.white,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const _Spinner(),
                const SizedBox(width: 10),
                Text(
                  tr.t('Waiting for authorization…'),
                  style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                ),
                const Spacer(),
                _textButton(
                  t,
                  tr.t('Cancel'),
                  () => ref.read(traktConnectProvider.notifier).cancel(),
                ),
              ],
            ),
          ],
        ),
      ),
      TraktConnectError(:final message) => _box(
        t,
        Row(
          children: [
            Expanded(child: _muted(t, message)),
            _textButton(
              t,
              tr.t('Try again'),
              () => ref.read(traktConnectProvider.notifier).start(),
            ),
          ],
        ),
      ),
      // Idle or Done (disconnected): offer the connect button.
      _ => Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 12,
        onPressed: () => ref.read(traktConnectProvider.notifier).start(),
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
              Icon(Icons.link, color: t.accent, size: 18),
              const SizedBox(width: 10),
              Text(
                tr.t('Connect Trakt'),
                style: TextStyle(
                  color: t.accent,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
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
