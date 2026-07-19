import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/catalog_grid.dart';
import '../../design/layout/idiom.dart';
import '../../domain/addons/models.dart';
import '../../domain/nav/frame.dart';

/// The "View all" grid — a full poster grid of a catalog row's titles, opened
/// from a rail's View-all action (`FrameKind.grid`). The row's items ride in
/// the frame args, so the grid shows the exact set the rail was displaying.
class GridPageView extends ConsumerWidget {
  const GridPageView({super.key, required this.title, required this.items});

  final String title;
  final List<MetaPreview> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final g = pageGutter(Idiom.of(context));
    return Container(
      color: t.canvas,
      child: SafeArea(
        // The title is gutter-padded; the grid spans full width and supplies its
        // own idiom gutter, so the grid is not double-padded on phone.
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(g, 32, g, 0),
              child: Text(
                title,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 22),
            Expanded(
              child: CatalogGrid(
                items: items,
                tokens: t,
                autofocusFirst: true,
                onSelect: (item) => ref
                    .read(navControllerProvider.notifier)
                    .push(
                      Frame(FrameKind.meta, {'type': item.type, 'id': item.id}),
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
