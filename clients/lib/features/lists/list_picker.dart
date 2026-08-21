import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/imported_lists_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/overlays/confirm_dialog.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/lists/list_types.dart';
import 'add_list_form.dart';
import 'source_dot.dart';

enum _Mode { list, add, edit }

/// The Library → My Lists picker: a trigger button (active list's source dot,
/// name, resolved item [count]) that opens a dropdown to select, add, edit, or
/// remove imported lists. Reads [importedListsProvider] live so mutations
/// reflect immediately. Ports the web `src/views/lists/list-picker.tsx`.
class ListPicker extends ConsumerWidget {
  const ListPicker({super.key, required this.count});

  /// The resolved item count of the active list, shown as a badge (or null
  /// while unknown / no active list).
  final int? count;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final state = ref.watch(importedListsProvider);
    final active = _activeOf(state);

    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: () => _open(context),
      child: Container(
        height: 44,
        padding: const EdgeInsets.only(left: 14, right: 12),
        decoration: BoxDecoration(
          color: t.elevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _dot(
              active == null ? t.inkSubtle : sourceDotColor(t, active.source),
            ),
            const SizedBox(width: 10),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 200),
              child: Text(
                active?.name ?? tr.t('No lists yet'),
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: t.canvas,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: t.inkMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ],
            const SizedBox(width: 6),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 18,
              color: t.inkSubtle,
            ),
          ],
        ),
      ),
    );
  }

  static ImportedList? _activeOf(ImportedListsState s) {
    for (final l in s.lists) {
      if (l.id == s.activeId) return l;
    }
    return null;
  }

  Widget _dot(Color color) => Container(
    width: 8,
    height: 8,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );

  void _open(BuildContext context) => showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'lists',
    barrierColor: Colors.black.withValues(alpha: 0.55),
    transitionDuration: const Duration(milliseconds: 140),
    pageBuilder: (_, _, _) => const _ListPickerDialog(),
    transitionBuilder: (_, anim, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
      child: ScaleTransition(
        scale: Tween(
          begin: 0.97,
          end: 1.0,
        ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
        child: child,
      ),
    ),
  );
}

class _ListPickerDialog extends ConsumerStatefulWidget {
  const _ListPickerDialog();

  @override
  ConsumerState<_ListPickerDialog> createState() => _ListPickerDialogState();
}

class _ListPickerDialogState extends ConsumerState<_ListPickerDialog> {
  _Mode _mode = _Mode.list;
  String? _editingId;
  String? _openActionsId;
  String? _copiedId;
  Timer? _copyTimer;

  @override
  void dispose() {
    _copyTimer?.cancel();
    super.dispose();
  }

  ImportedListsController get _controller =>
      ref.read(importedListsProvider.notifier);

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final state = ref.watch(importedListsProvider);

    return Center(
      child: FocusTraversalGroup(
        child: Material(
          color: Colors.transparent,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 360,
              maxHeight: MediaQuery.of(context).size.height * 0.7,
            ),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              decoration: BoxDecoration(
                color: t.elevated,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: t.edge),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.55),
                    blurRadius: 44,
                    offset: const Offset(0, 18),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: switch (_mode) {
                _Mode.list => _listMode(t, tr, state),
                _Mode.add => AddListForm(
                  submitLabel: tr.t('Add'),
                  onCancel: () => setState(() => _mode = _Mode.list),
                  onSubmit: (ref_, name) {
                    _controller.addList(ref_, name: name);
                    Navigator.of(context).pop();
                  },
                ),
                _Mode.edit => _editMode(tr, state),
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _editMode(Translations tr, ImportedListsState state) {
    final editing = _byId(state, _editingId);
    if (editing == null) {
      // The list vanished (e.g. removed elsewhere) — fall back to the list.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _mode = _Mode.list);
      });
      return const SizedBox.shrink();
    }
    return AddListForm(
      key: ValueKey(editing.id),
      initialRef: editing.ref,
      initialName: editing.name,
      submitLabel: tr.t('Save'),
      onCancel: () => setState(() {
        _mode = _Mode.list;
        _editingId = null;
      }),
      onSubmit: (ref_, name) {
        _controller.editList(editing.id, ref_, name: name);
        setState(() {
          _mode = _Mode.list;
          _editingId = null;
        });
      },
    );
  }

  /// The index of the list row to autofocus: the active list, or the first.
  int _focusIndex(ImportedListsState state) {
    final active = state.lists.indexWhere((l) => l.id == state.activeId);
    return active >= 0 ? active : 0;
  }

