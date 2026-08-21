import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_text_field.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/companion/companion_link.dart';
import '../../domain/home/custom_sources.dart';
import '../../domain/i18n/translations.dart';
import '../companion/companion_sheet.dart';

/// Opens the "Add Custom Source" modal (web `AddSourceModal`) and resolves to the
/// valid source-row maps to store, or null if cancelled. The user provides either
/// a JSON URL (fetched) or a pasted JSON blob; both are validated before saving.
Future<List<Map<String, dynamic>>?> showAddSourceDialog({
  required BuildContext context,
  required HarborTokens tokens,
  required Translations tr,
}) {
  return showDialog<List<Map<String, dynamic>>>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (ctx) => _AddSourceDialog(tokens: tokens, tr: tr),
  );
}

enum _Mode { url, json }

class _AddSourceDialog extends ConsumerStatefulWidget {
  const _AddSourceDialog({required this.tokens, required this.tr});

  final HarborTokens tokens;
  final Translations tr;

  @override
  ConsumerState<_AddSourceDialog> createState() => _AddSourceDialogState();
}

class _AddSourceDialogState extends ConsumerState<_AddSourceDialog> {
  _Mode _mode = _Mode.url;
  final _url = TextEditingController();
  final _json = TextEditingController();
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _url.dispose();
    _json.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading) return;
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      List<Map<String, dynamic>> rows;
      if (_mode == _Mode.url) {
        final url = _url.text.trim();
        if (url.isEmpty) {
          if (mounted) {
            setState(() => _error = widget.tr.t('URL cannot be empty'));
          }
          return;
        }
        final res = await ref.read(jsonTransportProvider).getJson(url);
        if (!mounted) return;
        if (!res.ok) {
          setState(() => _error = widget.tr.t('Failed to fetch JSON'));
          return;
        }
        // A raw pack link (raw.githubusercontent / gist / pastebin) is served as
        // text/plain, which Dio does not JSON-decode — so [data] is the raw
        // string. Parse it like web's res.text()+JSON.parse; otherwise it is
        // already-decoded JSON (Map/List).
        rows = res.data is String
            ? parseCustomSourceMapsJson(res.data as String)
            : validCustomSourceMapsFromData(res.data);
      } else {
        final text = _json.text.trim();
        if (text.isEmpty) {
          if (mounted) {
            setState(() => _error = widget.tr.t('JSON cannot be empty'));
          }
          return;
        }
        rows = parseCustomSourceMapsJson(text);
      }
      if (!mounted) return;
      if (rows.isEmpty) {
        setState(() => _error = widget.tr.t('Invalid SourceRow JSON format'));
        return;
      }
      Navigator.of(context).pop(rows);
    } catch (_) {
      if (mounted) setState(() => _error = widget.tr.t('An error occurred'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = widget.tr;
    return Center(
      child: FocusTraversalGroup(
        child: Material(
          color: Colors.transparent,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 460, maxHeight: 560),
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
                    tr.t('Add Custom Source'),
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tr.t('Provide a JSON link or paste it directly.'),
                    style: TextStyle(color: t.inkMuted, fontSize: 12.5),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _modeTile(t, _Mode.url, tr.t('JSON URL')),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _modeTile(t, _Mode.json, tr.t('Paste JSON')),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (_mode == _Mode.url)
                    _field(
                      t,
                      _url,
                      'https://example.com/sources.json',
                      label: tr.t('JSON URL'),
                      kind: CompanionKind.url,
                    )
                  else
                    _field(
                      t,
                      _json,
                      '[ { "id": "...", "title": "Directors", "folders": [ ... ] } ]',
                      label: tr.t('Paste JSON'),
                      kind: CompanionKind.text,
                      maxLines: 6,
                    ),
                  if (_error != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      _error!,
                      style: const TextStyle(
                        color: Color(0xFFEF4444),
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      _button(
                        t,
                        tr.t('Cancel'),
                        filled: false,
                        onTap: _loading
                            ? null
                            : () => Navigator.of(context).pop(),
                      ),
                      const SizedBox(width: 10),
                      _button(
                        t,
                        _loading ? tr.t('Loading...') : tr.t('Add Source'),
                        filled: true,
                        onTap: _loading ? null : _submit,
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

  Widget _modeTile(HarborTokens t, _Mode mode, String label) {
    final selected = _mode == mode;
    return Focusable(
      tokens: t,
      borderRadius: 10,
      scale: 1.03,
      // Land the remote on the selected mode tile (not a text field, so no
      // on-screen keyboard pops on a TV).
      autofocus: selected && mode == _Mode.url,
      onPressed: () => setState(() {
        _mode = mode;
        _error = null;
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? t.surface : t.canvas,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? t.ink : t.edgeSoft),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? t.ink : t.inkMuted,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _field(
    HarborTokens t,
    TextEditingController controller,
    String hint, {
    required String label,
    required CompanionKind kind,
    int maxLines = 1,
  }) {
    final field = TvTextField(
      controller: controller,
      maxLines: maxLines,
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
    // On a TV, typing a long URL / JSON on a remote is painful — offer the
    // companion "enter on phone" QR flow, exactly as the IPTV source form does.
    if (!Idiom.of(context).isTv) return field;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: field),
        const SizedBox(width: 8),
        Focusable(
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
      ],
    );
  }

  Widget _button(
    HarborTokens t,
    String label, {
    required bool filled,
    required VoidCallback? onTap,
  }) {
    final enabled = onTap != null;
    return Focusable(
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
