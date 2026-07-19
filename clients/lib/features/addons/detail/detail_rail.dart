import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/layout/idiom.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../addon_utils.dart';
import 'tile_card.dart';

/// A titled rail of addon tiles ("More like this", "Recommended for you"),
/// ported 1:1 from `DetailRail`. Hidden when it has no items; the tile grid is
/// 2 / 3 / 4 columns responsive.
class DetailRail extends ConsumerWidget {
  const DetailRail({
    super.key,
    required this.title,
    required this.items,
    required this.installedIds,
    required this.onOpen,
    required this.onInstall,
  });

  final String title;
  final List<ResolvedAddon> items;
  final Set<String> installedIds;
  final void Function(String id) onOpen;
  final Future<void> Function(ResolvedAddon) onInstall;

  static const _gap = 12.0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) return const SizedBox.shrink();
    final t = ref.watch(tokensProvider);

    return Padding(
      padding: const EdgeInsets.only(top: 48),
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
            child: Text(
              title,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w500,
                color: t.ink,
              ),
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              final cols = gridColumnsFor(
                AddonGrid.detailRail,
                constraints.maxWidth,
              );
              return Column(children: _rows(cols));
            },
          ),
        ],
      ),
    );
  }

  List<Widget> _rows(int cols) {
    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += cols) {
      final rowItems = items.skip(i).take(cols).toList();
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < cols; j++) ...[
                if (j > 0) const SizedBox(width: _gap),
                Expanded(
                  child: j < rowItems.length
                      ? _tile(rowItems[j])
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
      if (i + cols < items.length) rows.add(const SizedBox(height: _gap));
    }
    return rows;
  }

  Widget _tile(ResolvedAddon r) => TileCard(
    resolved: r,
    onOpen: () => onOpen(idOf(r)),
    onInstall: () => onInstall(r),
    installed: installedIds.contains(idOf(r)),
  );
}
