import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/focus/focusable.dart';
import '../../design/focus/tv_text_field.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/companion/companion_link.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/playlist_form.dart';
import '../companion/companion_sheet.dart';

/// Opens the add/edit-source form and resolves to the entered value, or null if
/// cancelled. Ports the `PlaylistForm` of `views/live/source-picker`.
Future<PlaylistFormValue?> showPlaylistForm({
  required BuildContext context,
  required HarborTokens tokens,
  required String submitLabel,
  required Translations tr,
  PlaylistFormValue? initial,
}) {
  return showDialog<PlaylistFormValue>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (ctx) => _PlaylistFormDialog(
      tokens: tokens,
      submitLabel: submitLabel,
      tr: tr,
      initial: initial ?? const PlaylistFormValue(),
    ),
  );
}

class _PlaylistFormDialog extends StatefulWidget {
  const _PlaylistFormDialog({
    required this.tokens,
    required this.submitLabel,
    required this.tr,
    required this.initial,
  });

  final HarborTokens tokens;
  final String submitLabel;
  final Translations tr;
  final PlaylistFormValue initial;

  @override
  State<_PlaylistFormDialog> createState() => _PlaylistFormDialogState();
}

class _PlaylistFormDialogState extends State<_PlaylistFormDialog> {
  late PlaylistKind _kind = widget.initial.kind;
  late final _name = TextEditingController(text: widget.initial.name);
  late final _url = TextEditingController(text: widget.initial.url);
  late final _epg = TextEditingController(text: widget.initial.epgUrl);
  late final _server = TextEditingController(
    text: widget.initial.xtream.server,
  );
  late final _user = TextEditingController(
    text: widget.initial.xtream.username,
  );
  late final _pass = TextEditingController(
    text: widget.initial.xtream.password,
  );

