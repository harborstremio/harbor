import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/saved_filter_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/text_field_escape.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/streams/custom_filter.dart';
import '../picker/filter_builder.dart';
import 'settings_controls.dart';
import '../../design/focus/tv_text_field.dart';

/// The "Saved stream filters" settings panel — manage the named custom filters
/// that can be applied in the source picker. A 1:1 port of the web
/// `StreamFiltersPanel`: list saved filters with an inline rename, a summary
/// chip, edit (reopens the builder) and delete, plus "New filter". The builder,
/// model, persistence and picker application already exist in clientv2; this is
/// the settings-page management surface.
class StreamFiltersSection extends ConsumerStatefulWidget {
  const StreamFiltersSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  ConsumerState<StreamFiltersSection> createState() =>
      _StreamFiltersSectionState();
}

class _StreamFiltersSectionState extends ConsumerState<StreamFiltersSection> {
  final _names = <String, TextEditingController>{};
  final _focus = <String, FocusNode>{};

  @override
  void dispose() {
    for (final c in _names.values) {
      c.dispose();
    }
    for (final f in _focus.values) {
      f.dispose();
    }
    super.dispose();
  }

  SavedStreamFiltersController get _ctrl =>
      ref.read(savedStreamFiltersProvider.notifier);

  TextEditingController _nameCtrl(CustomStreamFilter f) =>
      _names.putIfAbsent(f.id, () => TextEditingController(text: f.name));

  FocusNode _nameFocus(String id) => _focus.putIfAbsent(id, () {
    // Escapable so a TV remote can leave the rename field vertically.
    final node = escapableTextFieldNode(debugLabel: 'filter-name-$id');
    node.addListener(() {
      if (!node.hasFocus) _commitRename(id);
    });
    return node;
  });

  /// Persists an inline rename on focus loss (avoiding a per-keystroke write
  /// race); an emptied field reverts to the stored name.
  void _commitRename(String id) {
    final ctrl = _names[id];
    if (ctrl == null) return;
    final filters = ref.read(savedStreamFiltersProvider);
    final current = filters.where((f) => f.id == id).firstOrNull;
    if (current == null) return;
    final text = ctrl.text.trim();
    if (text.isEmpty) {
      ctrl.text = current.name;
      return;
    }
    if (text != current.name) _ctrl.save(current.copyWith(name: text));
  }

  Future<void> _new() async {
    final result = await showFilterBuilder(context, tokens: widget.tokens);
    await _apply(result);
  }

  Future<void> _edit(CustomStreamFilter f) async {
    final result = await showFilterBuilder(
      context,
      tokens: widget.tokens,
      initial: f,
    );
    await _apply(result);
  }

  Future<void> _apply(FilterBuilderResult? result) async {
    if (result is FilterSaved) {
      await _ctrl.save(result.filter);
    } else if (result is FilterDeleted) {
      await _ctrl.remove(result.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final filters = ref.watch(savedStreamFiltersProvider);

    // Keep the inline fields in sync with builder-driven name changes, but never
    // clobber what the user is currently typing.
    for (final f in filters) {
      final ctrl = _names[f.id];
      if (ctrl != null &&
          !(_focus[f.id]?.hasFocus ?? false) &&
          ctrl.text != f.name) {
        ctrl.text = f.name;
      }
    }

    return SettingsSection(
      tokens: t,
      title: tr.t('Saved stream filters'),
      subtitle: tr.t(
        "Build a named filter once, then apply it in the source picker to hide "
        "everything that doesn't match. Each filter ANDs its dimensions and "
        "ignores any you leave blank.",
      ),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: t.canvas.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.filter_alt_outlined, color: t.inkSubtle, size: 13),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      // Uppercase eyebrow, matching web's `uppercase
                      // tracking-[0.16em]` and the sibling settings controls.
                      tr.t('Your filters').toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: t.inkSubtle,
                        fontSize: 11.5,
                        letterSpacing: 1.6,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _newButton(t, tr),
                ],
              ),
              const SizedBox(height: 12),
              if (filters.isEmpty)
                _emptyState(t, tr)
              else
                for (final f in filters) ...[
                  _filterRow(t, tr, f),
                  if (f != filters.last) const SizedBox(height: 8),
                ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _newButton(HarborTokens t, Translations tr) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: _new,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: t.accentSoft,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.accent),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.add, color: t.accent, size: 14),
          const SizedBox(width: 6),
          Text(
            tr.t('New filter'),
            style: TextStyle(
              color: t.accent,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _emptyState(HarborTokens t, Translations tr) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.25),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(
        color: t.edgeSoft.withValues(alpha: 0.6),
        style: BorderStyle.solid,
      ),
    ),
    child: Text(
      tr.t('No saved filters yet. Hit New filter to build one.'),
      textAlign: TextAlign.center,
      style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
    ),
  );

  Widget _filterRow(
    HarborTokens t,
    Translations tr,
    CustomStreamFilter f,
  ) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TvTextField(
                controller: _nameCtrl(f),
                focusNode: _nameFocus(f.id),
                maxLength: 60,
                autocorrect: false,
                enableSuggestions: false,
                onSubmitted: (_) => _commitRename(f.id),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
                cursorColor: t.accent,
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  counterText: '',
                  hintText: tr.t('Untitled filter'),
                  hintStyle: TextStyle(color: t.inkSubtle, fontSize: 13),
                ),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: t.canvas.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: t.edgeSoft.withValues(alpha: 0.6)),
                ),
                child: Text(
                  summarizeFilter(f),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: t.inkMuted, fontSize: 11),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        _iconButton(
          t,
          icon: Icons.edit_outlined,
          label: tr.t('Edit'),
          onPressed: () => _edit(f),
        ),
        const SizedBox(width: 4),
        _iconButton(
          t,
          icon: Icons.delete_outline,
          onPressed: () => _ctrl.remove(f.id),
          danger: true,
        ),
      ],
    ),
  );

  Widget _iconButton(
    HarborTokens t, {
    required IconData icon,
    required VoidCallback onPressed,
    String? label,
    bool danger = false,
  }) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onPressed,
    child: Container(
      padding: EdgeInsets.symmetric(
        horizontal: label != null ? 10 : 7,
        vertical: 7,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: danger ? t.danger : t.inkMuted, size: 14),
          if (label != null) ...[
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: t.inkMuted,
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    ),
  );
}
