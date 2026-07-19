import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/collections_catalog.dart';
import '../../domain/nav/frame.dart';
import '../../design/layout/idiom.dart';

/// The Home "Collections" rail, ported from `src/components/collections-row.tsx`:
/// the first 30 curated franchise collections as landscape cards. Gated on a
/// TMDB key (backdrops + counts are TMDB-resolved).
class CollectionsRow extends ConsumerWidget {
  const CollectionsRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = pageGutter(Idiom.of(context));
    final t = ref.watch(tokensProvider);
    final settings = ref.watch(settingsProvider);
    final hasKey = settings.tmdbKey.isNotEmpty;
    if (!hasKey) return const SizedBox.shrink();
    final titleScale = settings.getDouble('rowTitleScale');
    final items = kCollectionsCatalog.take(30).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 4, g, 10),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Focusable(
              tokens: t,
              borderRadius: 10,
              onPressed: () => ref
                  .read(navControllerProvider.notifier)
                  .push(Frame(FrameKind.collections, const {})),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      ref.watch(translationsProvider).t('Collections'),
                      style: TextStyle(
                        color: t.ink,
                        fontSize: scaledRowTitle(20, titleScale),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Icon(Icons.chevron_right, color: t.inkMuted, size: 22),
                  ],
                ),
              ),
            ),
          ),
        ),
        SizedBox(
          height: 320 * 9 / 16,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (context, i) => CollectionCard(
                id: items[i].id,
                name: items[i].name,
                tokens: t,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A single landscape collection card: a hue-derived gradient placeholder, the
/// lazily-resolved TMDB backdrop, a films-count pill, and the collection name.
class CollectionCard extends ConsumerWidget {
  const CollectionCard({
    super.key,
    required this.id,
    required this.name,
    this.knownBackdrop,
    this.knownCount,
    required this.tokens,
    this.width = 320,
  });

  final int id;
  final String name;
  final String? knownBackdrop;
  final int? knownCount;
  final HarborTokens tokens;

  /// The card width. Defaults to the 320px rail card; the collections grid
  /// passes a narrower width to fit two columns on a phone.
  final double width;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Resolve the TMDB backdrop/count only when we don't already have both
    // (feed hits carry them), matching the source's resolve guard.
    final resolveNeeded = knownBackdrop == null || knownCount == null;
    final data = resolveNeeded
        ? ref.watch(collectionCardProvider((id: id, name: name))).value
        : null;
    final backdrop = data?.backdrop ?? knownBackdrop;
    final count = data?.count ?? knownCount;
    final resolvedId = data?.resolvedId ?? id;
    // Deterministic hue from the id (or the name), as in the web card.
    final hue = (((id != 0 ? id : name.length * 37) * 47) % 360).toDouble();
    final from = HSLColor.fromAHSL(1, hue, 0.5, 0.32).toColor();
    final to = HSLColor.fromAHSL(1, hue, 0.42, 0.12).toColor();

    return SizedBox(
      width: width,
      child: Focusable(
        tokens: tokens,
        borderRadius: 16,
        onPressed: () {
          if (resolvedId > 0) {
            ref
                .read(navControllerProvider.notifier)
                .push(Frame(FrameKind.collection, {'id': resolvedId}));
          }
        },
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [from, to],
                    ),
                  ),
                ),
                if (backdrop != null)
                  CachedNetworkImage(
                    imageUrl: backdrop,
                    fit: BoxFit.cover,
                    fadeInDuration: const Duration(milliseconds: 400),
                    errorWidget: (_, _, _) => const SizedBox.shrink(),
                  ),
                // Bottom scrim for text legibility.
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Color(0xE0000000),
                        Color(0x33000000),
                        Color(0x00000000),
                      ],
                    ),
                  ),
                ),
                // Films-count pill.
                Positioned(
                  left: 14,
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.layers, size: 11, color: Colors.white),
                        const SizedBox(width: 6),
                        Text(
                          count != null
                              ? ref.watch(translationsProvider).t(
                                  '{count} films',
                                  {'count': count},
                                )
                              : ref.watch(translationsProvider).t('Collection'),
                          style: const TextStyle(
                            color: Color(0xD9FFFFFF),
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                // Name.
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 14,
                  child: Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w500,
                      height: 1.08,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
