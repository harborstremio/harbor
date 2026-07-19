import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import '../../../domain/sports/sports_espn.dart';

/// Opens the sports league picker and resolves to the chosen keys, or null if
/// cancelled. Ported from `SportsCustomizeModal`.
Future<List<String>?> showSportsCustomizeModal({
  required BuildContext context,
  required HarborTokens tokens,
  required List<String> selected,
}) {
  return showDialog<List<String>>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.65),
    builder: (ctx) =>
        _SportsCustomizeDialog(tokens: tokens, selected: selected),
  );
}

class _SportsCustomizeDialog extends StatefulWidget {
  const _SportsCustomizeDialog({required this.tokens, required this.selected});

  final HarborTokens tokens;
  final List<String> selected;

  @override
  State<_SportsCustomizeDialog> createState() => _SportsCustomizeDialogState();
}

class _SportsCustomizeDialogState extends State<_SportsCustomizeDialog> {
  late final Set<String> _draft = {...widget.selected};
  String _activeGroup = 'all';

  List<LeagueDef> _groupLeagues(String group) => [
    for (final l in kLeagues)
      if (l.group == group) l,
  ];

  void _toggle(String key) => setState(() {
    if (!_draft.remove(key)) _draft.add(key);
  });

  void _toggleGroup(String group) {
    final keys = _groupLeagues(group).map((l) => l.key);
    final allSelected = keys.every(_draft.contains);
    setState(() {
      if (allSelected) {
        _draft.removeAll(keys);
      } else {
        _draft.addAll(keys);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(24),
        child: LayoutBuilder(
          builder: (context, c) => SizedBox(
            // A definite width (not a shrink-wrap) so the Spacers and the card
            // grid lay out against a bounded cross-axis.
            width: c.maxWidth.isFinite ? c.maxWidth.clamp(0.0, 640.0) : 640.0,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 620),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: t.canvas,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: t.edgeSoft.withValues(alpha: 0.4)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _headerBar(t),
                    _groupTabs(t),
                    Flexible(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(16),
                        child: _activeGroup == 'all'
                            ? _allGroupsBody(t)
                            : _grid(t, _groupLeagues(_activeGroup)),
                      ),
                    ),
                    _footer(t),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _headerBar(HarborTokens t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
    decoration: BoxDecoration(
      border: Border(
        bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.3)),
      ),
    ),
    child: Row(
      children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: t.ink.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(Icons.tune, size: 18, color: t.ink),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Customize Sports',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                '${_draft.length} selected',
                style: TextStyle(color: t.inkSubtle, fontSize: 12),
              ),
            ],
          ),
        ),
        Focusable(
          tokens: t,
          borderRadius: 999,
          onPressed: () => Navigator.of(context).pop(),
          child: Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            child: Icon(Icons.close, size: 16, color: t.inkSubtle),
          ),
        ),
      ],
    ),
  );

  Widget _groupTabs(HarborTokens t) => Container(
    decoration: BoxDecoration(
      border: Border(
        bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.3)),
      ),
    ),
    child: SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        children: [
          _groupTab(t, key: 'all', icon: '🌐', label: 'All'),
          for (final g in kLeagueGroups)
            _groupTab(
              t,
              key: g.key,
              icon: g.icon,
              label: getGroupLabel(g),
              badge: _groupLeagues(
                g.key,
              ).where((l) => _draft.contains(l.key)).length,
            ),
        ],
      ),
    ),
  );

  Widget _groupTab(
    HarborTokens t, {
    required String key,
    required String icon,
    required String label,
    int badge = 0,
  }) {
    final active = _activeGroup == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Focusable(
        tokens: t,
        borderRadius: 999,
        onPressed: () => setState(() => _activeGroup = key),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? t.ink : t.elevated,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: active
                  ? Colors.transparent
                  : t.edgeSoft.withValues(alpha: 0.5),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(icon, style: const TextStyle(fontSize: 12)),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: active ? t.canvas : t.inkMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (badge > 0) ...[
                const SizedBox(width: 6),
                Container(
                  constraints: const BoxConstraints(minWidth: 16),
                  height: 16,
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: active
                        ? Colors.white.withValues(alpha: 0.2)
                        : t.ink.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$badge',
                    style: TextStyle(
                      color: active ? Colors.white : t.ink,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _allGroupsBody(HarborTokens t) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final g in kLeagueGroups) ...[
        Builder(
          builder: (context) {
            final leagues = _groupLeagues(g.key);
            final allSel = leagues.every((l) => _draft.contains(l.key));
            final someSel = leagues.any((l) => _draft.contains(l.key));
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Text('${g.icon} ', style: const TextStyle(fontSize: 12)),
                      Expanded(
                        child: Text(
                          getGroupLabel(g).toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t.inkSubtle,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.6,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Focusable(
                        tokens: t,
                        borderRadius: 6,
                        onPressed: () => _toggleGroup(g.key),
                        child: Text(
                          allSel ? 'Deselect all' : 'Select all',
                          style: TextStyle(
                            color: allSel
                                ? t.danger
                                : (someSel
                                      ? const Color(0xFFFBBF24)
                                      : t.inkSubtle),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                _grid(t, leagues),
                const SizedBox(height: 20),
              ],
            );
          },
        ),
      ],
    ],
  );

  Widget _grid(HarborTokens t, List<LeagueDef> leagues) => LayoutBuilder(
    builder: (context, c) {
      const spacing = 8.0;
      final avail = c.maxWidth.isFinite ? c.maxWidth : 592.0;
      // Two columns on a narrow phone (three would leave cards too small for
      // the logo + label + check), three otherwise. A hair under the exact
      // fraction so the cards never overflow the row by a sub-pixel.
      final cols = avail < 380 ? 2 : 3;
      final width = (avail - spacing * (cols - 1)) / cols - 1;
      return Wrap(
        spacing: spacing,
        runSpacing: spacing,
        children: [
          for (final l in leagues)
            SizedBox(
              width: width,
              child: _LeagueCard(
                league: l,
                selected: _draft.contains(l.key),
                tokens: t,
                onToggle: () => _toggle(l.key),
              ),
            ),
        ],
      );
    },
  );

  Widget _footer(HarborTokens t) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: t.edgeSoft.withValues(alpha: 0.3))),
    ),
    // The bulk actions and the confirm actions each stay grouped, and the two
    // groups drop onto separate lines rather than overflowing a phone width.
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      spacing: 12,
      runSpacing: 10,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _textButton(t, 'Select All', () {
              setState(
                () => _draft
                  ..clear()
                  ..addAll(kLeagues.map((l) => l.key)),
              );
            }),
            _textButton(t, 'Clear All', () => setState(_draft.clear)),
          ],
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Focusable(
              tokens: t,
              borderRadius: 12,
              onPressed: () => Navigator.of(context).pop(),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
                ),
                child: Text(
                  'Cancel',
                  style: TextStyle(
                    color: t.inkMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            Focusable(
              tokens: t,
              autofocus: true,
              borderRadius: 12,
              onPressed: () => Navigator.of(context).pop(_draft.toList()),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: t.ink,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Save',
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
  );

  Widget _textButton(HarborTokens t, String label, VoidCallback onTap) =>
      Focusable(
        tokens: t,
        borderRadius: 8,
        onPressed: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Text(
            label,
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      );
}

class _LeagueCard extends StatelessWidget {
  const _LeagueCard({
    required this.league,
    required this.selected,
    required this.tokens,
    required this.onToggle,
  });

  final LeagueDef league;
  final bool selected;
  final HarborTokens tokens;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final groupIcon = _firstOrNull(
      kLeagueGroups,
      (g) => g.key == league.group,
    )?.icon;
    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: onToggle,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: selected
              ? t.ink.withValues(alpha: 0.08)
              : t.elevated.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? t.ink.withValues(alpha: 0.4)
                : t.edgeSoft.withValues(alpha: 0.4),
          ),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 32,
              height: 32,
              child: CachedNetworkImage(
                imageUrl: league.logo,
                fit: BoxFit.contain,
                errorWidget: (_, _, _) => Center(
                  child: Text(
                    groupIcon ?? '🏆',
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                getLeagueLabel(league),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  height: 1.1,
                ),
              ),
            ),
            if (selected) ...[
              const SizedBox(width: 6),
              Container(
                width: 20,
                height: 20,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: t.ink, shape: BoxShape.circle),
                child: Icon(Icons.check, size: 12, color: t.canvas),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

T? _firstOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final it in items) {
    if (test(it)) return it;
  }
  return null;
}
