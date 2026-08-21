import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens.dart';
import 'ui_sound.dart';

/// The base 10-foot focus primitive. Wraps any child so it is a real focus node
/// reachable by native directional focus (Android-TV D-pad, Apple-TV Siri
/// Remote) and by touch/pointer. On focus it applies the standard treatment —
/// scale, accent ring, raised elevation — via [FocusableActionDetector], and
/// activates on Select/Enter or tap. No synthetic key events; the platform's
/// focus engine drives it.
class Focusable extends StatefulWidget {
  const Focusable({
    super.key,
    required this.child,
    required this.onPressed,
    this.tokens,
    this.autofocus = false,
    this.borderRadius = 14,
    this.scale = 1.07,
    this.focusColor,
    this.onFocusChange,
    this.onLongPress,
    this.focusNode,
    this.sfxTap = SfxTap.click,
  });

  final Widget child;
  final VoidCallback onPressed;
  final HarborTokens? tokens;
  final bool autofocus;
  final double borderRadius;
  final double scale;
  final Color? focusColor;
  final ValueChanged<bool>? onFocusChange;

  /// An external focus node, when a caller needs to drive focus onto this
  /// control programmatically (e.g. the player parking the remote on
  /// play/pause when the chrome wakes). The caller owns and disposes it; when
  /// null, [FocusableActionDetector] manages its own node as before.
  final FocusNode? focusNode;

  /// The secondary action — a touch long-press or the remote/keyboard context
  /// key — that opens a context menu. Ports the web `onContextMenu` intent.
  final VoidCallback? onLongPress;

  /// Which UI sound (if any) this control plays on activation — the web SFX
  /// distinguishes media cards ([SfxTap.open]) from generic controls
  /// ([SfxTap.click]). Silent unless a sound theme is enabled.
  final SfxTap sfxTap;

  @override
  State<Focusable> createState() => _FocusableState();
}

/// Fired by the remote/keyboard context key to open a [Focusable]'s menu.
class _ContextMenuIntent extends Intent {
  const _ContextMenuIntent();
}

class _FocusableState extends State<Focusable> {
  bool _focused = false;

  void _setFocused(bool v) {
    if (v == _focused) return;
    setState(() => _focused = v);
    widget.onFocusChange?.call(v);
  }

  /// Plays the control's UI sound (web `SFX.click` / `SFX.open`), then runs the
  /// action. A no-op sound when no theme is set.
  void _activate() {
    switch (widget.sfxTap) {
      case SfxTap.click:
        uiSound?.click();
      case SfxTap.open:
        uiSound?.open();
      case SfxTap.none:
        break;
    }
    widget.onPressed();
  }

  @override
  Widget build(BuildContext context) {
    final ring =
        widget.focusColor ??
        widget.tokens?.accent ??
        Theme.of(context).colorScheme.primary;
    final radius = BorderRadius.circular(widget.borderRadius);

    return FocusableActionDetector(
      autofocus: widget.autofocus,
      focusNode: widget.focusNode,
      mouseCursor: SystemMouseCursors.click,
      onShowFocusHighlight: _setFocused,
      shortcuts: {
        const SingleActivator(LogicalKeyboardKey.select):
            const ActivateIntent(),
        const SingleActivator(LogicalKeyboardKey.enter): const ActivateIntent(),
        const SingleActivator(LogicalKeyboardKey.gameButtonA):
            const ActivateIntent(),
        const SingleActivator(LogicalKeyboardKey.space): const ActivateIntent(),
        if (widget.onLongPress != null)
          const SingleActivator(LogicalKeyboardKey.contextMenu):
              const _ContextMenuIntent(),
      },
      actions: {
        ActivateIntent: CallbackAction<ActivateIntent>(
          onInvoke: (_) {
            _activate();
            return null;
          },
        ),
        if (widget.onLongPress != null)
          _ContextMenuIntent: CallbackAction<_ContextMenuIntent>(
            onInvoke: (_) {
              widget.onLongPress!();
              return null;
            },
          ),
      },
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _activate,
        onLongPress: widget.onLongPress,
        child: AnimatedScale(
          scale: _focused ? widget.scale : 1.0,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(
                color: _focused ? ring : Colors.transparent,
                width: 3,
              ),
              boxShadow: _focused
                  ? [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.45),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ]
                  : const [],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(widget.borderRadius - 3),
              child: widget.child,
            ),
          ),
        ),
      ),
    );
  }
}
