import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/layout/idiom.dart';
import '../../../domain/addons/curated.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../addon_utils.dart';
import '../detail/tile_card.dart';
import 'feature_card.dart';
import 'list_card.dart';
import '../../../design/focus/focusable.dart';

/// A titled Discover rail with a collapse/expand toggle and a layout-specific
/// grid (feature / list / tile), ported 1:1 from `Rail`.
class Rail extends ConsumerStatefulWidget {
  const Rail({
    super.key,
    required this.title,
    required this.layout,
    required this.items,
    required this.installedIds,
    required this.onOpen,
    required this.onInstall,
    required this.onUninstall,
    this.blurb,
  });

  final String title;
  final String? blurb;
  final CuratedRailLayout layout;
  final List<ResolvedAddon> items;
  final Set<String> installedIds;
  final void Function(String id) onOpen;
  final Future<void> Function(ResolvedAddon) onInstall;
  final Future<void> Function(ResolvedAddon) onUninstall;

  @override
  ConsumerState<Rail> createState() => _RailState();
}

class _RailState extends ConsumerState<Rail> {
  bool _expanded = false;

  int get _collapsedCount => widget.layout == CuratedRailLayout.tile ? 4 : 2;

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();
    final t = ref.watch(tokensProvider);
    final hasMore = widget.items.length > _collapsedCount;
    final visible = _expanded
        ? widget.items
        : widget.items.take(_collapsedCount).toList();
    final gap = widget.layout == CuratedRailLayout.list ? 8.0 : 12.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 20),
            padding: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.7)),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.title,
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w500,
                          color: t.ink,
                        ),
                      ),
                      if (widget.blurb != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          widget.blurb!,
                          style: TextStyle(
                            fontSize: 14,
                            height: 1.5,
                            color: t.inkMuted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (hasMore)
                  Focusable(
                    tokens: t,
                    scale: 1.0,
                    borderRadius: 8,
                    onPressed: () => setState(() => _expanded = !_expanded),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _expanded
                              ? 'Show less'
                              : 'See all (${widget.items.length})',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: t.accent,
                          ),
                        ),
                        Icon(
                          _expanded ? Icons.expand_more : Icons.chevron_right,
                          size: 14,
                          color: t.accent,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              final cols = _columns(widget.layout, constraints.maxWidth);
              return Column(children: _rows(visible, cols, gap));
            },
          ),
        ],
      ),
    );
  }

  int _columns(CuratedRailLayout layout, double width) => gridColumnsFor(
    layout == CuratedRailLayout.tile
        ? AddonGrid.tileRail
        : AddonGrid.featureRail, // feature / list share the 1→lg:2 rule
    width,
  );

  List<Widget> _rows(List<ResolvedAddon> items, int cols, double gap) {
    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += cols) {
      final rowItems = items.skip(i).take(cols).toList();
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < cols; j++) ...[
                if (j > 0) SizedBox(width: gap),
                Expanded(
                  child: j < rowItems.length
                      ? _card(rowItems[j])
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
      if (i + cols < items.length) rows.add(SizedBox(height: gap));
    }
    return rows;
  }

  Widget _card(ResolvedAddon r) {
    final installed = widget.installedIds.contains(idOf(r));
    return switch (widget.layout) {
      CuratedRailLayout.feature => FeatureCard(
        resolved: r,
        onOpen: () => widget.onOpen(idOf(r)),
        onInstall: () => widget.onInstall(r),
        onUninstall: () => widget.onUninstall(r),
        installed: installed,
      ),
      CuratedRailLayout.list => ListCard(
        resolved: r,
        onOpen: () => widget.onOpen(idOf(r)),
        onInstall: () => widget.onInstall(r),
        onUninstall: () => widget.onUninstall(r),
        installed: installed,
      ),
      CuratedRailLayout.tile => TileCard(
        resolved: r,
        onOpen: () => widget.onOpen(idOf(r)),
        onInstall: () => widget.onInstall(r),
        installed: installed,
      ),
    };
  }
}
