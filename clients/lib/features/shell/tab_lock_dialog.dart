import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/profiles/parental.dart';

/// The Material icon shown for each lockable tab, matching the sidebar nav.
const Map<String, IconData> _tabIcons = {
  'discover': Icons.explore_outlined,
  'movies': Icons.movie_outlined,
  'shows': Icons.tv_outlined,
  'anime': Icons.auto_awesome_outlined,
  'sports': Icons.sports_basketball_outlined,
  'liveTv': Icons.live_tv_outlined,
  'calendar': Icons.calendar_month_outlined,
  'library': Icons.video_library_outlined,
  'addons': Icons.extension_outlined,
};

/// Opens the "Lock sidebar tabs" picker and resolves to the chosen locked-tab
/// list in canonical order (empty when none), or null if the user backs out.
/// Ported from the web editor `TabsView`.
Future<List<String>?> showTabLockDialog(
  BuildContext context, {
  required HarborTokens tokens,
  required Translations tr,
  required List<String> initial,
}) {
  return showDialog<List<String>>(
    context: context,
    builder: (_) => _TabLockDialog(tokens: tokens, tr: tr, initial: initial),
  );
}

class _TabLockDialog extends StatefulWidget {
  const _TabLockDialog({
    required this.tokens,
    required this.tr,
    required this.initial,
  });

  final HarborTokens tokens;
  final Translations tr;
  final List<String> initial;

  @override
  State<_TabLockDialog> createState() => _TabLockDialogState();
}

class _TabLockDialogState extends State<_TabLockDialog> {
  late final Set<String> _locked = {...widget.initial};

  List<String> get _ordered => [
    for (final t in kLockableTabs)
      if (_locked.contains(t.key)) t.key,
  ];

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = widget.tr;
    final count = _locked.length;
    return Dialog(
      backgroundColor: t.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                tr.t('Sidebar access').toUpperCase(),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 3.2,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                tr.t('Lock sidebar tabs'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                tr.t('Locks only activate once a PIN is set.'),
                textAlign: TextAlign.center,
                style: TextStyle(color: t.inkMuted, fontSize: 12.5),
              ),
              const SizedBox(height: 16),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 320),
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      // Autofocus the first toggle so a TV remote lands on a
                      // control the moment the dialog opens.
                      for (final (i, tab) in kLockableTabs.indexed)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: _row(t, tr, tab, autofocus: i == 0),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      count == 0
                          ? tr.t('No tabs selected')
                          : tr.t('{n} tabs locked', {'n': count}),
                      style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                    ),
                  ),
                  Focusable(
                    tokens: t,
                    borderRadius: 12,
                    onPressed: () => Navigator.of(context).pop(_ordered),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 11,
                      ),
                      decoration: BoxDecoration(
                        color: t.ink,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        tr.t('Save'),
                        style: TextStyle(
                          color: t.canvas,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
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
    );
  }

  Widget _row(
    HarborTokens t,
    Translations tr,
    LockableTab tab, {
    bool autofocus = false,
  }) {
    final on = _locked.contains(tab.key);
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 12,
      autofocus: autofocus,
      onPressed: () => setState(() {
        if (on) {
          _locked.remove(tab.key);
        } else {
          _locked.add(tab.key);
        }
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: on ? t.canvas.withValues(alpha: 0.6) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: on ? t.ink.withValues(alpha: 0.4) : t.edgeSoft,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: on ? t.ink : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: on ? t.ink : t.edge, width: 2),
              ),
              child: on
                  ? Icon(Icons.check_rounded, size: 13, color: t.canvas)
                  : null,
            ),
            const SizedBox(width: 12),
            Icon(
              _tabIcons[tab.key] ?? Icons.tab_outlined,
              size: 18,
              color: on ? t.ink : t.inkMuted,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                tr.t(tab.label),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (on) Icon(Icons.lock_rounded, size: 13, color: t.inkMuted),
          ],
        ),
      ),
    );
  }
}
