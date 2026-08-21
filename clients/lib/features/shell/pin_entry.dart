import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';

/// Whether the [PinEntry] is setting a new PIN (enter → confirm) or verifying an
/// existing one. Ported from the web `mode` union.
enum PinMode { set, verify }

/// Shows a [PinEntry] in a modal dialog and resolves to the entered PIN — the
/// newly-set PIN for [PinMode.set], or the (verified) PIN for [PinMode.verify]
/// — or null if the user backs out. [verify] is required for [PinMode.verify].
Future<String?> showPinDialog(
  BuildContext context, {
  required HarborTokens tokens,
  required String title,
  required String subtitle,
  required PinMode mode,
  FutureOr<bool> Function(String pin)? verify,
}) {
  return showDialog<String>(
    context: context,
    builder: (ctx) => Dialog(
      backgroundColor: tokens.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: PinEntry(
          tokens: tokens,
          title: title,
          subtitle: subtitle,
          mode: mode,
          verify: verify,
          onComplete: (pin) => Navigator.of(ctx).pop(pin),
          onBack: () => Navigator.of(ctx).pop(),
        ),
      ),
    ),
  );
}

/// The 4-digit profile PIN pad, ported 1:1 from `pin-entry.tsx`: a dot row, an
/// on-screen keypad, error + shake feedback, and (for `set`) an enter→confirm
/// two-stage flow. Fully remote-navigable — every key is a [Focusable] and a
/// physical/TV keyboard drives the same pipeline (digits, backspace, escape).
class PinEntry extends ConsumerStatefulWidget {
  const PinEntry({
    super.key,
    required this.tokens,
    required this.title,
    required this.subtitle,
    required this.mode,
    required this.onComplete,
    required this.onBack,
    this.verify,
  });

  final HarborTokens tokens;
  final String title;
  final String subtitle;
  final PinMode mode;

  /// Called with the accepted PIN — after a matching confirm (`set`) or a
  /// successful [verify] (`verify`).
  final FutureOr<void> Function(String pin) onComplete;
  final VoidCallback onBack;

  /// Required for [PinMode.verify]: whether the entered PIN is correct.
  final FutureOr<bool> Function(String pin)? verify;

  @override
  ConsumerState<PinEntry> createState() => _PinEntryState();
}

