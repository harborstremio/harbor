import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/streams/custom_filter.dart';
import '../../domain/streams/stream_facets.dart';

/// One facet dimension's row state: its [dim], the [options] available given the
/// other active facets, the [total] streams in that base, and the selected
/// [value] (`"all"` when unset). Ports the web `FacetRowEntry`.
class FacetRowEntry {
  const FacetRowEntry({
    required this.dim,
    required this.options,
    required this.total,
    required this.value,
  });

  final FacetDim dim;
  final List<FacetOption> options;
  final int total;
  final String value;
}

/// The play-picker facet filter row: a chip per dimension that opens a
/// focus-trapped menu of its options (each with a stream count and a check on
/// the current selection), the saved custom-filter chips (each editable), a
/// New-filter button, and a Reset chip once anything is narrowed. Fully
/// remote-navigable. Ports web `FacetMenuRow`.
class FacetMenuRow extends StatelessWidget {
  const FacetMenuRow({
    super.key,
    required this.entries,
    required this.tokens,
    required this.onFacet,
    required this.onReset,
    this.filters = const [],
    this.activeFilterId,
    required this.onSelectFilter,
    required this.onNewFilter,
    required this.onEditFilter,
  });

  final List<FacetRowEntry> entries;
  final HarborTokens tokens;
  final void Function(String key, String value) onFacet;
  final VoidCallback onReset;

  /// The saved custom stream filters.
  final List<CustomStreamFilter> filters;

  /// The currently-applied saved filter's id, or null.
  final String? activeFilterId;

  /// Selects (or, with null, clears) the active saved filter.
  final void Function(String? id) onSelectFilter;

  /// Opens the builder for a new filter.
  final VoidCallback onNewFilter;

  /// Opens the builder to edit [filter].
  final void Function(CustomStreamFilter filter) onEditFilter;

  @override
  Widget build(BuildContext context) {
    // A dimension is shown only when it can narrow (≥2 options) or is active.
    final visible = [
      for (final e in entries)
        if (e.options.length >= 2 || e.value != 'all') e,
    ];
    final narrowed =
        entries.any((e) => e.value != 'all') || activeFilterId != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          for (final e in visible)
            _FacetChip(
              entry: e,
              tokens: tokens,
              onPick: (v) => onFacet(e.dim.key, v),
            ),
          if (visible.isNotEmpty && filters.isNotEmpty)
            _Divider(tokens: tokens),
          for (final f in filters)
            _SavedChip(
              filter: f,
              tokens: tokens,
              active: activeFilterId == f.id,
              onToggle: () =>
                  onSelectFilter(activeFilterId == f.id ? null : f.id),
              onEdit: () => onEditFilter(f),
            ),
          _FilterButton(
            tokens: tokens,
            showLabel: filters.isEmpty,
            onPressed: onNewFilter,
          ),
          if (narrowed) _ResetChip(tokens: tokens, onReset: onReset),
        ],
      ),
    );
  }
}

class _FacetChip extends StatelessWidget {
  const _FacetChip({
    required this.entry,
    required this.tokens,
    required this.onPick,
  });

  final FacetRowEntry entry;
  final HarborTokens tokens;
  final void Function(String value) onPick;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final active = entry.value != 'all';
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: () async {
        final picked = await _openFacetMenu(context, entry, t);
        if (picked != null) onPick(picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? t.accentSoft : t.raised,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              active ? entry.value : entry.dim.label,
              style: TextStyle(
                color: active ? t.accent : t.inkMuted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.expand_more,
              size: 16,
              color: active ? t.accent : t.inkMuted,
            ),
          ],
        ),
      ),
    );
  }
}

class _ResetChip extends StatelessWidget {
  const _ResetChip({required this.tokens, required this.onReset});

