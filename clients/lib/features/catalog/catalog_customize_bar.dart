import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';

/// The catalog customize bar — a Customize/Done toggle plus a Reset pill when
/// something has changed. Shared by Discover and the Movies/Shows tabs, ported
/// from the web `CatalogCustomizeBar`.
class CatalogCustomizeBar extends StatelessWidget {
  const CatalogCustomizeBar({
    super.key,
    required this.editMode,
    required this.hasChanges,
    required this.onToggle,
    required this.onReset,
    required this.tokens,
    required this.tr,
  });

  final bool editMode;
  final bool hasChanges;
  final VoidCallback onToggle;
  final VoidCallback onReset;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (editMode && hasChanges) ...[
          _pill(tr.t('Reset'), Icons.refresh, false, onReset),
          const SizedBox(width: 8),
        ],
        _pill(
          editMode ? tr.t('Done') : tr.t('Customize'),
          editMode ? Icons.check : Icons.tune,
          editMode,
          onToggle,
        ),
      ],
    );
  }

  Widget _pill(String label, IconData icon, bool filled, VoidCallback onTap) {
    return Focusable(
      tokens: tokens,
      borderRadius: 999,
      onPressed: onTap,
      child: Container(
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: filled ? tokens.ink : tokens.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: tokens.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: filled ? tokens.canvas : tokens.inkMuted,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: filled ? tokens.canvas : tokens.ink,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
