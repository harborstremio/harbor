import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';

import '../../domain/addons/models.dart';

/// The three-backdrop collage behind a genre/language tile — each backdrop
/// lightly skewed and offset, ported from the web `CollageBackdrop` / `Collage`.
/// Renders nothing when there are no backdrops.
class TileCollage extends StatelessWidget {
  const TileCollage({
    super.key,
    required this.backdrops,
    required this.tileWidth,
  });

  final List<MetaPreview> backdrops;
  final double tileWidth;

  @override
  Widget build(BuildContext context) {
    if (backdrops.isEmpty) return const SizedBox.shrink();
    return Row(
      children: [
        for (var i = 0; i < backdrops.length && i < 3; i++)
          Expanded(
            child: Transform(
              alignment: Alignment.center,
              transform: Matrix4.skewX(-0.14)
                ..translateByDouble((i - 1) * 6.0, 0, 0, 1),
              child: OverflowBox(
                maxWidth: tileWidth,
                child: Transform.scale(
                  scale: 1.4,
                  child: CachedNetworkImage(
                    imageUrl: backdrops[i].background!,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
