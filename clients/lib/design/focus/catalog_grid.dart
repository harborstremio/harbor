import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../domain/addons/models.dart';
import '../back_to_top.dart';
import '../layout/idiom.dart';
import '../tokens.dart';
import 'focusable_poster.dart';

/// A full-page poster grid (used by the Movies/Shows/Catalogs tabs), navigable
/// 2-D by the remote, with a Back-to-top button once scrolled.
class CatalogGrid extends ConsumerStatefulWidget {
  const CatalogGrid({
    super.key,
    required this.items,
    required this.tokens,
    required this.onSelect,
    this.autofocusFirst = false,
  });

  final List<MetaPreview> items;
  final HarborTokens tokens;
  final void Function(MetaPreview item) onSelect;
  final bool autofocusFirst;

  @override
  ConsumerState<CatalogGrid> createState() => _CatalogGridState();
}

class _CatalogGridState extends ConsumerState<CatalogGrid> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hideTitles = ref.watch(settingsProvider).getBool('hidePosterTitles');
    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);
    final overscan = overscanInset(idiom);
    return BackToTopOverlay(
      controller: _scrollController,
      child: GridView.builder(
        controller: _scrollController,
        // Clear the TV overscan crop top and bottom (the grid scrolls under the
        // header and to the bezel).
        padding: EdgeInsets.fromLTRB(
          g,
          24 + overscan.top,
          g,
          40 + overscan.bottom,
        ),
        gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
          // Fewer, larger posters on a 10-foot TV instead of ~10 tiny columns.
          maxCrossAxisExtent: idiom.isTv ? 220 : 168,
          childAspectRatio: posterGridAspect(0.58, hideTitles),
          crossAxisSpacing: 16,
          mainAxisSpacing: 20,
        ),
        itemCount: widget.items.length,
        itemBuilder: (context, i) => FocusablePoster(
          item: widget.items[i],
          tokens: widget.tokens,
          autofocus: widget.autofocusFirst && i == 0,
          onPressed: () => widget.onSelect(widget.items[i]),
        ),
      ),
    );
  }
}
