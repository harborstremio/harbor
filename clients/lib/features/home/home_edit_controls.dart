import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/focus/tv_text_field.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';

/// A small round icon control used across the Home edit-mode bars. A real focus
/// node so the TV remote reaches it; disabled controls are skipped by the caller
/// (never rendered) so focus never lands on a dead button.
class _EditIcon extends StatelessWidget {
  const _EditIcon({
    required this.tokens,
    required this.icon,
    required this.onPressed,
    this.active = false,
    this.danger = false,
  });

  final HarborTokens tokens;
  final IconData icon;
  final VoidCallback onPressed;
  final bool active;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final fg = danger
        ? tokens.danger
        : active
        ? tokens.accent
        : tokens.inkMuted;
    final bg = active
        ? tokens.accent.withValues(alpha: 0.15)
        : tokens.raised.withValues(alpha: 0.6);
    return Focusable(
      tokens: tokens,
      borderRadius: 10,
      scale: 1.12,
      focusColor: danger ? tokens.danger : tokens.accent,
      onPressed: onPressed,
      child: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 17, color: fg),
      ),
    );
  }
}

/// A labelled pill button (the customize bar's Reset / Customize / Done).
class _EditPill extends StatelessWidget {
  const _EditPill({
    required this.tokens,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.filled = false,
  });

  final HarborTokens tokens;
  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final fg = filled ? tokens.canvas : tokens.inkMuted;
    return Focusable(
      tokens: tokens,
      borderRadius: 9,
      scale: 1.08,
      onPressed: onPressed,
      child: Container(
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: filled ? tokens.ink : tokens.raised.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: filled ? tokens.ink : tokens.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: fg),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: fg,
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

/// The Home customize bar, ported from the web `CustomizeBar`: toggles edit mode
/// and (in edit mode, when there are changes) offers Reset. "Add from lists" and
/// "Add Source" land with their respective slices.
class HomeCustomizeBar extends StatelessWidget {
  const HomeCustomizeBar({
    super.key,
    required this.tokens,
    required this.tr,
    required this.editMode,
    required this.hasChanges,
    required this.onToggleEdit,
    required this.onReset,
    this.availableListRows = const [],
    this.onAddListRow,
    this.onAddSource,
  });

  final HarborTokens tokens;
  final Translations tr;
  final bool editMode;
  final bool hasChanges;
  final VoidCallback onToggleEdit;
  final VoidCallback onReset;

  /// Custom lists (id + name) not yet pinned to Home, offered by the "Add from
  /// lists" menu in edit mode. Ported from the web CustomizeBar list dropdown.
  final List<({String id, String name})> availableListRows;
  final ValueChanged<String>? onAddListRow;

  /// Opens the "Add Custom Source" modal (edit mode). Ports the web CustomizeBar
  /// `onAddSource`.
  final VoidCallback? onAddSource;

  Future<void> _openAddList(BuildContext context) async {
    final id = await showContextMenu<String>(
      context: context,
      tokens: tokens,
      actions: [
        for (final l in availableListRows)
          ContextMenuAction(
            value: l.id,
            label: l.name,
            icon: Icons.playlist_add,
          ),
      ],
    );
    if (id != null) onAddListRow?.call(id);
  }

  @override
  Widget build(BuildContext context) {
    final canAddList =
        editMode && onAddListRow != null && availableListRows.isNotEmpty;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (editMode && hasChanges) ...[
          _EditPill(
            tokens: tokens,
            icon: Icons.restart_alt,
            label: tr.t('Reset'),
            onPressed: onReset,
          ),
          const SizedBox(width: 8),
        ],
        if (canAddList) ...[
          _EditPill(
            tokens: tokens,
            icon: Icons.playlist_add,
            label: tr.t('Add from lists'),
            onPressed: () => _openAddList(context),
          ),
          const SizedBox(width: 8),
        ],
        if (editMode && onAddSource != null) ...[
          _EditPill(
            tokens: tokens,
            icon: Icons.create_new_folder_outlined,
            label: tr.t('Add Source'),
            onPressed: onAddSource!,
          ),
          const SizedBox(width: 8),
        ],
        _EditPill(
          tokens: tokens,
          icon: Icons.edit_outlined,
          label: editMode ? tr.t('Done editing') : tr.t('Customize home'),
          filled: editMode,
          onPressed: onToggleEdit,
        ),
      ],
    );
  }
}

/// The per-row edit controls shown above a customizable Home row in edit mode.
/// Ported from the web `RowControls`: move up/down, hide/show, Top-10 numerals
/// toggle, and inline rename. Every affordance is a real focus node so the TV
/// remote can reach it; a disabled move button is omitted (never a dead target).
///
/// The web's "feature in hero" (Sparkles) toggle, custom-source delete, and the
/// bar's Add-Source / Add-from-lists actions land with their own slices (the
/// `heroSource` / `customSources` / `listRows` model fields already round-trip).
class HomeRowControls extends StatefulWidget {
  const HomeRowControls({
    super.key,
    required this.tokens,
    required this.tr,
    required this.name,
    required this.hidden,
    required this.canMoveUp,
    required this.canMoveDown,
    required this.isRenamed,
    required this.numeralsActive,
    required this.canNumerals,
    required this.heroActive,
    required this.canHero,
    required this.onMoveUp,
    required this.onMoveDown,
    required this.onToggleHidden,
    required this.onRename,
    required this.onResetName,
    required this.onToggleNumerals,
    required this.onToggleHero,
  });