  @override
  void dispose() {
    _name.dispose();
    _url.dispose();
    _epg.dispose();
    _server.dispose();
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  PlaylistFormValue get _value => PlaylistFormValue(
    name: _name.text,
    kind: _kind,
    url: _url.text,
    epgUrl: _epg.text,
    xtream: XtreamFormCreds(
      server: _server.text,
      username: _user.text,
      password: _pass.text,
    ),
  );

  static const _kinds = [
    (PlaylistKind.m3u, 'M3U URL', 'Direct .m3u link'),
    (PlaylistKind.xtream, 'Xtream', 'Server + login'),
    (PlaylistKind.epg, 'EPG', 'XMLTV only'),
  ];

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final canSave = validatePlaylistForm(_value);
    return Center(
      child: FocusTraversalGroup(
        child: Material(
          color: Colors.transparent,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 460, maxHeight: 620),
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: t.elevated,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: t.edge),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.submitLabel,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _label(t, widget.tr.t('Type')),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      for (final (kind, label, sub) in _kinds) ...[
                        Expanded(
                          child: _kindTile(t, kind, label, widget.tr.t(sub)),
                        ),
                        if (kind != PlaylistKind.epg) const SizedBox(width: 8),
                      ],
                    ],
                  ),
                  const SizedBox(height: 14),
                  _label(t, widget.tr.t('Name')),
                  const SizedBox(height: 6),
                  _textField(
                    t,
                    _name,
                    'My provider',
                    key: 'playlist-name',
                    label: widget.tr.t('Name'),
                    kind: CompanionKind.text,
                  ),
                  const SizedBox(height: 14),
                  ..._kindFields(t),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      _button(
                        t,
                        widget.tr.t('Cancel'),
                        filled: false,
                        onTap: () => Navigator.of(context).pop(),
                      ),
                      const SizedBox(width: 10),
                      _button(
                        t,
                        widget.submitLabel,
                        filled: true,
                        enabled: canSave,
                        buttonKey: const ValueKey('playlist-submit'),
                        onTap: canSave
                            ? () => Navigator.of(context).pop(_value)
                            : null,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _kindFields(HarborTokens t) {
    switch (_kind) {
      case PlaylistKind.m3u:
        return [
          _label(t, widget.tr.t('M3U URL')),
          const SizedBox(height: 6),
          _textField(
            t,
            _url,
            'https://host/playlist.m3u',
            key: 'playlist-url',
            label: widget.tr.t('M3U URL'),
            kind: CompanionKind.url,
          ),
          const SizedBox(height: 14),
          _label(t, widget.tr.t('EPG URL (optional)')),
          const SizedBox(height: 6),
          _textField(
            t,
            _epg,
            'https://host/xmltv.php',
            key: 'playlist-epg',
            label: widget.tr.t('EPG URL'),
            kind: CompanionKind.url,
          ),
        ];
      case PlaylistKind.xtream:
        return [
          _label(t, widget.tr.t('Server')),
          const SizedBox(height: 6),
          _textField(
            t,
            _server,
            'http://host:8080',
            key: 'playlist-server',
            label: widget.tr.t('Server'),
            kind: CompanionKind.url,
          ),
          const SizedBox(height: 14),
          _label(t, widget.tr.t('Username')),
          const SizedBox(height: 6),
          _textField(
            t,
            _user,
            'username',
            key: 'playlist-user',
            label: widget.tr.t('Username'),
            kind: CompanionKind.text,
          ),
          const SizedBox(height: 14),
          _label(t, widget.tr.t('Password')),
          const SizedBox(height: 6),
          _textField(
            t,
            _pass,
            'password',
            key: 'playlist-pass',
            obscure: true,
            label: widget.tr.t('Password'),
            kind: CompanionKind.key,
          ),
        ];
      case PlaylistKind.epg:
        return [
          _label(t, widget.tr.t('XMLTV URL')),
          const SizedBox(height: 6),
          _textField(
            t,
            _epg,
            'https://host/xmltv.php',
            key: 'playlist-epg',
            label: widget.tr.t('XMLTV URL'),
            kind: CompanionKind.url,
          ),
        ];
    }
  }

  Widget _kindTile(
    HarborTokens t,
    PlaylistKind kind,
    String label,
    String sub,
  ) {
    final selected = _kind == kind;
    return Focusable(
      tokens: t,
      borderRadius: 10,
      scale: 1.03,
      // Land the remote on the selected type tile when the form opens so a TV
      // session has a visible target (a tile, not a text field, so the on-screen
      // keyboard doesn't pop). Only fires on first mount.
      autofocus: selected,
      onPressed: () => setState(() => _kind = kind),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? t.surface : t.canvas,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? t.ink : t.edgeSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                color: selected ? t.ink : t.inkMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(sub, style: TextStyle(color: t.inkSubtle, fontSize: 10)),
          ],
        ),
      ),
    );
  }

  Widget _label(HarborTokens t, String s) => Text(
    s,
    style: TextStyle(
      color: t.inkMuted,
      fontSize: 12,
      fontWeight: FontWeight.w600,
    ),
  );

  Widget _textField(
    HarborTokens t,
    TextEditingController controller,
    String hint, {
    required String key,
    required String label,
    CompanionKind kind = CompanionKind.url,
    bool obscure = false,
  }) {
    final field = TvTextField(
      key: ValueKey(key),
      controller: controller,
      obscureText: obscure,
      onChanged: (_) => setState(() {}),
      style: TextStyle(color: t.ink, fontSize: 14),
      cursorColor: t.accent,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: t.inkSubtle),
        filled: true,
        fillColor: t.raised,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 11,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: t.edgeSoft),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: t.edgeSoft),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: t.accent, width: 2),
        ),
      ),
    );
    // On a TV, offer to enter this URL / login from a phone (scan the QR).
    if (!Idiom.of(context).isTv) return field;
    return Row(
      children: [
        Expanded(child: field),
        const SizedBox(width: 8),
        Consumer(
          builder: (context, ref, _) => Focusable(
            tokens: t,
            borderRadius: 10,
            onPressed: () async {
              final v = await enterOnPhone(
                context,
                ref,
                label: label,
                kind: kind,
              );
              if (v != null && v.isNotEmpty && mounted) {
                controller.text = v;
                setState(() {});
              }
            },
            child: Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.raised,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: t.edgeSoft),
              ),
              child: Icon(Icons.smartphone, size: 18, color: t.inkMuted),
            ),
          ),
        ),
      ],
    );
  }

  Widget _button(
    HarborTokens t,
    String label, {
    required bool filled,
    required VoidCallback? onTap,
    bool enabled = true,
    Key? buttonKey,
  }) {
    return Focusable(
      key: buttonKey,
      tokens: t,
      borderRadius: 10,
      scale: 1.04,
      onPressed: onTap ?? () {},
      child: Opacity(
        opacity: enabled ? 1 : 0.4,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          decoration: BoxDecoration(
            color: filled ? t.accent : t.raised,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: filled ? t.canvas : t.ink,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
