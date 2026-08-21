import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/nav/nav_items.dart';
import '../shell/nav_icons.dart';
import 'settings_controls.dart';
import '../../design/focus/tv_text_field.dart';

/// The navigation customization editor: reorder, rename, or hide the nav-bar
/// items. Ports the web nav-editor (`theme-studio/nav-editor.tsx` + `nav-row`),
/// writing `settings.navCustomization` via the existing [moveNavItem] /
/// [renameNavItem] / [toggleNavHidden] / [resetNavCustomization] helpers.
///
/// The web reorders by drag; on a remote this is done with up/down move buttons
/// (which call [moveNavItem] against the adjacent item) — same result, native to
/// the platform.
class NavCustomizationSection extends ConsumerWidget {
  const NavCustomizationSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final cfg = NavCustomization.fromMap(
      ref.watch(settingsProvider).getMap('navCustomization'),
    );
    final byId = {for (final it in kNavItems) it.id: it};
    final order = effectiveNavOrder(cfg);
    final hasChanges =
        cfg.order.isNotEmpty || cfg.hidden.isNotEmpty || cfg.renamed.isNotEmpty;

    void persist(NavCustomization next) => ref
        .read(settingsProvider.notifier)
        .setValue('navCustomization', next.toMap());

    return SettingsSection(
      tokens: t,
      title: 'Navigation',
      subtitle: 'Reorder, rename, or hide the items in the navigation bar.',
      children: [
        if (hasChanges)
          Align(
            alignment: Alignment.centerRight,
            child: Focusable(
              tokens: t,
              borderRadius: 8,
              onPressed: () => persist(resetNavCustomization()),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: t.raised,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: t.edgeSoft),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.restart_alt, size: 14, color: t.inkMuted),
                    const SizedBox(width: 6),
                    Text(
                      'Reset',
                      style: TextStyle(
                        color: t.inkMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        for (var i = 0; i < order.length; i++)
          _NavEditRow(
            key: ValueKey(order[i].name),
            tokens: t,
            icon: navIcon(order[i]),
            name: cfg.renamed[order[i].name] ?? byId[order[i]]!.label,
            hidden: cfg.hidden.contains(order[i].name),
            isRenamed: cfg.renamed.containsKey(order[i].name),
            canMoveUp: i > 0,
            canMoveDown: i < order.length - 1,
            onMoveUp: () => persist(
              moveNavItem(cfg, order[i].name, order[i - 1].name, 'before'),
            ),
            onMoveDown: () => persist(
              moveNavItem(cfg, order[i].name, order[i + 1].name, 'after'),
            ),
            onRename: (label) =>
                persist(renameNavItem(cfg, order[i].name, label)),
            onResetName: () => persist(renameNavItem(cfg, order[i].name, '')),
            onToggleHidden: () => persist(toggleNavHidden(cfg, order[i].name)),
          ),
      ],
    );
  }
}

class _NavEditRow extends StatefulWidget {
  const _NavEditRow({
    super.key,
    required this.tokens,
    required this.icon,
    required this.name,
    required this.hidden,
    required this.isRenamed,
    required this.canMoveUp,
    required this.canMoveDown,
    required this.onMoveUp,
    required this.onMoveDown,
    required this.onRename,
    required this.onResetName,
    required this.onToggleHidden,
  });

  final HarborTokens tokens;
  final IconData icon;
  final String name;
  final bool hidden;
  final bool isRenamed;
  final bool canMoveUp;
  final bool canMoveDown;
  final VoidCallback onMoveUp;
  final VoidCallback onMoveDown;
  final void Function(String) onRename;
  final VoidCallback onResetName;
  final VoidCallback onToggleHidden;

  @override
  State<_NavEditRow> createState() => _NavEditRowState();
}

class _NavEditRowState extends State<_NavEditRow> {
  late final TextEditingController _controller;
  late final FocusNode _focus;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.name);
    _focus = FocusNode()..addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(_NavEditRow old) {
    super.didUpdateWidget(old);
    // Keep the field in sync when the effective name changes elsewhere.
    if (old.name != widget.name && _controller.text != widget.name) {
      _controller.text = widget.name;
    }
  }

  @override
  void dispose() {
    _focus.removeListener(_onFocusChange);
    _focus.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _onFocusChange() {
    if (!_focus.hasFocus) _commit();
  }

  void _commit() {
    final v = _controller.text.trim();
    if (v != widget.name) widget.onRename(v);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return Opacity(
      opacity: widget.hidden ? 0.6 : 1,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          children: [
            _moveButton(
              t,
              Icons.keyboard_arrow_up,
              enabled: widget.canMoveUp,
              tooltip: 'Move up',
              onPressed: widget.onMoveUp,
            ),
            _moveButton(
              t,
              Icons.keyboard_arrow_down,
              enabled: widget.canMoveDown,
              tooltip: 'Move down',
              onPressed: widget.onMoveDown,
            ),
            const SizedBox(width: 6),
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: t.edgeSoft),
              ),
              child: Icon(widget.icon, size: 18, color: t.inkMuted),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TvTextField(
                controller: _controller,
                focusNode: _focus,
                onSubmitted: (_) => _commit(),
                onEditingComplete: _commit,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
                decoration: const InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                ),
              ),
            ),
            if (widget.isRenamed)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Focusable(
                  tokens: t,
                  borderRadius: 6,
                  onPressed: widget.onResetName,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: t.accentSoft,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'RENAMED',
                      style: TextStyle(
                        color: t.accent,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                ),
              ),
            Focusable(
              tokens: t,
              borderRadius: 9,
              onPressed: widget.onToggleHidden,
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: widget.hidden
                      ? t.danger.withValues(alpha: 0.15)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(
                  widget.hidden
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 17,
                  color: widget.hidden ? t.danger : t.inkSubtle,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _moveButton(
    HarborTokens t,
    IconData icon, {
    required bool enabled,
    required String tooltip,
    required VoidCallback onPressed,
  }) {
    if (!enabled) {
      return SizedBox(
        width: 26,
        height: 30,
        child: Icon(icon, size: 18, color: t.inkSubtle.withValues(alpha: 0.3)),
      );
    }
    return Focusable(
      tokens: t,
      borderRadius: 6,
      onPressed: onPressed,
      child: SizedBox(
        width: 26,
        height: 30,
        child: Icon(icon, size: 18, color: t.inkMuted),
      ),
    );
  }
}
