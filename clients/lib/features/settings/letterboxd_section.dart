import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/stremboxd_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/text_field_escape.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/stremboxd/stremboxd_client.dart';
import 'settings_controls.dart';
import '../../design/focus/tv_text_field.dart';

/// The Letterboxd catalogs the panel offers. The `fullOnly` catalogs (diary,
/// friends, recommended) need a full-mode sign-in and stay locked otherwise.
/// Ported 1:1 from the web letterboxd-panel `CATALOG_OPTIONS`.
const _catalogOptions = <(String id, String label, bool fullOnly)>[
  ('letterboxd-watchlist', 'Watchlist', false),
  ('letterboxd-diary', 'Diary', true),
  ('letterboxd-liked', 'Liked Films', false),
  ('letterboxd-friends', 'Friends', true),
  ('letterboxd-recommended', 'Recommended for You', true),
  ('letterboxd-popular', 'Popular This Week', false),
  ('letterboxd-top250', 'Top 250', false),
];

/// The Letterboxd (Stremboxd) settings panel — a 1:1 port of the web
/// letterboxd-panel: public/full mode, username, password sign-in, the catalog
/// grid (with full-only locking), custom-list import, on-poster ratings, blur
/// reviews, and hidden-catalog restore.
class LetterboxdSection extends ConsumerStatefulWidget {
  const LetterboxdSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  ConsumerState<LetterboxdSection> createState() => _LetterboxdSectionState();
}