  Widget _listMode(HarborTokens t, Translations tr, ImportedListsState state) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (state.lists.isEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(
                        tr.t('No lists saved yet.'),
                        style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                      ),
                    ),
                  ),
                // Autofocus the active list (else the first) so a TV remote
                // lands on a control the moment the picker opens.
                for (final (i, l) in state.lists.indexed)
                  _row(
                    t,
                    tr,
                    l,
                    isActive: l.id == state.activeId,
                    autofocus: _focusIndex(state) == i,
                  ),
              ],
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: t.edgeSoft)),
          ),
          padding: const EdgeInsets.all(6),
          child: Focusable(
            tokens: t,
            borderRadius: 10,
            scale: 1.0,
            // With no lists yet, "Add a list" is the only action — focus it.
            autofocus: state.lists.isEmpty,
            onPressed: () => setState(() => _mode = _Mode.add),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              child: Row(
                children: [
                  Icon(Icons.add_rounded, size: 16, color: t.inkMuted),
                  const SizedBox(width: 10),
                  Text(
                    tr.t('Add a list'),
                    style: TextStyle(
                      color: t.inkMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _row(
    HarborTokens t,
    Translations tr,
    ImportedList l, {
    required bool isActive,
    bool autofocus = false,
  }) {
    final actionsOpen = _openActionsId == l.id;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          color: isActive ? t.raised : Colors.transparent,
          child: Row(
            children: [
              Expanded(
                child: Focusable(
                  tokens: t,
                  borderRadius: 0,
                  scale: 1.0,
                  autofocus: autofocus,
                  onPressed: () {
                    _controller.selectId(l.id);
                    Navigator.of(context).pop();
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 11,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: isActive
                                ? sourceDotColor(t, l.source)
                                : t.inkSubtle,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            l.name,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: isActive ? t.ink : t.inkMuted,
                              fontSize: 13.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Focusable(
                  tokens: t,
                  borderRadius: 8,
                  scale: 1.0,
                  onPressed: () => setState(
                    () => _openActionsId = actionsOpen ? null : l.id,
                  ),
                  child: SizedBox(
                    width: 32,
                    height: 32,
                    child: Icon(
                      Icons.more_horiz_rounded,
                      size: 16,
                      color: actionsOpen ? t.ink : t.inkSubtle,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (actionsOpen) _rowActions(t, tr, l),
      ],
    );
  }

  Widget _rowActions(HarborTokens t, Translations tr, ImportedList l) {
    final copied = _copiedId == l.id;
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 2, 10, 8),
      decoration: BoxDecoration(
        color: t.canvas,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _actionButton(
            t,
            icon: Icons.edit_outlined,
            label: tr.t('Edit'),
            onPressed: () => setState(() {
              _editingId = l.id;
              _mode = _Mode.edit;
              _openActionsId = null;
            }),
          ),
          _actionButton(
            t,
            icon: copied ? Icons.check_rounded : Icons.copy_rounded,
            label: copied ? tr.t('Copied to clipboard') : tr.t('Copy URL'),
            accent: copied,
            onPressed: () => _copy(l),
          ),
          _actionButton(
            t,
            icon: Icons.delete_outline_rounded,
            label: tr.t('Delete'),
            danger: true,
            onPressed: () => _delete(t, tr, l),
          ),
          Container(
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: t.edgeSoft)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text(
              tr.t('From {source}', {'source': l.source.label}).toUpperCase(),
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 10,
                letterSpacing: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionButton(
    HarborTokens t, {
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    bool danger = false,
    bool accent = false,
  }) {
    final color = danger
        ? t.danger
        : accent
        ? t.accent
        : t.inkMuted;
    return Focusable(
      tokens: t,
      borderRadius: 0,
      scale: 1.0,
      onPressed: onPressed,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        child: Row(
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 10),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _copy(ImportedList l) {
    Clipboard.setData(ClipboardData(text: l.ref));
    setState(() => _copiedId = l.id);
    _copyTimer?.cancel();
    _copyTimer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted && _copiedId == l.id) setState(() => _copiedId = null);
    });
  }

  Future<void> _delete(HarborTokens t, Translations tr, ImportedList l) async {
    final ok = await showConfirmDialog(
      context: context,
      tokens: t,
      message: tr.t('Remove list "{name}"?', {'name': l.name}),
      confirmLabel: tr.t('Delete'),
      cancelLabel: tr.t('Cancel'),
    );
    if (!ok || !mounted) return;
    _controller.removeList(l.id);
    setState(() => _openActionsId = null);
  }

  ImportedList? _byId(ImportedListsState state, String? id) {
    if (id == null) return null;
    for (final l in state.lists) {
      if (l.id == id) return l;
    }
    return null;
  }
}
