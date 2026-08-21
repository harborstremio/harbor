import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/anilist_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/anilist/anilist_types.dart';
import '../../domain/companion/companion_link.dart';
import '../../domain/i18n/translations.dart';
import '../companion/companion_sheet.dart';
import 'settings_controls.dart';
import '../../design/focus/tv_text_field.dart';

/// The AniList section — PIN authorization (open the authorize page, paste the
/// returned code) and the connected state. Reads [anilistConnectProvider].
/// Mirrors the web AniList settings.
class AnilistSection extends ConsumerStatefulWidget {
  const AnilistSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  ConsumerState<AnilistSection> createState() => _AnilistSectionState();
}

class _AnilistSectionState extends ConsumerState<AnilistSection> {
  final _codeController = TextEditingController();

  /// Web `confirmDisconnect`: the destructive AniList teardown is gated behind a
  /// second confirming tap.
  bool _confirmDisconnect = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _openAuthorize(AnilistConnectController ctrl) async {
    final uri = Uri.tryParse(ctrl.authorizeUrl());
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    ctrl.awaitCode();
  }

  /// TV: send the authorization code back from the phone instead of typing it.
  Future<void> _codeOnPhone(AnilistConnectController ctrl) async {
    final code = await enterOnPhone(
      context,
      ref,
      label: 'AniList code',
      kind: CompanionKind.text,
    );
    if (code != null && code.isNotEmpty && mounted) {
      _codeController.text = code;
      ctrl.submitCode(code);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final state = ref.watch(anilistConnectProvider);
    final ctrl = ref.read(anilistConnectProvider.notifier);
    return SettingsSection(
      tokens: t,
      title: 'AniList',
      subtitle: tr.t('Connect AniList to sync your anime watch progress.'),
      children: [
        switch (state) {
          AnilistConnectDone(:final session) => _connected(t, ctrl, session),
          AnilistConnectIdle() => _connectButton(t, ctrl),
          _ => _pasteForm(t, ctrl, state),
        },
      ],
    );
  }

  Widget _connected(
    HarborTokens t,
    AnilistConnectController ctrl,
    AnilistSession session,
  ) {
    final tr = ref.watch(translationsProvider);
    final name = session.userName;
    final avatar = session.avatar;
    final ctrlSettings = ref.read(settingsProvider.notifier);
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
                  name.isNotEmpty
                      ? tr.t('Connected as {name}', {'name': name})
                      : tr.t('Connected'),
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
                          tr.t('Disconnect from AniList'),
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
          _confirmDisconnectPanel(t, tr, ctrl),
        ],
        const SizedBox(height: 8),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Sync watch progress'),
          sub: tr.t(
            'Finishing an anime episode updates your AniList progress. '
            'Forward only: it never lowers a count you already have.',
          ),
          value: ref.watch(settingsProvider).getBool('anilistAutoSync'),
          onChanged: (v) => ctrlSettings.setValue('anilistAutoSync', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Use my AniList avatar as my Harbor avatar'),
          sub: tr.t('Show your AniList profile picture as your Harbor avatar.'),
          value: ref.watch(settingsProvider).getBool('useAnilistAvatar'),
          onChanged: (v) => ctrlSettings.setValue('useAnilistAvatar', v),
        ),
        SettingToggleRow(
          tokens: t,
          label: tr.t('Show AniList comments'),
          sub: tr.t(
            'Show AniList forum threads and comments on anime detail pages.',
          ),
          value: ref.watch(settingsProvider).getBool('showAnilistComments'),
          onChanged: (v) => ctrlSettings.setValue('showAnilistComments', v),
        ),
        if (ref.watch(settingsProvider).getBool('showAnilistComments'))
          SettingToggleRow(
            tokens: t,
            label: tr.t('Blur comments by default'),
            sub: tr.t('Comments are blurred until you reveal them.'),
            value: ref.watch(settingsProvider).getBool('anilistBlurComments'),
            onChanged: (v) => ctrlSettings.setValue('anilistBlurComments', v),
          ),
      ],
    );
  }

  /// The destructive-action guard (web anilist-panel `confirmDisconnect`): a
  /// warning with Cancel / Disconnect. Only the confirm button tears down.
  Widget _confirmDisconnectPanel(
    HarborTokens t,
    Translations tr,
    AnilistConnectController ctrl,
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
              'Disconnect AniList? Your lists will stop showing on the Anime '
              'page until you reconnect.',
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
            ctrl.disconnect();
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

  Widget _connectButton(HarborTokens t, AnilistConnectController ctrl) =>
      Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 12,
        onPressed: () => _openAuthorize(ctrl),
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
                ref.watch(translationsProvider).t('Connect AniList'),
                style: TextStyle(
                  color: t.accent,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );

  Widget _pasteForm(
    HarborTokens t,
    AnilistConnectController ctrl,
    AnilistConnectState state,
  ) {
    final tr = ref.watch(translationsProvider);
    final submitting = state is AnilistConnectSubmitting;
    return _box(
      t,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr.t(
              'Authorize Harbor in the AniList page that opened, then paste the '
              'code shown there below.',
            ),
            style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
          ),
          // On a TV, authorizing in a browser and typing the code on the remote
          // is painful — scan to authorize on the phone, then send the code back
          // with the phone button.
          if (Idiom.of(context).isTv) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: QrImageView(
                    data: ctrl.authorizeUrl(),
                    size: 96,
                    backgroundColor: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    tr.t(
                      'Scan to authorize on your phone, then send the code back '
                      'with the phone button.',
                    ),
                    style: TextStyle(
                      color: t.inkSubtle,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: t.canvas.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: t.edgeSoft),
                  ),
                  child: Center(
                    child: TvTextField(
                      controller: _codeController,
                      enabled: !submitting,
                      style: TextStyle(color: t.ink, fontSize: 14),
                      cursorColor: t.accent,
                      decoration: InputDecoration(
                        isCollapsed: true,
                        border: InputBorder.none,
                        hintText: tr.t('Paste the AniList code'),
                        hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
                      ),
                      onSubmitted: (v) => ctrl.submitCode(v),
                    ),
                  ),
                ),
              ),
              if (Idiom.of(context).isTv) ...[
                const SizedBox(width: 8),
                Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 10,
                  onPressed: () => _codeOnPhone(ctrl),
                  child: Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: t.raised,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: t.edgeSoft),
                    ),
                    child: Icon(Icons.smartphone, size: 18, color: t.inkMuted),
                  ),
                ),
              ],
            ],
          ),
          if (state is AnilistConnectError) ...[
            const SizedBox(height: 10),
            Text(
              state.message,
              style: TextStyle(color: t.danger, fontSize: 12.5, height: 1.4),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Focusable(
                tokens: t,
                scale: 1.0,
                borderRadius: 999,
                onPressed: submitting
                    ? () {}
                    : () => ctrl.submitCode(_codeController.text),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    color: t.accentSoft,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: t.accent),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (submitting) ...[
                        const _Spinner(),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        submitting ? tr.t('Connecting…') : tr.t('Connect'),
                        style: TextStyle(
                          color: t.accent,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              _textButton(t, tr.t('Cancel'), ctrl.cancel),
            ],
          ),
        ],
      ),
    );
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
    width: 14,
    height: 14,
    child: CircularProgressIndicator(strokeWidth: 2),
  );
}