class _PinEntryState extends ConsumerState<PinEntry>
    with SingleTickerProviderStateMixin {
  _Stage _stage = _Stage.enter;
  String _first = '';
  String _pin = '';
  String? _error;
  bool _busy = false;
  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 340),
  );

  @override
  void dispose() {
    _shake.dispose();
    super.dispose();
  }

  void _triggerShake() => _shake.forward(from: 0);

  Future<void> _onFilled() async {
    if (_busy) return;
    if (widget.mode == PinMode.verify) {
      final verify = widget.verify;
      if (verify == null) return;
      setState(() => _busy = true);
      final ok = await verify(_pin);
      if (!mounted) return;
      if (ok) {
        await widget.onComplete(_pin);
      } else {
        setState(() {
          _busy = false;
          _error = ref.read(translationsProvider).t('Wrong PIN');
          _pin = '';
        });
        _triggerShake();
      }
      return;
    }
    // set mode: first entry captures, second confirms.
    if (_stage == _Stage.enter) {
      setState(() {
        _first = _pin;
        _pin = '';
        _stage = _Stage.confirm;
        _error = null;
      });
      return;
    }
    if (_pin != _first) {
      setState(() {
        _error = ref
            .read(translationsProvider)
            .t("PINs didn't match. Start over.");
        _first = '';
        _pin = '';
        _stage = _Stage.enter;
      });
      _triggerShake();
      return;
    }
    setState(() => _busy = true);
    await widget.onComplete(_pin);
  }

  void _tap(String digit) {
    if (_busy || _pin.length >= 4) return;
    setState(() {
      _error = null;
      _pin = _pin + digit;
    });
    if (_pin.length == 4) _onFilled();
  }

  void _backspace() {
    if (_busy || _pin.isEmpty) return;
    setState(() {
      _error = null;
      _pin = _pin.substring(0, _pin.length - 1);
    });
  }

  KeyEventResult _onKey(FocusNode _, KeyEvent e) {
    if (e is! KeyDownEvent && e is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    final k = e.logicalKey;
    if (k == LogicalKeyboardKey.backspace || k == LogicalKeyboardKey.delete) {
      _backspace();
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.escape) {
      widget.onBack();
      return KeyEventResult.handled;
    }
    final digit = _digitOf(k);
    if (digit != null) {
      _tap(digit);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  String? _digitOf(LogicalKeyboardKey k) {
    for (var d = 0; d <= 9; d++) {
      if (k == _rowDigits[d] || k == _numpadDigits[d]) return '$d';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final confirming = widget.mode == PinMode.set && _stage == _Stage.confirm;
    final title = confirming ? tr.t('Confirm your PIN') : widget.title;
    final subtitle = confirming
        ? tr.t('Type the same 4-digit PIN again.')
        : widget.subtitle;

    return Focus(
      onKeyEvent: _onKey,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Focusable(
                tokens: t,
                scale: 1.0,
                borderRadius: 10,
                onPressed: widget.onBack,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 8,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.chevron_left_rounded,
                        size: 18,
                        color: t.inkMuted,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        tr.t('Back'),
                        style: TextStyle(
                          color: t.inkMuted,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              tr.t('Profile PIN'),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 3.2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: t.ink,
                fontSize: 26,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 13.5, height: 1.35),
            ),
            const SizedBox(height: 26),
            AnimatedBuilder(
              animation: _shake,
              builder: (context, child) {
                final v = _shake.value;
                final dx = v == 0
                    ? 0.0
                    : math.sin(v * math.pi * 4) * 8 * (1 - v);
                return Transform.translate(offset: Offset(dx, 0), child: child);
              },
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < 4; i++)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 7),
                          child: _Dot(filled: _pin.length > i, tokens: t),
                        ),
                    ],
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: t.danger,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 22),
                  _keypad(t),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Text(
              tr.t('Type on your keyboard or tap the digits above.'),
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _keypad(HarborTokens t) {
    Widget key(String d, {bool autofocus = false}) => _PinKey(
      tokens: t,
      autofocus: autofocus,
      onPressed: () => _tap(d),
      child: Text(
        d,
        style: TextStyle(
          color: t.ink,
          fontSize: 20,
          fontWeight: FontWeight.w500,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
    Widget row(List<Widget> children) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (final c in children)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              child: c,
            ),
        ],
      ),
    );
    return Column(
      children: [
        row([key('1', autofocus: true), key('2'), key('3')]),
        row([key('4'), key('5'), key('6')]),
        row([key('7'), key('8'), key('9')]),
        row([
          const SizedBox(width: 48, height: 48),
          key('0'),
          _PinKey(
            tokens: t,
            onPressed: _backspace,
            child: Icon(
              Icons.backspace_outlined,
              size: 18,
              color: _pin.isEmpty ? t.inkSubtle : t.ink,
            ),
          ),
        ]),
      ],
    );
  }
}

enum _Stage { enter, confirm }

class _Dot extends StatelessWidget {
  const _Dot({required this.filled, required this.tokens});
  final bool filled;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
    duration: const Duration(milliseconds: 140),
    width: filled ? 15 : 14,
    height: filled ? 15 : 14,
    decoration: BoxDecoration(
      color: filled ? tokens.ink : Colors.transparent,
      shape: BoxShape.circle,
      border: Border.all(color: filled ? tokens.ink : tokens.edgeSoft),
    ),
  );
}

class _PinKey extends StatelessWidget {
  const _PinKey({
    required this.tokens,
    required this.onPressed,
    required this.child,
    this.autofocus = false,
  });

  final HarborTokens tokens;
  final VoidCallback onPressed;
  final Widget child;
  final bool autofocus;

  @override
  Widget build(BuildContext context) => Focusable(
    tokens: tokens,
    autofocus: autofocus,
    borderRadius: 999,
    onPressed: onPressed,
    child: Container(
      width: 48,
      height: 48,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: tokens.canvas.withValues(alpha: 0.55),
        shape: BoxShape.circle,
        border: Border.all(color: tokens.edgeSoft),
      ),
      child: child,
    ),
  );
}

const _rowDigits = <LogicalKeyboardKey>[
  LogicalKeyboardKey.digit0,
  LogicalKeyboardKey.digit1,
  LogicalKeyboardKey.digit2,
  LogicalKeyboardKey.digit3,
  LogicalKeyboardKey.digit4,
  LogicalKeyboardKey.digit5,
  LogicalKeyboardKey.digit6,
  LogicalKeyboardKey.digit7,
  LogicalKeyboardKey.digit8,
  LogicalKeyboardKey.digit9,
];

const _numpadDigits = <LogicalKeyboardKey>[
  LogicalKeyboardKey.numpad0,
  LogicalKeyboardKey.numpad1,
  LogicalKeyboardKey.numpad2,
  LogicalKeyboardKey.numpad3,
  LogicalKeyboardKey.numpad4,
  LogicalKeyboardKey.numpad5,
  LogicalKeyboardKey.numpad6,
  LogicalKeyboardKey.numpad7,
  LogicalKeyboardKey.numpad8,
  LogicalKeyboardKey.numpad9,
];
