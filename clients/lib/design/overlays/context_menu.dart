import 'package:flutter/material.dart';

import '../focus/focusable.dart';
import '../tokens.dart';

/// One row in a [showContextMenu] popup: an icon, a label, and the value
/// returned when it is chosen.
class ContextMenuAction<T> {
  const ContextMenuAction({
    required this.value,
    required this.label,
    required this.icon,
    this.danger = false,
  });

  final T value;
  final String label;
  final IconData icon;

  /// Tints the row in the danger colour (destructive actions).
  final bool danger;
}

/// Shows a focus-trapped context menu — the native, remote-operable counterpart
/// of Harbor's right-click `EpisodeWatchedMenu`/context menus (`10-pages.md`,
/// overlays). Opens as a modal barrier that dismisses on Back/Escape or an
/// outside tap, autofocuses the first action for the D-pad, and resolves to the
/// chosen action's value (or `null` when dismissed).
Future<T?> showContextMenu<T>({
  required BuildContext context,
  required HarborTokens tokens,
  required List<ContextMenuAction<T>> actions,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    transitionDuration: const Duration(milliseconds: 120),
    pageBuilder: (ctx, _, _) =>
        _ContextMenu<T>(tokens: tokens, actions: actions),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
      child: child,
    ),
  );
}

class _ContextMenu<T> extends StatelessWidget {
  const _ContextMenu({required this.tokens, required this.actions});

  final HarborTokens tokens;
  final List<ContextMenuAction<T>> actions;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Center(
      child: FocusTraversalGroup(
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: 260,
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: t.elevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: t.edge),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.55),
                  blurRadius: 40,
                  offset: const Offset(0, 18),
                ),
              ],
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.7,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final (i, a) in actions.indexed)
                      Focusable(
                        tokens: t,
                        autofocus: i == 0,
                        borderRadius: 10,
                        scale: 1.0,
                        onPressed: () => Navigator.of(context).pop(a.value),
                        child: Container(
                          height: 44,
                          alignment: Alignment.centerLeft,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Row(
                            children: [
                              Icon(
                                a.icon,
                                size: 16,
                                color: a.danger ? t.danger : t.inkMuted,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  a.label,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: a.danger ? t.danger : t.ink,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
