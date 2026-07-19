import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/anime/anime_franchise.dart';

/// The anime franchise season picker — a pill showing the current season/movie
/// position and title that opens a focus-trapped menu of the whole franchise
/// (seasons first, then movies and specials), navigating to a sibling on
/// select. Ported from `AnimeSeasonPicker`.
class AnimeSeasonPicker extends StatelessWidget {
  const AnimeSeasonPicker({
    super.key,
    required this.franchise,
    required this.currentId,
    required this.onSelect,
    required this.tokens,
  });

  final List<FranchiseEntry> franchise;
  final String currentId;
  final void Function(FranchiseEntry) onSelect;
  final HarborTokens tokens;

  int get _currentIdx {
    final match = franchise.indexWhere((f) => f.meta.id == currentId);
    return match >= 0 ? match : franchise.indexWhere((f) => f.isCurrent);
  }

  @override
  Widget build(BuildContext context) {
    final currentIdx = _currentIdx;
    if (currentIdx < 0) return const SizedBox.shrink();
    final current = franchise[currentIdx];
    final tags = franchiseTags(franchise);

    return Focusable(
      tokens: tokens,
      borderRadius: 999,
      onPressed: () => _openMenu(context, currentIdx, tags),
      child: Container(
        height: 48,
        padding: const EdgeInsets.only(left: 18, right: 12),
        decoration: BoxDecoration(
          color: tokens.elevated,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: tokens.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              tags[currentIdx].short,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 11.5,
                color: tokens.inkSubtle,
              ),
            ),
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 240),
              child: Text(
                current.meta.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: tokens.ink,
                ),
              ),
            ),
            if (current.isUpcoming) ...[
              const SizedBox(width: 8),
              UpcomingBadge(tokens: tokens),
            ],
            const SizedBox(width: 4),
            Icon(Icons.expand_more, size: 18, color: tokens.inkMuted),
          ],
        ),
      ),
    );
  }

  Future<void> _openMenu(
    BuildContext context,
    int currentIdx,
    List<FranchiseTag> tags,
  ) async {
    final seasonIdxs = [
      for (var i = 0; i < tags.length; i++)
        if (tags[i].kind == FranchiseTagKind.season) i,
    ];
    final extraIdxs = [
      for (var i = 0; i < tags.length; i++)
        if (tags[i].kind != FranchiseTagKind.season) i,
    ];
    final selected = await showGeneralDialog<FranchiseEntry>(
      context: context,
      barrierDismissible: true,
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      transitionDuration: const Duration(milliseconds: 120),
      pageBuilder: (ctx, _, _) => _SeasonMenu(
        tokens: tokens,
        franchise: franchise,
        tags: tags,
        currentIdx: currentIdx,
        seasonIdxs: seasonIdxs,
        extraIdxs: extraIdxs,
      ),
      transitionBuilder: (ctx, anim, _, child) => FadeTransition(
        opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
        child: child,
      ),
    );
    if (selected != null) onSelect(selected);
  }
}

/// The small "Upcoming" chip shown on a not-yet-released entry.
class UpcomingBadge extends StatelessWidget {
  const UpcomingBadge({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: tokens.elevated,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: tokens.edgeSoft),
      ),
      child: Text(
        'UPCOMING',
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w500,
          letterSpacing: 1.3,
          color: tokens.inkSubtle,
        ),
      ),
    );
  }
}

class _SeasonMenu extends StatelessWidget {
  const _SeasonMenu({
    required this.tokens,
    required this.franchise,
    required this.tags,
    required this.currentIdx,
    required this.seasonIdxs,
    required this.extraIdxs,
  });

  final HarborTokens tokens;
  final List<FranchiseEntry> franchise;
  final List<FranchiseTag> tags;
  final int currentIdx;
  final List<int> seasonIdxs;
  final List<int> extraIdxs;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Material(
        color: Colors.transparent,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380, maxHeight: 520),
          child: Container(
            decoration: BoxDecoration(
              color: tokens.canvas,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: tokens.edgeSoft),
            ),
            clipBehavior: Clip.antiAlias,
            child: FocusTraversalGroup(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final i in seasonIdxs) _row(context, i),
                    if (extraIdxs.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                        child: Text(
                          'Movies & Specials',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.5,
                            color: tokens.inkSubtle,
                          ),
                        ),
                      ),
                    for (final i in extraIdxs) _row(context, i),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(BuildContext context, int i) {
    final f = franchise[i];
    final isActive = i == currentIdx;
    return Focusable(
      tokens: tokens,
      autofocus: isActive,
      onPressed: () =>
          Navigator.of(context).pop<FranchiseEntry>(isActive ? null : f),
      child: Container(
        color: isActive ? tokens.ink.withValues(alpha: 0.1) : null,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Text(
                tags[i].short,
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: tokens.inkSubtle,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          f.meta.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w500,
                            color: isActive ? tokens.ink : tokens.inkMuted,
                          ),
                        ),
                      ),
                      if (f.isUpcoming) ...[
                        const SizedBox(width: 8),
                        UpcomingBadge(tokens: tokens),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _subtitle(f),
                    style: TextStyle(fontSize: 11.5, color: tokens.inkSubtle),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _subtitle(FranchiseEntry f) {
    final count = f.episodeCount ?? 0;
    final eps = count > 0 ? (count == 1 ? '1 ep' : '$count eps') : '';
    final year = (f.startDate != null && f.startDate!.length >= 4)
        ? f.startDate!.substring(0, 4)
        : (f.isUpcoming ? 'TBA' : '');
    if (eps.isNotEmpty && year.isNotEmpty) return '$eps  ·  $year';
    return eps.isNotEmpty ? eps : year;
  }
}
