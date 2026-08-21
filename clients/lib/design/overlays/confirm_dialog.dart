import 'package:flutter/material.dart';

import '../focus/focusable.dart';
import '../tokens.dart';

/// Shows a focus-trapped yes/no confirmation and resolves to whether the user
/// confirmed (false on cancel or dismiss). The native, remote-operable
/// counterpart of the web `confirmDialog`. The cancel action autofocuses so an
/// accidental Enter is a no-op.
Future<bool> showConfirmDialog({
  required BuildContext context,
  required HarborTokens tokens,
  required String message,
  required String confirmLabel,
  required String cancelLabel,
  bool danger = true,
}) async {
  final result = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    transitionDuration: const Duration(milliseconds: 120),
    pageBuilder: (ctx, _, _) => _ConfirmDialog(
      tokens: tokens,
      message: message,
      confirmLabel: confirmLabel,
      cancelLabel: cancelLabel,
      danger: danger,
    ),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
      child: child,
    ),
  );
  return result ?? false;
}

class _ConfirmDialog extends StatelessWidget {
  const _ConfirmDialog({
    required this.tokens,
    required this.message,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.danger,
  });

  final HarborTokens tokens;
  final String message;
  final String confirmLabel;
  final String cancelLabel;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Center(
      child: FocusTraversalGroup(
        child: Material(
          color: Colors.transparent,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 32),
              padding: const EdgeInsets.all(20),
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
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    message,
                    style: TextStyle(color: t.ink, fontSize: 15, height: 1.4),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Focusable(
                        tokens: t,
                        autofocus: true,
                        borderRadius: 10,
                        onPressed: () => Navigator.of(context).pop(false),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 9,
                          ),
                          child: Text(
                            cancelLabel,
                            style: TextStyle(
                              color: t.inkMuted,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Focusable(
                        tokens: t,
                        borderRadius: 10,
                        focusColor: danger ? t.danger : t.accent,
                        onPressed: () => Navigator.of(context).pop(true),
                        child: Container(
                          decoration: BoxDecoration(
                            color: danger ? t.danger : t.accent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 9,
                          ),
                          child: Text(
                            confirmLabel,
                            style: TextStyle(
                              color: t.canvas,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
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
}
