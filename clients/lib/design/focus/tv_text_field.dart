import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A [TextField] that never traps a D-pad remote on Android TV.
///
/// Flutter's plain [TextField] consumes the arrow keys to move the text caret,
/// so on a TV remote the focus gets stuck inside the field with no way out and
/// Back does nothing (flutter/flutter#147772, #180542). This drop-in wraps the
/// field's OWN focus node — whose key handler runs *before* the text-editing
/// shortcuts consume the arrows — and:
///
/// * **Up / Down** move focus OUT of a single-line field (the caret can't go
///   there anyway); on a multi-line field they leave only at the top/bottom.
/// * **Left / Right** leave only when the caret is already at the text edge, so
///   in-field caret movement still works.
/// * **Back / Escape** release the field's focus (closing the on-screen
///   keyboard) so the surrounding screen's back handler can dismiss it.
///
/// Use it exactly like [TextField]; every common parameter is forwarded.
class TvTextField extends StatefulWidget {
  const TvTextField({
    super.key,
    this.controller,
    this.focusNode,
    this.decoration = const InputDecoration(),
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.style,
    this.textAlign = TextAlign.start,
    this.autofocus = false,
    this.obscureText = false,
    this.autocorrect = true,
    this.enableSuggestions = true,
    this.maxLines = 1,
    this.minLines,
    this.expands = false,
    this.maxLength,
    this.onChanged,
    this.onEditingComplete,
    this.onSubmitted,
    this.inputFormatters,
    this.enabled,
    this.readOnly = false,
    this.cursorColor,
    this.onTap,
    this.mouseCursor,
  });

  final TextEditingController? controller;
  final FocusNode? focusNode;
  final InputDecoration? decoration;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final TextStyle? style;
  final TextAlign textAlign;
  final bool autofocus;
  final bool obscureText;
  final bool autocorrect;
  final bool enableSuggestions;
  final int? maxLines;
  final int? minLines;
  final bool expands;
  final int? maxLength;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onEditingComplete;
  final ValueChanged<String>? onSubmitted;
  final List<TextInputFormatter>? inputFormatters;
  final bool? enabled;
  final bool readOnly;
  final Color? cursorColor;
  final GestureTapCallback? onTap;
  final MouseCursor? mouseCursor;

  @override
  State<TvTextField> createState() => _TvTextFieldState();
}

class _TvTextFieldState extends State<TvTextField> {
  FocusNode? _owned;
  FocusNode get _node => widget.focusNode ?? (_owned ??= FocusNode());

  @override
  void initState() {
    super.initState();
    _node.onKeyEvent = _onKeyEvent;
  }

  @override
  void didUpdateWidget(TvTextField old) {
    super.didUpdateWidget(old);
    if (old.focusNode != widget.focusNode) {
      old.focusNode?.onKeyEvent = null;
      _node.onKeyEvent = _onKeyEvent;
    }
  }

  @override
  void dispose() {
    widget.focusNode?.onKeyEvent = null;
    _owned?.dispose();
    super.dispose();
  }

  bool get _singleLine => !widget.expands && (widget.maxLines ?? 1) == 1;

  KeyEventResult _onKeyEvent(FocusNode node, KeyEvent e) {
    if (e is KeyUpEvent) return KeyEventResult.ignored;
    final k = e.logicalKey;
    // Back / Escape: drop the field's focus (which closes the IME) so the D-pad
    // is freed and the screen's own back handler can run.
    if (k == LogicalKeyboardKey.goBack || k == LogicalKeyboardKey.escape) {
      node.unfocus();
      return KeyEventResult.handled;
    }
    final sel = widget.controller?.selection;
    final len = widget.controller?.text.length ?? 0;
    final atStart = sel == null || !sel.isValid || sel.baseOffset <= 0;
    final atEnd = sel == null || !sel.isValid || sel.baseOffset >= len;
    if (k == LogicalKeyboardKey.arrowUp && (_singleLine || atStart)) {
      node.focusInDirection(TraversalDirection.up);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.arrowDown && (_singleLine || atEnd)) {
      node.focusInDirection(TraversalDirection.down);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.arrowLeft && atStart) {
      node.focusInDirection(TraversalDirection.left);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.arrowRight && atEnd) {
      node.focusInDirection(TraversalDirection.right);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    // A single-line field defaults its keyboard action to "Next" so the TV
    // on-screen keyboard advances to the following field in one press (Flutter's
    // default onEditingComplete moves focus on `next`), instead of a "Done" that
    // just closes the keyboard and strands the remote on the first field. The
    // caller's explicit action always wins (e.g. search fields use `.search`).
    final action =
        widget.textInputAction ??
        (_singleLine && !widget.readOnly ? TextInputAction.next : null);
    return TextField(
      controller: widget.controller,
      focusNode: _node,
      decoration: widget.decoration,
      keyboardType: widget.keyboardType,
      textInputAction: action,
      textCapitalization: widget.textCapitalization,
      style: widget.style,
      textAlign: widget.textAlign,
      autofocus: widget.autofocus,
      obscureText: widget.obscureText,
      autocorrect: widget.autocorrect,
      enableSuggestions: widget.enableSuggestions,
      maxLines: widget.maxLines,
      minLines: widget.minLines,
      expands: widget.expands,
      maxLength: widget.maxLength,
      onChanged: widget.onChanged,
      onEditingComplete: widget.onEditingComplete,
      onSubmitted: widget.onSubmitted,
      inputFormatters: widget.inputFormatters,
      enabled: widget.enabled,
      readOnly: widget.readOnly,
      cursorColor: widget.cursorColor,
      onTap: widget.onTap,
      mouseCursor: widget.mouseCursor,
    );
  }
}
