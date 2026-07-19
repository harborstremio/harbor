import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../design/tokens.dart';

/// The live subtitle-sync bar — the native counterpart of `SubSyncBar` in
/// `src/components/player/sub-sync-bar.tsx`. It drops in from the top of the
/// player and nudges the subtitle timing offset in ±0.1s / ±0.5s steps while the
/// video keeps playing. Each step applies immediately through [onDelay]; **Done**
/// keeps the current value, **Discard** (shown only once the value is dirty)
/// restores the delay the bar opened with, and the bar auto-closes after
/// [_idle] of no interaction. Every control is a focusable button, so the bar is
/// fully operable from a TV remote — the web bar's keyboard/pointer path.
class SubSyncBar extends StatefulWidget {
  const SubSyncBar({
    super.key,
    required this.initialDelay,
    required this.onDelay,
    required this.onClose,
    required this.tokens,
  });

  /// The delay (seconds) the bar opens with — its baseline for Discard.
  final double initialDelay;

  /// Applies a new delay to the player, live, on every step.
  final ValueChanged<double> onDelay;

  /// Closes the bar (Done / Discard / Close / idle timeout / Escape).
  final VoidCallback onClose;

  final HarborTokens tokens;

  @override
  State<SubSyncBar> createState() => _SubSyncBarState();
}

class _SubSyncBarState extends State<SubSyncBar> {
  static const Duration _idle = Duration(seconds: 12);

  late double _local = _round(widget.initialDelay);
  late double _saved = _round(widget.initialDelay);
  Timer? _idleTimer;

  /// The bar owns a focus scope so the D-pad lands on (and stays within) its
  /// step/Done/Close controls — without this the remote has nothing selected on
  /// open and every key escapes to the transport controls behind it. Requested
  /// after the first frame so the autofocus'd step button receives it.
  final FocusScopeNode _scope = FocusScopeNode(debugLabel: 'sub-sync-bar');

  @override
  void initState() {
    super.initState();
    _armIdle();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scope.requestFocus();
    });
  }

  @override
  void dispose() {
    _idleTimer?.cancel();
    _scope.dispose();
    super.dispose();
  }

  static double _round(double v) => (v * 100).roundToDouble() / 100;

  /// (Re)starts the inactivity timer that closes the bar after [_idle].
  void _armIdle() {
    _idleTimer?.cancel();
    _idleTimer = Timer(_idle, widget.onClose);
  }

  /// Rounds, stores, and applies [sec] to the player, then resets the idle timer.
  void _apply(double sec) {
    final v = _round(sec);
    setState(() => _local = v);
    widget.onDelay(v);
    _armIdle();
  }

  void _done() {
    _saved = _local;
    widget.onClose();
  }

  void _discard() {
    _apply(_saved);
    widget.onClose();
  }

  bool get _dirty => _round(_local) != _round(_saved);
  bool get _nonZero => _local != 0;

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    _armIdle();
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.escape) {
      widget.onClose();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return FocusScope(
      node: _scope,
      child: FocusTraversalGroup(
        child: Align(
          alignment: Alignment.topCenter,
          child: Padding(
            padding: const EdgeInsets.only(top: 68),
            child: Focus(
              onKeyEvent: _onKey,
              child: MouseRegion(
                onHover: (_) => _armIdle(),
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: t.elevated.withValues(alpha: 0.96),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: t.edge),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0xCC000000),
                          blurRadius: 64,
                          offset: Offset(0, 24),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: t.raised,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _StepButton(
                                label: '−0.5s',
                                tokens: t,
                                onPressed: () => _apply(_local - 0.5),
                              ),
                              _StepButton(
                                label: '−0.1s',
                                tokens: t,
                                onPressed: () => _apply(_local - 0.1),
                              ),
                              _DelayDisplay(
                                value: _local,
                                nonZero: _nonZero,
                                tokens: t,
                                onReset: () => _apply(0),
                              ),
                              _StepButton(
                                label: '+0.1s',
                                tokens: t,
                                autofocus: true,
                                onPressed: () => _apply(_local + 0.1),
                              ),
                              _StepButton(
                                label: '+0.5s',
                                tokens: t,
                                onPressed: () => _apply(_local + 0.5),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        if (_dirty)
                          IconButton(
                            onPressed: _discard,
                            tooltip: 'Discard changes',
                            icon: Icon(Icons.restore, color: t.inkMuted),
                          ),
                        FilledButton.icon(
                          onPressed: _done,
                          style: FilledButton.styleFrom(
                            backgroundColor: t.accent,
                            foregroundColor: t.canvas,
                          ),
                          icon: const Icon(Icons.check, size: 18),
                          label: const Text('Done'),
                        ),
                        const SizedBox(width: 4),
                        IconButton(
                          onPressed: widget.onClose,
                          tooltip: 'Close',
                          icon: Icon(Icons.close, color: t.inkMuted),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One ±step button, styled like the web's monospace step control.
class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.label,
    required this.tokens,
    required this.onPressed,
    this.autofocus = false,
  });

  final String label;
  final HarborTokens tokens;
  final VoidCallback onPressed;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      autofocus: autofocus,
      style: TextButton.styleFrom(
        minimumSize: const Size(52, 36),
        padding: EdgeInsets.zero,
        foregroundColor: tokens.inkMuted,
        textStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          fontFeatures: [FontFeature.tabularFigures()],
        ),
      ),
      child: Text(label),
    );
  }
}

/// The centered live delay read-out (`+0.00s`), accent-tinted when non-zero,
/// with a reset-to-zero affordance that mirrors the web display's corner button.
class _DelayDisplay extends StatelessWidget {
  const _DelayDisplay({
    required this.value,
    required this.nonZero,
    required this.tokens,
    required this.onReset,
  });

  final double value;
  final bool nonZero;
  final HarborTokens tokens;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: SizedBox(
        width: 104,
        height: 44,
        child: Stack(
          children: [
            Center(
              child: Container(
                width: 96,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: tokens.elevated,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${value >= 0 ? '+' : ''}${value.toStringAsFixed(2)}s',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: nonZero ? tokens.accent : tokens.inkSubtle,
                  ),
                ),
              ),
            ),
            if (nonZero)
              Positioned(
                top: 0,
                right: 0,
                child: IconButton(
                  onPressed: onReset,
                  tooltip: 'Reset sync',
                  iconSize: 12,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 22,
                    minHeight: 22,
                  ),
                  icon: Icon(Icons.restart_alt, color: tokens.inkSubtle),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