class _LetterboxdSectionState extends ConsumerState<LetterboxdSection> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _totp = TextEditingController();
  final _listUrl = TextEditingController();
  // Escapable nodes so a TV remote can leave each field — a bare TextField
  // swallows the D-pad and traps focus in the editor.
  final _usernameFocus = escapableTextFieldNode(debugLabel: 'lb-username');
  final _passwordFocus = escapableTextFieldNode(debugLabel: 'lb-password');
  final _totpFocus = escapableTextFieldNode(debugLabel: 'lb-totp');
  final _listUrlFocus = escapableTextFieldNode(debugLabel: 'lb-list-url');
  bool _busy = false;
  ManifestValidation? _verify;
  bool _needs2fa = false;
  String? _loginError;
  bool _listBusy = false;
  String? _listError;
  bool _seeded = false;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _totp.dispose();
    _listUrl.dispose();
    _usernameFocus.dispose();
    _passwordFocus.dispose();
    _totpFocus.dispose();
    _listUrlFocus.dispose();
    super.dispose();
  }

  Map<String, dynamic> get _lb => Map<String, dynamic>.from(
    ref.read(settingsProvider).getMap('letterboxd'),
  );

  List<String> get _selected =>
      (_lb['selectedCatalogs'] as List?)?.whereType<String>().toList() ??
      const [];

  List<Map<String, dynamic>> get _listRefs =>
      ((_lb['listRefs'] as List?) ?? const [])
          .whereType<Map>()
          .map((r) => Map<String, dynamic>.from(r))
          .toList();

  void _update(Map<String, dynamic> changes) {
    ref.read(settingsProvider.notifier).setValue('letterboxd', {
      ..._lb,
      ...changes,
    });
  }

  /// Persists [changes] and rebuilds the encoded Stremboxd config from the
  /// resulting state, mirroring the web `syncConfig`.
  void _syncConfig(Map<String, dynamic> changes) {
    final next = {..._lb, ...changes};
    final listIds = ((next['listRefs'] as List?) ?? const [])
        .whereType<Map>()
        .map((r) => r['id']?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toList();
    final selected = ((next['selectedCatalogs'] as List?) ?? const [])
        .whereType<String>()
        .toSet();
    final encoded = buildStremboxdConfig(
      selectedCatalogs: selected,
      username: next['username']?.toString() ?? '',
      listIds: listIds,
      ratings: next['showRatingsOnPosters'] != false,
    );
    _update({...changes, 'encodedConfig': encoded});
  }

  void _toggleCatalog(String id, bool on) {
    final sel = [..._selected];
    if (on) {
      if (!sel.contains(id)) sel.add(id);
    } else {
      sel.remove(id);
    }
    _syncConfig({'selectedCatalogs': sel});
    setState(() => _verify = null);
  }

  Future<void> _verifyConfig() async {
    setState(() {
      _busy = true;
      _verify = null;
    });
    final username = _username.text.trim();
    final listIds = _listRefs
        .map((r) => r['id']?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toList();
    final config = buildStremboxdConfig(
      selectedCatalogs: _selected.toSet(),
      username: username,
      listIds: listIds,
      ratings: _lb['showRatingsOnPosters'] != false,
    );
    final result = await ref
        .read(stremboxdClientProvider)
        .validateConfig(config, expectWatchlist: username.isNotEmpty);
    if (!mounted) return;
    setState(() {
      _verify = result;
      _busy = false;
    });
    if (result is ManifestValid) {
      _update({'enabled': true, 'username': username, 'encodedConfig': config});
    }
  }

  /// Full-mode sign-in. The password is entered by the user; on success the
  /// session is stored and the connected card appears, on 2FA the code field
  /// appears, and on error the message is shown.
  Future<void> _login() async {
    setState(() {
      _busy = true;
      _loginError = null;
    });
    final result = await ref
        .read(letterboxdConnectProvider.notifier)
        .login(
          _username.text.trim(),
          _password.text,
          totp: _needs2fa ? _totp.text.trim() : null,
        );
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (result is LetterboxdLoginSuccess) {
        _password.clear();
        _totp.clear();
        _needs2fa = false;
        _update({
          'enabled': true,
          'mode': 'full',
          'username': result.session.username,
        });
      } else if (result is LetterboxdLoginTwoFactor) {
        _needs2fa = true;
      } else if (result is LetterboxdLoginError) {
        _loginError = result.message;
      }
    });
  }

  Future<void> _addList() async {
    final url = _listUrl.text.trim();
    if (url.isEmpty) return;
    setState(() {
      _listBusy = true;
      _listError = null;
    });
    try {
      final resolved = await ref
          .read(stremboxdClientProvider)
          .resolveListPublic(url);
      if (!mounted) return;
      final catalogId = 'letterboxd-list-${resolved.id}';
      final refs = [
        ..._listRefs.where((r) => r['id'] != resolved.id),
        {
          'id': resolved.id,
          'name': resolved.name,
          if (resolved.owner != null) 'owner': resolved.owner,
          if (resolved.filmCount != null) 'filmCount': resolved.filmCount,
        },
      ];
      final sel = _selected.contains(catalogId)
          ? _selected
          : [..._selected, catalogId];
      _syncConfig({'listRefs': refs, 'selectedCatalogs': sel});
      _listUrl.clear();
      setState(() => _listBusy = false);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _listBusy = false;
        _listError = ref
            .read(translationsProvider)
            .t('Could not resolve that Letterboxd list URL.');
      });
    }
  }

  void _removeList(String id) {
    final catalogId = 'letterboxd-list-$id';
    final refs = _listRefs.where((r) => r['id'] != id).toList();
    final sel = _selected.where((c) => c != catalogId).toList();
    _syncConfig({'listRefs': refs, 'selectedCatalogs': sel});
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final lb = ref.watch(settingsProvider).getMap('letterboxd');
    final enabled = lb['enabled'] == true;
    if (!_seeded) {
      _seeded = true;
      _username.text = lb['username']?.toString() ?? '';
    }
    return SettingsSection(
      tokens: t,
      title: tr.t('Letterboxd'),
      subtitle: tr.t(
        'Bring your Letterboxd watchlist, diary, liked films and lists into '
        'Harbor via the Stremboxd bridge.',
      ),
      children: [
        SettingToggleRow(
          tokens: t,
          label: tr.t('Enable Letterboxd integration'),
          sub: tr.t(
            'Shows your Letterboxd catalogs on the home page and a Letterboxd '
            'panel on film pages.',
          ),
          value: enabled,
          onChanged: (v) => setState(() => _update({'enabled': v})),
        ),
        if (enabled) ..._body(t, tr),
      ],
    );
  }

  List<Widget> _body(HarborTokens t, Translations tr) {
    final mode = _lb['mode']?.toString() ?? 'public';
    final session = ref.watch(letterboxdConnectProvider);
    final connected = session != null;
    return [
      SettingSegmented<String>(
        tokens: t,
        label: tr.t('Mode'),
        value: mode,
        options: [
          SettingOption(value: 'public', label: tr.t('Public')),
          SettingOption(value: 'full', label: tr.t('Full')),
        ],
        onChanged: (v) => setState(() => _update({'mode': v})),
      ),
      Text(
        mode == 'public'
            ? tr.t(
                'Public mode uses just your username: watchlist, liked films, '
                'popular and Top 250. No password needed.',
              )
            : tr.t(
                'Full mode signs in with your Letterboxd password to also '
                'unlock your diary, friends activity and your personal ratings. '
                'Your password is sent only to Stremboxd to obtain a token — '
                'Harbor never stores it.',
              ),
        style: TextStyle(color: t.inkSubtle, fontSize: 12.5, height: 1.4),
      ),
      const SizedBox(height: 4),
      _usernameField(t, tr),
      if (mode == 'full') _passwordBlock(t, tr),
      _actionRow(t, tr, mode),
      if (_verify != null) _verifyBanner(t, tr, _verify!),
      if (connected) _connectedCard(t, tr, session),
      _catalogsGrid(t, tr, connected),
      _customLists(t, tr),
      SettingToggleRow(
        tokens: t,
        label: tr.t('Show my rating on movie posters'),
        sub: tr.t(
          'Overlays your Letterboxd rating on catalog posters (when '
          'available).',
        ),
        value: _lb['showRatingsOnPosters'] != false,
        onChanged: (v) => _syncConfig({'showRatingsOnPosters': v}),
      ),
      SettingToggleRow(
        tokens: t,
        label: tr.t('Blur reviews by default'),
        sub: tr.t('Reviews on film pages are blurred until you reveal them.'),
        value: ref.watch(settingsProvider).getBool('blurComments'),
        onChanged: (v) =>
            ref.read(settingsProvider.notifier).setValue('blurComments', v),
      ),
      if (((_lb['hiddenCatalogs'] as List?) ?? const []).isNotEmpty)
        _hiddenCatalogs(t, tr),
    ];
  }

  Widget _passwordBlock(HarborTokens t, Translations tr) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _secretField(
        t,
        tr.t('Letterboxd password'),
        _password,
        focusNode: _passwordFocus,
        obscure: true,
        hint: tr.t('Your Letterboxd password'),
        onChanged: (_) => setState(() {}),
      ),
      if (_needs2fa) ...[
        const SizedBox(height: 10),
        _secretField(
          t,
          tr.t('Two-factor code'),
          _totp,
          focusNode: _totpFocus,
          hint: tr.t('Two-factor authentication code'),
          keyboardType: TextInputType.number,
        ),
      ],
      if (_loginError != null) ...[
        const SizedBox(height: 6),
        Text(
          _loginError!,
          style: TextStyle(color: t.danger, fontSize: 12.5, height: 1.4),
        ),
      ],
    ],
  );

  Widget _actionRow(HarborTokens t, Translations tr, String mode) {
    final isPublic = mode == 'public';
    final usernameEmpty = _username.text.trim().isEmpty;
    final disabled =
        _busy || usernameEmpty || (!isPublic && _password.text.isEmpty);
    final label = isPublic
        ? tr.t('Connect / Verify')
        : (_needs2fa ? tr.t('Verify & connect') : tr.t('Connect'));
    // Wraps like the web's `flex-wrap`: on a narrow phone the About button drops
    // to a second line instead of hard-overflowing the row.
    return Wrap(
      spacing: 12,
      runSpacing: 10,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Opacity(
          opacity: disabled ? 0.5 : 1,
          child: Focusable(
            tokens: t,
            scale: 1.0,
            borderRadius: 12,
            onPressed: disabled ? () {} : (isPublic ? _verifyConfig : _login),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: BoxDecoration(
                color: t.accentSoft,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: t.accent),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_busy)
                    SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: t.accent,
                      ),
                    )
                  else
                    Icon(Icons.link, color: t.accent, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    label,
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
        ),
        _aboutButton(t, tr),
      ],
    );
  }

  Widget _aboutButton(HarborTokens t, Translations tr) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 12,
    onPressed: () => launchUrl(
      Uri.parse('https://stremboxd.com/configure'),
      mode: LaunchMode.externalApplication,
    ),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            tr.t('About Stremboxd'),
            style: TextStyle(
              color: t.inkMuted,
              fontSize: 13.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 6),
          Icon(Icons.open_in_new, color: t.inkMuted, size: 13),
        ],
      ),
    ),
  );

  Widget _connectedCard(
    HarborTokens t,
    Translations tr,
    LetterboxdSession session,
  ) {
    final name = (session.displayName?.isNotEmpty ?? false)
        ? '${session.displayName} (@${session.username})'
        : '@${session.username}';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: t.success.withValues(alpha: 0.12),
              border: Border.all(color: t.success.withValues(alpha: 0.3)),
            ),
            child: Icon(Icons.check, color: t.success, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  tr.t('Full mode — diary, friends & ratings enabled'),
                  style: TextStyle(color: t.inkSubtle, fontSize: 12),
                ),
              ],
            ),
          ),
          _textButton(
            t,
            tr.t('Disconnect'),
            () => ref.read(letterboxdConnectProvider.notifier).disconnect(),
            icon: Icons.logout,
          ),
        ],
      ),
    );
  }

  Widget _catalogsGrid(HarborTokens t, Translations tr, bool connected) {
    final rows = <Widget>[];
    for (var i = 0; i < _catalogOptions.length; i += 2) {
      final a = _catalogOptions[i];
      final b = i + 1 < _catalogOptions.length ? _catalogOptions[i + 1] : null;
      rows.add(
        Padding(
          padding: EdgeInsets.only(
            bottom: i + 2 < _catalogOptions.length ? 8 : 0,
          ),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _catalogCell(t, tr, a, connected)),
                const SizedBox(width: 8),
                Expanded(
                  child: b == null
                      ? const SizedBox()
                      : _catalogCell(t, tr, b, connected),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _fieldLabel(t, tr.t('Catalogs to show')),
        const SizedBox(height: 8),
        ...rows,
      ],
    );
  }

  Widget _catalogCell(
    HarborTokens t,
    Translations tr,
    (String, String, bool) opt,
    bool connected,
  ) {
    final (id, label, fullOnly) = opt;
    final selected = _selected.contains(id);
    final locked = fullOnly && !connected;
    final active = selected && !locked;
    return Opacity(
      opacity: locked ? 0.5 : 1,
      child: Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 12,
        onPressed: locked ? () {} : () => _toggleCatalog(id, !selected),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: active ? t.accentSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? t.accent : t.edgeSoft),
          ),
          child: Row(
            children: [
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: active ? t.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: active ? t.accent : t.edge),
                ),
                child: active
                    ? Icon(Icons.check, size: 13, color: t.canvas)
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  tr.t(label),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: active ? t.ink : t.inkMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (fullOnly) ...[
                const SizedBox(width: 6),
                Text(
                  tr.t('Full'),
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 10,
                    letterSpacing: 0.6,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _customLists(HarborTokens t, Translations tr) {
    final refs = _listRefs;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _fieldLabel(t, tr.t('Custom lists')),
        if (refs.isNotEmpty) ...[
          const SizedBox(height: 8),
          for (final r in refs) _listRow(t, tr, r),
        ],
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _listUrlField(t, tr)),
            const SizedBox(width: 8),
            _addListButton(t, tr),
          ],
        ),
        if (_listError != null) ...[
          const SizedBox(height: 6),
          Text(_listError!, style: TextStyle(color: t.danger, fontSize: 12.5)),
        ],
      ],
    );
  }

  Widget _listRow(HarborTokens t, Translations tr, Map<String, dynamic> r) {
    final owner = r['owner']?.toString() ?? '';
    final count = r['filmCount'];
    final sub =
        '${owner.isNotEmpty ? '$owner · ' : ''}'
        '${count != null ? '$count films' : ''}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r['name']?.toString() ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (sub.isNotEmpty)
                    Text(
                      sub,
                      style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                    ),
                ],
              ),
            ),
            Focusable(
              tokens: t,
              scale: 1.0,
              borderRadius: 8,
              onPressed: () => _removeList(r['id']?.toString() ?? ''),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Icon(Icons.delete_outline, size: 16, color: t.inkSubtle),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _listUrlField(HarborTokens t, Translations tr) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: t.elevated,
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: t.edgeSoft),
    ),
    child: TvTextField(
      controller: _listUrl,
      focusNode: _listUrlFocus,
      autocorrect: false,
      enableSuggestions: false,
      keyboardType: TextInputType.url,
      style: TextStyle(color: t.ink, fontSize: 14),
      cursorColor: t.accent,
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        isCollapsed: true,
        border: InputBorder.none,
        hintText: tr.t('letterboxd.com/username/list/slug'),
        hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
      ),
    ),
  );

  Widget _addListButton(HarborTokens t, Translations tr) {
    final disabled = _listBusy || _listUrl.text.trim().isEmpty;
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 10,
        onPressed: disabled ? () {} : _addList,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_listBusy)
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: t.inkMuted,
                  ),
                )
              else
                Icon(Icons.add, color: t.inkMuted, size: 15),
              const SizedBox(width: 6),
              Text(
                tr.t('Add'),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hiddenCatalogs(HarborTokens t, Translations tr) {
    final hidden = ((_lb['hiddenCatalogs'] as List?) ?? const [])
        .whereType<String>()
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _fieldLabel(t, tr.t('Hidden catalogs')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final id in hidden) _hiddenChip(t, tr, id)],
        ),
      ],
    );
  }

  Widget _hiddenChip(HarborTokens t, Translations tr, String id) {
    String? optLabel;
    for (final o in _catalogOptions) {
      if (o.$1 == id) optLabel = o.$2;
    }
    String? listName;
    for (final r in _listRefs) {
      if ('letterboxd-list-${r['id']}' == id) {
        listName = r['name']?.toString();
      }
    }
    final label = optLabel != null ? tr.t(optLabel) : (listName ?? id);
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      onPressed: () {
        final next = ((_lb['hiddenCatalogs'] as List?) ?? const [])
            .whereType<String>()
            .where((h) => h != id)
            .toList();
        _update({'hiddenCatalogs': next});
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: t.inkMuted,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              tr.t('Show'),
              style: TextStyle(
                color: t.accent,
                fontSize: 10,
                letterSpacing: 0.6,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The eyebrow field label — uppercase/tracked/subtle, matching both the web
  /// (`text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle`)
  /// and the sibling controls (SettingKeyField / SettingRadioGroup).
  Widget _fieldLabel(HarborTokens t, String text) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: t.inkSubtle,
      fontSize: 12,
      fontWeight: FontWeight.w600,
      letterSpacing: 1.4,
    ),
  );

  Widget _secretField(
    HarborTokens t,
    String label,
    TextEditingController controller, {
    FocusNode? focusNode,
    bool obscure = false,
    String? hint,
    ValueChanged<String>? onChanged,
    TextInputType? keyboardType,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _fieldLabel(t, label),
      const SizedBox(height: 6),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: t.elevated,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: t.edgeSoft),
        ),
        child: TvTextField(
          controller: controller,
          focusNode: focusNode,
          obscureText: obscure,
          onChanged: onChanged,
          keyboardType: keyboardType,
          autocorrect: false,
          enableSuggestions: false,
          style: TextStyle(color: t.ink, fontSize: 14),
          cursorColor: t.accent,
          decoration: InputDecoration(
            isCollapsed: true,
            border: InputBorder.none,
            hintText: hint,
            hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
          ),
        ),
      ),
    ],
  );

  Widget _textButton(
    HarborTokens t,
    String label,
    VoidCallback onTap, {
    IconData? icon,
  }) => Focusable(
    tokens: t,
    scale: 1.0,
    // Must match the pill below, or the focus highlight clips it square.
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edge),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: t.ink),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: TextStyle(
              color: t.ink,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _usernameField(HarborTokens t, Translations tr) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _fieldLabel(t, tr.t('Letterboxd username')),
      const SizedBox(height: 6),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: t.elevated,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: t.edgeSoft),
        ),
        child: TvTextField(
          controller: _username,
          focusNode: _usernameFocus,
          autocorrect: false,
          enableSuggestions: false,
          style: TextStyle(color: t.ink, fontSize: 14),
          cursorColor: t.accent,
          onChanged: (_) => setState(() => _verify = null),
          decoration: InputDecoration(
            isCollapsed: true,
            border: InputBorder.none,
            hintText: 'e.g. karsten_runquist',
            hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
          ),
        ),
      ),
    ],
  );

  Widget _verifyBanner(HarborTokens t, Translations tr, ManifestValidation v) {
    final ok = v is ManifestValid;
    final color = ok ? t.success : t.danger;
    final text = v is ManifestValid
        ? tr.t('Connected — {n} catalogs available', {'n': '${v.catalogs}'})
        : (v as ManifestInvalid).message;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(
            ok ? Icons.check_circle : Icons.error_outline,
            color: color,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: color, fontSize: 12.5, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}
