import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/focus/tv_text_field.dart';
import '../../../design/layout/idiom.dart';
import '../../../domain/companion/companion_link.dart';
import '../../companion/companion_sheet.dart';

/// The install-from-URL bar, ported 1:1 from `AddByUrlBar`. A link-prefixed
/// input plus an Install button that appears only once the field is non-empty;
/// [onSubmit] receives the trimmed URL and the field clears on success.
class AddByUrlBar extends ConsumerStatefulWidget {
  const AddByUrlBar({super.key, required this.onSubmit, this.compact = false});

  final Future<void> Function(String raw) onSubmit;
  final bool compact;

  @override
  ConsumerState<AddByUrlBar> createState() => _AddByUrlBarState();
}

class _AddByUrlBarState extends ConsumerState<AddByUrlBar> {
  final _controller = TextEditingController();
  bool _busy = false;

  bool get _hasText => _controller.text.trim().isNotEmpty;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final v = _controller.text.trim();
    if (v.isEmpty || _busy) return;
    setState(() => _busy = true);
    try {
      await widget.onSubmit(v);
      _controller.clear();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final compact = widget.compact;
    final height = compact ? 40.0 : 56.0;
    final radius = compact ? 999.0 : 12.0;
    final placeholder = compact
        ? 'Paste manifest URL or stremio:// link'
        : 'Install from URL: paste any manifest or stremio:// link';

    return Row(
      children: [
        Expanded(
          child: Container(
            height: height,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: t.elevated.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(radius),
              border: Border.all(color: t.edgeSoft.withValues(alpha: 0.7)),
            ),
            child: Row(
              children: [
                Icon(Icons.link, size: compact ? 14 : 18, color: t.inkSubtle),
                const SizedBox(width: 12),
                Expanded(
                  child: TvTextField(
                    controller: _controller,
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) => _submit(),
                    cursorColor: t.accent,
                    style: TextStyle(
                      fontSize: compact ? 13 : 15.5,
                      color: t.ink,
                    ),
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: placeholder,
                      hintStyle: TextStyle(
                        fontSize: compact ? 13 : 15.5,
                        color: t.inkSubtle,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        // On a TV a manifest URL is painful to type on the remote, so offer to
        // enter it from a phone (scan the QR → type there). Hidden off-TV, where
        // the on-screen keyboard is easy.
        if (Idiom.of(context).isTv) ...[
          const SizedBox(width: 8),
          Focusable(
            tokens: t,
            borderRadius: radius,
            onPressed: _onEnterOnPhone,
            child: Container(
              height: height,
              width: height,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.elevated.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(radius),
                border: Border.all(color: t.edgeSoft.withValues(alpha: 0.7)),
              ),
              child: Icon(
                Icons.smartphone,
                size: compact ? 16 : 20,
                color: t.inkMuted,
              ),
            ),
          ),
        ],
        if (_hasText) ...[
          const SizedBox(width: 8),
          Focusable(
            onPressed: _busy ? () {} : _submit,
            tokens: t,
            borderRadius: radius,
            child: Container(
              height: height,
              padding: EdgeInsets.symmetric(horizontal: compact ? 16 : 24),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.ink,
                borderRadius: BorderRadius.circular(radius),
              ),
              child: Text(
                _busy ? 'Installing…' : 'Install',
                style: TextStyle(
                  fontSize: compact ? 12.5 : 14.5,
                  fontWeight: FontWeight.w600,
                  color: t.canvas,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _onEnterOnPhone() async {
    final value = await enterOnPhone(
      context,
      ref,
      label: 'Add-on manifest URL',
      kind: CompanionKind.url,
    );
    if (value != null && value.isNotEmpty && mounted) {
      _controller.text = value;
      setState(() {});
    }
  }
}
