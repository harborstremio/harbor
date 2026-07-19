import 'package:flutter/material.dart';

import '../../../design/addons/addon_logo.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import 'organize_utils.dart';

/// A titled Organize section wrapping a list of addons, ported from `SectionCard`.
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.tokens,
    required this.title,
    required this.sub,
    required this.count,
    required this.child,
  });

  final HarborTokens tokens;
  final String title;
  final String sub;
  final int count;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w500,
                        color: t.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      sub,
                      style: TextStyle(fontSize: 12.5, color: t.inkMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: t.raised,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  count == 1 ? '1 addon' : '$count addons',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: t.inkMuted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

/// The reorderable list of addons in a section, ported from `OrganizeList`.
/// Drag (touch/pointer) plus move-top / move-up / move-down (D-pad) both reorder.
class OrganizeList extends StatelessWidget {
  const OrganizeList({
    super.key,
    required this.tokens,
    required this.entries,
    required this.busy,
    required this.onReorder,
    required this.onMove,
    required this.onMoveTop,
  });

  final HarborTokens tokens;
  final List<OrganizeEntry> entries;
  final bool busy;
  final void Function(int oldIndex, int newIndex) onReorder;
  final void Function(int index, int delta) onMove;
  final void Function(int index) onMoveTop;

  @override
  Widget build(BuildContext context) {
    return ReorderableListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      buildDefaultDragHandles: false,
      itemCount: entries.length,
      onReorder: (oldIndex, newIndex) {
        if (busy) return;
        // ReorderableListView reports an insertion index past the removed slot.
        final target = newIndex > oldIndex ? newIndex - 1 : newIndex;
        if (target != oldIndex) onReorder(oldIndex, target);
      },
      proxyDecorator: (child, index, animation) =>
          Material(color: Colors.transparent, child: child),
      itemBuilder: (context, i) => Padding(
        key: ValueKey(entries[i].key),
        padding: EdgeInsets.only(bottom: i == entries.length - 1 ? 0 : 10),
        child: _OrganizeRow(
          tokens: tokens,
          entry: entries[i],
          index: i,
          position: i + 1,
          busy: busy,
          canUp: !busy && i > 0,
          canDown: !busy && i < entries.length - 1,
          onUp: () => onMove(i, -1),
          onDown: () => onMove(i, 1),
          onTop: () => onMoveTop(i),
        ),
      ),
    );
  }
}

class _OrganizeRow extends StatelessWidget {
  const _OrganizeRow({
    required this.tokens,
    required this.entry,
    required this.index,
    required this.position,
    required this.busy,
    required this.canUp,
    required this.canDown,
    required this.onUp,
    required this.onDown,
    required this.onTop,
  });

  final HarborTokens tokens;
  final OrganizeEntry entry;
  final int index;
  final int position;
  final bool busy;
  final bool canUp;
  final bool canDown;
  final VoidCallback onUp;
  final VoidCallback onDown;
  final VoidCallback onTop;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: t.elevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: Text(
              '$position',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w500,
                color: t.inkSubtle,
              ),
            ),
          ),
          ReorderableDragStartListener(
            index: index,
            enabled: !busy,
            child: MouseRegion(
              cursor: busy ? MouseCursor.defer : SystemMouseCursors.grab,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Icon(Icons.drag_indicator, size: 18, color: t.inkSubtle),
              ),
            ),
          ),
          const SizedBox(width: 8),
          AddonLogo(
            addonId: entry.addonId,
            addonName: entry.name,
            manifestLogo: entry.logo,
            size: AddonLogoSize.lg,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: t.ink,
                  ),
                ),
                Text(
                  entry.host,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: t.inkSubtle),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _iconButton(t, Icons.keyboard_double_arrow_up, canUp, onTop),
          _iconButton(t, Icons.arrow_upward, canUp, onUp),
          _iconButton(t, Icons.arrow_downward, canDown, onDown),
        ],
      ),
    );
  }

  Widget _iconButton(
    HarborTokens t,
    IconData icon,
    bool enabled,
    VoidCallback onPressed,
  ) {
    if (!enabled) {
      return Padding(
        padding: const EdgeInsets.all(5),
        child: Icon(icon, size: 17, color: t.inkMuted.withValues(alpha: 0.25)),
      );
    }
    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: onPressed,
      child: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        margin: const EdgeInsets.symmetric(horizontal: 1),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, size: 17, color: t.inkMuted),
      ),
    );
  }
}

/// The loading placeholder for a section, ported from `SkeletonRows`.
class SkeletonRows extends StatelessWidget {
  const SkeletonRows({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < 6; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          Container(
            height: 66,
            decoration: BoxDecoration(
              color: tokens.elevated.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: tokens.edgeSoft),
            ),
          ),
        ],
      ],
    );
  }
}