  final HarborTokens tokens;
  final Translations tr;
  final String name;
  final bool hidden;
  final bool canMoveUp;
  final bool canMoveDown;
  final bool isRenamed;
  final bool numeralsActive;
  final bool canNumerals;
  final bool heroActive;
  final bool canHero;
  final VoidCallback onMoveUp;
  final VoidCallback onMoveDown;
  final VoidCallback onToggleHidden;
  final ValueChanged<String> onRename;
  final VoidCallback onResetName;
  final VoidCallback onToggleNumerals;
  final VoidCallback onToggleHero;

  @override
  State<HomeRowControls> createState() => _HomeRowControlsState();
}

class _HomeRowControlsState extends State<HomeRowControls> {
  bool _editing = false;
  late final TextEditingController _draft = TextEditingController(
    text: widget.name,
  );
  final FocusNode _fieldFocus = FocusNode();

  @override
  void dispose() {
    _draft.dispose();
    _fieldFocus.dispose();
    super.dispose();
  }

  void _startEditing() {
    setState(() => _editing = true);
    _draft.text = widget.name;
    _draft.selection = TextSelection(
      baseOffset: 0,
      extentOffset: _draft.text.length,
    );
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _fieldFocus.requestFocus(),
    );
  }

  void _commit() {
    final next = _draft.text.trim();
    if (next.isNotEmpty && next != widget.name) widget.onRename(next);
    setState(() => _editing = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = widget.tr;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 0, 0, 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: t.surface.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: t.edgeSoft),
        ),
        child: FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: _editing ? _buildEditing(t, tr) : _buildIdle(t, tr),
        ),
      ),
    );
  }

  Widget _buildIdle(HarborTokens t, Translations tr) {
    return Row(
      children: [
        if (widget.canMoveUp) ...[
          _EditIcon(
            tokens: t,
            icon: Icons.arrow_upward,
            onPressed: widget.onMoveUp,
          ),
          const SizedBox(width: 6),
        ],
        if (widget.canMoveDown) ...[
          _EditIcon(
            tokens: t,
            icon: Icons.arrow_downward,
            onPressed: widget.onMoveDown,
          ),
          const SizedBox(width: 6),
        ],
        _EditIcon(
          tokens: t,
          icon: widget.hidden ? Icons.visibility_off : Icons.visibility,
          active: widget.hidden,
          danger: widget.hidden,
          onPressed: widget.onToggleHidden,
        ),
        const SizedBox(width: 6),
        if (widget.canNumerals || widget.numeralsActive) ...[
          _EditIcon(
            tokens: t,
            icon: Icons.format_list_numbered,
            active: widget.numeralsActive,
            onPressed: widget.onToggleNumerals,
          ),
          const SizedBox(width: 6),
        ],
        // "Feature in the hero carousel": disabled (omitted) unless the row has
        // artwork-rich titles or is already the hero source.
        if (widget.canHero || widget.heroActive) ...[
          _EditIcon(
            tokens: t,
            icon: Icons.auto_awesome,
            active: widget.heroActive,
            onPressed: widget.onToggleHero,
          ),
          const SizedBox(width: 6),
        ],
        _EditIcon(
          tokens: t,
          icon: Icons.edit_outlined,
          onPressed: _startEditing,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            widget.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: t.ink,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        if (widget.isRenamed)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Focusable(
              tokens: t,
              borderRadius: 8,
              onPressed: widget.onResetName,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: t.accent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  tr.t('Renamed'),
                  style: TextStyle(
                    color: t.accent,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildEditing(HarborTokens t, Translations tr) {
    return Row(
      children: [
        Expanded(
          child: TvTextField(
            controller: _draft,
            focusNode: _fieldFocus,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _commit(),
            style: TextStyle(
              color: t.ink,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 8,
              ),
              filled: true,
              fillColor: t.raised,
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: t.edgeSoft),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: t.accent),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        _EditIcon(
          tokens: t,
          icon: Icons.check,
          active: true,
          onPressed: _commit,
        ),
        const SizedBox(width: 6),
        _EditIcon(
          tokens: t,
          icon: Icons.close,
          onPressed: () => setState(() => _editing = false),
        ),
      ],
    );
  }
}

/// The hide/show control for a fixed Home section (hero, Top 10, Collections),
/// shown only in edit mode. Ported from the web `PinnedRowControls`.
class HomePinnedRowControls extends StatelessWidget {
  const HomePinnedRowControls({
    super.key,
    required this.tokens,
    required this.tr,
    required this.label,
    required this.hidden,
    required this.onToggleHidden,
  });

  final HarborTokens tokens;
  final Translations tr;
  final String label;
  final bool hidden;
  final VoidCallback onToggleHidden;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 0, 0, 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: t.surface.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: t.accent.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                tr.t('Pinned'),
                style: TextStyle(
                  color: t.accent,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (hidden)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Text(
                  tr.t('· currently hidden'),
                  style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                ),
              ),
            _EditPill(
              tokens: t,
              icon: hidden ? Icons.visibility : Icons.visibility_off,
              label: hidden ? tr.t('Show') : tr.t('Hide'),
              onPressed: onToggleHidden,
            ),
          ],
        ),
      ),
    );
  }
}

/// The edit-mode control bar above a custom-source shelf: a SOURCE chip, the
/// shelf name, and a Delete pill. Ported from the web source-row delete affordance
/// (`onDeleteCustomSource`).
class HomeSourceRowControls extends StatelessWidget {
  const HomeSourceRowControls({
    super.key,
    required this.tokens,
    required this.tr,
    required this.label,
    required this.onDelete,
  });

  final HarborTokens tokens;
  final Translations tr;
  final String label;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 0, 0, 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: t.surface.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: t.accent.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                tr.t('Source'),
                style: TextStyle(
                  color: t.accent,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            _EditPill(
              tokens: t,
              icon: Icons.delete_outline,
              label: tr.t('Delete'),
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}
