import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/lists/list_detect.dart';
import '../../domain/lists/list_types.dart';
import 'source_dot.dart';
import '../../design/focus/tv_text_field.dart';

/// The add/edit form for an imported list: a URL/handle field with live source
/// detection, an optional name, and submit/cancel. Ported 1:1 from the web
/// `src/views/lists/add-list-form.tsx`. [onSubmit] receives the trimmed ref and
/// (possibly empty) name; it is only reachable once a source is detected.
class AddListForm extends ConsumerStatefulWidget {
  const AddListForm({
    super.key,
    this.initialRef = '',
    this.initialName = '',
    required this.submitLabel,
    this.hideCancel = false,
    this.onCancel,
    required this.onSubmit,
  });

  final String initialRef;
  final String initialName;
  final String submitLabel;
  final bool hideCancel;
  final VoidCallback? onCancel;
  final void Function(String ref, String name) onSubmit;

  @override
  ConsumerState<AddListForm> createState() => _AddListFormState();
}

class _AddListFormState extends ConsumerState<AddListForm> {
  late final TextEditingController _refCtrl = TextEditingController(
    text: widget.initialRef,
  );
  late final TextEditingController _nameCtrl = TextEditingController(
    text: widget.initialName,
  );

  @override
  void dispose() {
    _refCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  DetectResult? get _detected {
    final trimmed = _refCtrl.text.trim();
    return trimmed.isEmpty ? null : detectSource(trimmed);
  }

  void _submit() {
    if (_detected == null) return;
    widget.onSubmit(_refCtrl.text.trim(), _nameCtrl.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final detected = _detected;
    final trimmed = _refCtrl.text.trim();
    final hasName = _nameCtrl.text.trim().isNotEmpty;

    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _label(t, tr.t('List URL or ID')),
          const SizedBox(height: 4),
          _field(
            t,
            controller: _refCtrl,
            autofocus: true,
            mono: true,
            hint: tr.t(
              'Paste a Trakt, MDBList, TMDB, Letterboxd, IMDb, or MAL list URL',
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(height: 22, child: _detection(t, tr, detected, trimmed)),
          const SizedBox(height: 12),
          _label(t, tr.t('Name (optional)')),
          const SizedBox(height: 4),
          _field(t, controller: _nameCtrl, hint: tr.t('My list')),
          if (detected != null && !hasName) ...[
            const SizedBox(height: 4),
            Text(
              tr.t("We'll name it from the URL."),
              style: TextStyle(color: t.inkSubtle, fontSize: 10),
            ),
          ],
          const SizedBox(height: 12),
          _footer(t, tr, enabled: detected != null),
        ],
      ),
    );
  }

  Widget _label(HarborTokens t, String text) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: t.inkSubtle,
      fontSize: 11,
      fontWeight: FontWeight.w600,
      letterSpacing: 1.4,
    ),
  );

  Widget _field(
    HarborTokens t, {
    required TextEditingController controller,
    required String hint,
    bool autofocus = false,
    bool mono = false,
  }) => TvTextField(
    controller: controller,
    autofocus: autofocus,
    onChanged: (_) => setState(() {}),
    onSubmitted: (_) => _submit(),
    textInputAction: TextInputAction.done,
    style: TextStyle(
      color: t.ink,
      fontSize: mono ? 12 : 13,
      fontFamily: mono ? 'monospace' : null,
    ),
    cursorColor: t.accent,
    decoration: InputDecoration(
      isDense: true,
      hintText: hint,
      hintStyle: TextStyle(color: t.inkSubtle, fontSize: mono ? 12 : 13),
      filled: true,
      fillColor: t.canvas,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
        borderSide: BorderSide(color: t.edge, width: 2),
      ),
    ),
  );

  Widget _detection(
    HarborTokens t,
    Translations tr,
    DetectResult? detected,
    String trimmed,
  ) {
    if (detected != null) {
      return Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: t.elevated,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: t.edgeSoft),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: sourceDotColor(t, detected.source),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  tr.t('{source} list detected', {
                    'source': detected.source.label,
                  }),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              detected.ref,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: t.inkSubtle, fontSize: 10.5),
            ),
          ),
        ],
      );
    }
    if (trimmed.isNotEmpty) {
      return Text(
        tr.t('Keep typing, or paste the full list URL.'),
        style: TextStyle(color: t.inkSubtle, fontSize: 11),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _footer(HarborTokens t, Translations tr, {required bool enabled}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (!widget.hideCancel && widget.onCancel != null)
          Focusable(
            tokens: t,
            borderRadius: 10,
            onPressed: widget.onCancel!,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              child: Text(
                tr.t('Cancel'),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        const SizedBox(width: 8),
        Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Focusable(
            tokens: t,
            borderRadius: 10,
            focusColor: t.accent,
            onPressed: enabled ? _submit : () {},
            child: Container(
              decoration: BoxDecoration(
                color: t.ink,
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              child: Text(
                widget.submitLabel,
                style: TextStyle(
                  color: t.canvas,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
