import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/simkl_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import 'settings_controls.dart';

/// The Simkl section — PIN connect and the connected state. Reads
/// [simklConnectedProvider]/[simklUsernameProvider]; connect drives
/// [simklConnectProvider]. Mirrors the web Simkl settings.
class SimklSection extends ConsumerStatefulWidget {
  const SimklSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  ConsumerState<SimklSection> createState() => _SimklSectionState();
}

class _SimklSectionState extends ConsumerState<SimklSection> {
  /// Web `confirmDisconnect`: the destructive Simkl teardown is gated behind a
  /// second confirming tap.
  bool _confirmDisconnect = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final connectState = ref.watch(simklConnectProvider);
    final connected = ref.watch(simklConnectedProvider);
    return SettingsSection(
      tokens: t,
      title: 'Simkl',
      subtitle: tr.t(
        'Connect Simkl to sync your watched history and watchlist across '
        'services.',
      ),
      children: [
        connected || connectState is SimklConnectDone
            ? _connected(ref, t)
            : _connect(ref, t, connectState),
      ],
    );
  }

  /// The per-rail granular toggles (web simkl-panel Movies/TV Shows/Anime
  /// groups). Each flips one nested key of `simklGranularFilters`.
  List<Widget> _granularToggles(
    WidgetRef ref,
    HarborTokens t,
    Translations tr,
    SettingsController settingsCtrl,
  ) {
    bool on(String group, String key) {
      final g = ref
          .watch(settingsProvider)
          .getMap('simklGranularFilters')[group];
      return g is Map && g[key] is bool ? g[key] as bool : true;
    }

    void toggle(String group, String key, bool val) {
      final m = Map<String, dynamic>.from(
        ref.read(settingsProvider).getMap('simklGranularFilters'),
      );
      final g = Map<String, dynamic>.from(
        (m[group] as Map?)?.cast<String, dynamic>() ?? const {},
      );
      g[key] = val;
      m[group] = g;
      settingsCtrl.setValue('simklGranularFilters', m);
    }

    Widget row(String label, String group, String key) => SettingToggleRow(
      tokens: t,
      label: tr.t(label),
      value: on(group, key),
      onChanged: (v) => toggle(group, key, v),
    );

    return [
      row('Watching TV Shows rail', 'shows', 'watching'),
      row('Watching Anime rail', 'anime', 'watching'),
      row('Plan to Watch Movies rail', 'movies', 'plantowatch'),
      row('Plan to Watch TV Shows rail', 'shows', 'plantowatch'),
      row('Plan to Watch Anime rail', 'anime', 'plantowatch'),
    ];
  }

  Widget _connected(WidgetRef ref, HarborTokens t) {
    final tr = ref.watch(translationsProvider);
    final username = ref.watch(simklUsernameProvider);
    final avatar = ref.watch(simklAvatarProvider).asData?.value;
    final settingsCtrl = ref.read(settingsProvider.notifier);
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
              if (avatar != null && avatar.isNotEmpty)
                ClipOval(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CachedNetworkImage(
                      imageUrl: avatar,
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
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: t.edge),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.link_off, color: t.inkMuted, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          tr.t('Disconnect from Simkl'),
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (_confirmDisconnect) ...[
          const SizedBox(height: 10),
          _confirmDisconnectPanel(t, tr),
        ],
        if (avatar != null && avatar.isNotEmpty)
          SettingToggleRow(
            tokens: t,
            label: tr.t('Use my Simkl avatar as my Harbor avatar'),
            sub: tr.t('Show your Simkl profile picture as your Harbor avatar.'),
            value: ref.watch(settingsProvider).getBool('useSimklAvatar'),
            onChanged: (v) => settingsCtrl.setValue('useSimklAvatar', v),
          ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show Simkl rails on Home'),
          sub: tr.t(
            'Display your Watching, Plan to Watch, and Trending rows on the '
            'home screen.',
          ),
          value: ref.watch(settingsProvider).getBool('simklHomeRailsEnabled'),
          onChanged: (v) => settingsCtrl.setValue('simklHomeRailsEnabled', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show Simkl Trending Today rail'),
          sub: tr.t(
            "Display today's trending movies, TV shows, and anime from Simkl.",
          ),
          value: ref
              .watch(settingsProvider)
              .getBool('simklTrendingRailEnabled'),
          onChanged: (v) =>
              settingsCtrl.setValue('simklTrendingRailEnabled', v),
        ),
        // Per-rail granular toggles (web simkl-panel), shown only while the Home
        // rails master is on — each gates one of the list rails.
        if (ref.watch(settingsProvider).getBool('simklHomeRailsEnabled'))
          ..._granularToggles(ref, t, tr, settingsCtrl),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Scrobble to SIMKL'),
          sub: tr.t(
            'Update your Simkl watch progress automatically as you play.',
          ),
          value: ref.watch(settingsProvider).getBool('simklScrobbleEnabled'),
          onChanged: (v) => settingsCtrl.setValue('simklScrobbleEnabled', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Display SIMKL Community Ratings'),
          sub: tr.t('Show Simkl community rating on movie and show pages.'),
          value: ref
              .watch(settingsProvider)
              .getBool('simklShowCommunityRatings'),
          onChanged: (v) =>
              settingsCtrl.setValue('simklShowCommunityRatings', v),
        ),
      ],
    );
  }

  /// The destructive-action guard (web simkl-panel `confirmDisconnect`): a
  /// warning with Cancel / Disconnect. Only the confirm button tears down.
  Widget _confirmDisconnectPanel(HarborTokens t, Translations tr) => Container(
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
              'Disconnect Simkl? Your history and watchlist will stop syncing '
              'until you reconnect.',
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
            ref.read(simklConnectProvider.notifier).disconnect();
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

  Widget _connect(WidgetRef ref, HarborTokens t, SimklConnectState state) {
    final tr = ref.watch(translationsProvider);
    return switch (state) {
      SimklConnectStarting() => _box(t, const Center(child: _Spinner())),
      SimklConnectPending(:final userCode, :final verificationUrl) => _box(
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
                  () => ref.read(simklConnectProvider.notifier).cancel(),
                ),
              ],
            ),
          ],
        ),
      ),
      SimklConnectError(:final message) => _box(
        t,
        Row(
          children: [
            Expanded(child: _muted(t, message)),
            _textButton(
              t,
              tr.t('Try again'),
              () => ref.read(simklConnectProvider.notifier).start(),
            ),
          ],
        ),
      ),
      // Idle or Done (disconnected): offer the connect button.
      _ => Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 12,
        onPressed: () => ref.read(simklConnectProvider.notifier).start(),
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
                tr.t('Connect Simkl'),
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
