import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../design/focus/tv_text_field.dart';

/// A small pill button used by the PIN dialogs.
Widget _pinButton(
  HarborTokens t,
  String label,
  VoidCallback onTap, {
  required bool primary,
  Widget? busy,
}) => Focusable(
  tokens: t,
  borderRadius: 12,
  onPressed: onTap,
  child: Container(
    alignment: Alignment.center,
    padding: const EdgeInsets.symmetric(vertical: 12),
    decoration: BoxDecoration(
      color: primary ? t.accent : t.elevated,
      borderRadius: BorderRadius.circular(12),
      border: primary ? null : Border.all(color: t.edgeSoft),
    ),
    child:
        busy ??
        Text(
          label,
          style: TextStyle(
            color: primary ? t.canvas : t.inkMuted,
            fontSize: 14,
            fontWeight: primary ? FontWeight.w700 : FontWeight.w600,
          ),
        ),
  ),
);

/// The parental PIN entry dialog. In unlock mode it verifies the PIN via
/// [verify]; on success it pops `true`. Ported from the web `ParentalPinModal`
/// (unlock). Shown when a locked tab is opened.
class ParentalPinDialog extends StatefulWidget {
  const ParentalPinDialog({
    super.key,
    required this.tokens,
    required this.verify,
    required this.tr,
    this.title = 'Enter PIN',
    this.subtitle = 'This profile is locked. Enter the PIN to continue.',
  });

  final HarborTokens tokens;
  final Future<bool> Function(String pin) verify;
  final Translations tr;
  final String title;
  final String subtitle;

  @override
  State<ParentalPinDialog> createState() => _ParentalPinDialogState();
}

class _ParentalPinDialogState extends State<ParentalPinDialog> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  bool _busy = false;
  bool _error = false;

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final pin = _controller.text.trim();
    if (pin.isEmpty || _busy) return;
    setState(() {
      _busy = true;
      _error = false;
    });
    final ok = await widget.verify(pin);
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _busy = false;
        _error = true;
        _controller.clear();
      });
      _focus.requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return Dialog(
      backgroundColor: t.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.lock_outline_rounded, color: t.accent, size: 30),
              const SizedBox(height: 16),
              Text(
                widget.tr.t(widget.title),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.tr.t(widget.subtitle),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 13.5,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              TvTextField(
                controller: _controller,
                focusNode: _focus,
                autofocus: true,
                obscureText: true,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
                style: TextStyle(color: t.ink, fontSize: 22, letterSpacing: 8),
                cursorColor: t.accent,
                decoration: InputDecoration(
                  hintText: '••••',
                  hintStyle: TextStyle(color: t.inkSubtle, letterSpacing: 8),
                  filled: true,
                  fillColor: t.elevated,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: _error ? t.danger : t.edgeSoft,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: _error ? t.danger : t.edgeSoft,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: _error ? t.danger : t.accent,
                      width: 2,
                    ),
                  ),
                ),
              ),
              if (_error) ...[
                const SizedBox(height: 8),
                Text(
                  widget.tr.t('Incorrect PIN. Try again.'),
                  style: TextStyle(color: t.danger, fontSize: 12.5),
                ),
              ],
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: _pinButton(
                      t,
                      widget.tr.t('Cancel'),
                      () => Navigator.of(context).pop(false),
                      primary: false,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _pinButton(
                      t,
                      widget.tr.t('Unlock'),
                      _submit,
                      primary: true,
                      busy: _busy
                          ? SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                color: t.canvas,
                                strokeWidth: 2,
                              ),
                            )
                          : null,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A dialog to set (or change) a profile PIN: enter a new PIN and confirm it.
/// Pops the chosen PIN string, or null on cancel. Ported from the web
/// `pin-entry` set flow.
class SetPinDialog extends StatefulWidget {
  const SetPinDialog({
    super.key,
    required this.tokens,
    required this.tr,
    this.title = 'Set a PIN',
  });

  final HarborTokens tokens;
  final Translations tr;
  final String title;

  @override
  State<SetPinDialog> createState() => _SetPinDialogState();
}

class _SetPinDialogState extends State<SetPinDialog> {
  final _pin = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _pin.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _save() {
    final pin = _pin.text.trim();
    final confirm = _confirm.text.trim();
    if (pin.length < 4) {
      setState(() => _error = widget.tr.t('Use at least 4 digits.'));
      return;
    }
    if (pin != confirm) {
      setState(() => _error = "The PINs don't match.");
      return;
    }
    Navigator.of(context).pop(pin);
  }

  Widget _field(HarborTokens t, TextEditingController c, String hint) =>
      TvTextField(
        controller: c,
        autofocus: c == _pin,
        obscureText: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: TextStyle(color: t.ink, fontSize: 20, letterSpacing: 6),
        cursorColor: t.accent,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
          filled: true,
          fillColor: t.elevated,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 12,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: t.edgeSoft),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: t.accent, width: 2),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return Dialog(
      backgroundColor: t.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.tr.t(widget.title),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.tr.t(
                  "Pick a PIN. You'll be asked for it before this profile's "
                  'locked tabs open.',
                ),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 13.5,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 18),
              _field(t, _pin, widget.tr.t('New PIN')),
              const SizedBox(height: 10),
              _field(t, _confirm, widget.tr.t('Confirm PIN')),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: TextStyle(color: t.danger, fontSize: 12.5),
                ),
              ],
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: _pinButton(
                      t,
                      widget.tr.t('Cancel'),
                      () => Navigator.of(context).pop(),
                      primary: false,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _pinButton(
                      t,
                      widget.tr.t('Save'),
                      _save,
                      primary: true,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
