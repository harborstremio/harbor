import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Lets a D-pad escape a focused text input.
///
/// A bare [TextField] hands every arrow key to `EditableText`'s text-editing
/// shortcuts, so on a TV remote focus enters the field and can never leave it —
/// vertical presses are swallowed by the editor instead of moving focus. This
/// handler intercepts the vertical D-pad presses (which a single-line editor has
/// no use for anyway) and walks focus instead, leaving left/right to the caret.
///
/// Pass it to every settings text input so a remote can always get back out:
/// `FocusNode(onKeyEvent: escapeTextFieldOnVerticalDpad)`, or use
/// [escapableTextFieldNode].
KeyEventResult escapeTextFieldOnVerticalDpad(FocusNode node, KeyEvent event) {
  if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
    return KeyEventResult.ignored;
  }
  final key = event.logicalKey;
  if (key == LogicalKeyboardKey.arrowUp) {
    return node.focusInDirection(TraversalDirection.up)
        ? KeyEventResult.handled
        : KeyEventResult.ignored;
  }
  if (key == LogicalKeyboardKey.arrowDown) {
    return node.focusInDirection(TraversalDirection.down)
        ? KeyEventResult.handled
        : KeyEventResult.ignored;
  }
  return KeyEventResult.ignored;
}

/// A [FocusNode] for a text input that a D-pad can always escape vertically.
FocusNode escapableTextFieldNode({String? debugLabel}) => FocusNode(
  debugLabel: debugLabel,
  onKeyEvent: escapeTextFieldOnVerticalDpad,
);