  final HarborTokens tokens;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onReset,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Text(
          'Reset',
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

/// A thin vertical separator between the facet chips and the saved-filter chips.
class _Divider extends StatelessWidget {
  const _Divider({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => Container(
    width: 1,
    height: 16,
    margin: const EdgeInsets.symmetric(horizontal: 4),
    color: tokens.edgeSoft,
  );
}

/// A saved custom-filter chip: its name toggles the filter on/off; the pencil
/// opens the builder to edit it. Ports the web `SavedChip`.
class _SavedChip extends StatelessWidget {
  const _SavedChip({
    required this.filter,
    required this.tokens,
    required this.active,
    required this.onToggle,
    required this.onEdit,
  });

  final CustomStreamFilter filter;
  final HarborTokens tokens;
  final bool active;
  final VoidCallback onToggle;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final fg = active ? t.accent : t.inkMuted;
    return Container(
      decoration: BoxDecoration(
        color: active ? t.accentSoft : t.raised,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: onToggle,
            child: Padding(
              padding: const EdgeInsetsDirectional.only(
                start: 14,
                end: 6,
                top: 8,
                bottom: 8,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 180),
                child: Text(
                  filter.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: fg,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: onEdit,
            child: Padding(
              padding: const EdgeInsetsDirectional.only(
                start: 2,
                end: 10,
                top: 6,
                bottom: 6,
              ),
              child: Icon(Icons.edit_outlined, size: 13, color: fg),
            ),
          ),
        ],
      ),
    );
  }
}

/// The "New filter" button — a plus, with a "Filter" label until the first
/// saved filter exists. Ports the web `+ Filter` button.
class _FilterButton extends StatelessWidget {
  const _FilterButton({
    required this.tokens,
    required this.showLabel,
    required this.onPressed,
  });

  final HarborTokens tokens;
  final bool showLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onPressed,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: showLabel ? 12 : 9,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: t.raised,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.add, size: 15, color: t.inkMuted),
            if (showLabel) ...[
              const SizedBox(width: 5),
              Text(
                'Filter',
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

Future<String?> _openFacetMenu(
  BuildContext context,
  FacetRowEntry entry,
  HarborTokens tokens,
) => showGeneralDialog<String>(
  context: context,
  barrierDismissible: true,
  barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
  barrierColor: Colors.black.withValues(alpha: 0.55),
  transitionDuration: const Duration(milliseconds: 120),
  pageBuilder: (ctx, _, _) => _FacetMenu(entry: entry, tokens: tokens),
  transitionBuilder: (ctx, anim, _, child) => FadeTransition(
    opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
    child: child,
  ),
);

class _FacetMenu extends StatelessWidget {
  const _FacetMenu({required this.entry, required this.tokens});

  final FacetRowEntry entry;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Center(
      child: Material(
        color: Colors.transparent,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320, maxHeight: 480),
          child: Container(
            decoration: BoxDecoration(
              color: t.canvas,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: t.edgeSoft),
            ),
            clipBehavior: Clip.antiAlias,
            child: FocusTraversalGroup(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
                      child: Text(
                        entry.dim.label.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.5,
                          color: t.inkSubtle,
                        ),
                      ),
                    ),
                    _row(context, 'All', 'all', entry.total, entry.value),
                    for (final o in entry.options)
                      _row(context, o.key, o.key, o.count, entry.value),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(
    BuildContext context,
    String label,
    String value,
    int count,
    String selectedValue,
  ) {
    final t = tokens;
    final selected = selectedValue == value;
    return Focusable(
      tokens: t,
      autofocus: selected,
      onPressed: () => Navigator.of(context).pop<String>(value),
      child: Container(
        color: selected ? t.ink.withValues(alpha: 0.1) : null,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? t.ink : t.inkMuted,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              '$count',
              style: TextStyle(fontSize: 11.5, color: t.inkSubtle),
            ),
            const SizedBox(width: 10),
            Icon(
              Icons.check,
              size: 16,
              color: selected ? t.accent : Colors.transparent,
            ),
          ],
        ),
      ),
    );
  }
}
