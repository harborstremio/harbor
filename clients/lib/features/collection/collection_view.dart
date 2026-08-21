import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/tmdb_collection.dart';
import '../../domain/nav/frame.dart';

/// The collection detail view, ported from `src/views/collection.tsx`: a blurred
/// backdrop hero with the poster, name, film count + year range and overview,
/// then a responsive grid of the member films.
class CollectionView extends ConsumerWidget {
  const CollectionView({super.key, required this.collectionId});

  final int collectionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final hasKey = ref.watch(settingsProvider).tmdbKey.isNotEmpty;
    final async = ref.watch(collectionProvider(collectionId));

    if (!hasKey) {
      return _notice(t, 'Add a TMDB key in Settings to browse collections.');
    }

    return async.when(
      loading: () => Center(
        child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
      ),
      error: (_, _) => _notice(t, 'No films found in this collection.'),
      data: (data) {
        if (data == null || data.parts.isEmpty) {
          return _notice(t, 'No films found in this collection.');
        }
        final idiom = Idiom.of(context);
        final g = pageGutter(idiom);
        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _hero(data, t, idiom)),
            SliverToBoxAdapter(child: _filmsLabel(t, g)),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(g, 4, g, 64),
              sliver: SliverGrid(
                gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: scaledPosterCell(
                    180,
                    ref.watch(settingsProvider).getDouble('posterScale'),
                  ),
                  childAspectRatio: posterGridAspect(
                    2 / 3.4,
                    ref.watch(settingsProvider).getBool('hidePosterTitles'),
                  ),
                  crossAxisSpacing: 18,
                  mainAxisSpacing: 26,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, i) => FocusablePoster(
                    item: data.parts[i],
                    tokens: t,
                    autofocus: i == 0,
                    onPressed: () => ref
                        .read(navControllerProvider.notifier)
                        .push(
                          Frame(FrameKind.meta, {
                            'type': data.parts[i].type,
                            'id': data.parts[i].id,
                          }),
                        ),
                  ),
                  childCount: data.parts.length,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _hero(TmdbCollection data, HarborTokens t, Idiom idiom) {
    final years = _yearRange(data.parts);
    final phone = idiom.isPhone;
    final g = pageGutter(idiom);
    return SizedBox(
      height: 360,
      child: Stack(
        children: [
          if (data.backdrop != null)
            Positioned.fill(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CachedNetworkImage(
                    imageUrl: data.backdrop!,
                    fit: BoxFit.cover,
                  ),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          t.canvas,
                          t.canvas.withValues(alpha: 0.7),
                          t.canvas.withValues(alpha: 0.1),
                        ],
                      ),
                    ),
                  ),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                        colors: [
                          t.canvas.withValues(alpha: 0.9),
                          t.canvas.withValues(alpha: 0.25),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Positioned(
            left: g,
            right: g,
            bottom: 20,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (data.poster != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: CachedNetworkImage(
                      imageUrl: data.poster!,
                      width: phone ? 100 : 130,
                      fit: BoxFit.cover,
                    ),
                  ),
                if (data.poster != null) SizedBox(width: phone ? 16 : 26),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'COLLECTION',
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 2.6,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        data.name,
                        maxLines: phone ? 2 : 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: phone ? 30 : 44,
                          fontWeight: FontWeight.w500,
                          height: 1.03,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Text(
                            data.parts.length == 1
                                ? '${data.parts.length} film'
                                : '${data.parts.length} films',
                            style: TextStyle(
                              color: t.inkMuted,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          if (years != null) ...[
                            const SizedBox(width: 10),
                            Container(
                              width: 4,
                              height: 4,
                              decoration: BoxDecoration(
                                color: t.inkSubtle,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Flexible(
                              child: Text(
                                years,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: t.inkMuted,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (data.overview.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 720),
                          child: Text(
                            data.overview,
                            maxLines: phone ? 2 : 3,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: t.inkMuted,
                              fontSize: phone ? 13.5 : 15,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _filmsLabel(HarborTokens t, double g) => Padding(
    padding: EdgeInsets.fromLTRB(g, 24, g, 12),
    child: Text(
      'FILMS',
      style: TextStyle(
        color: t.inkSubtle,
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 2.6,
      ),
    ),
  );

  Widget _notice(HarborTokens t, String message) => Center(
    child: Padding(
      padding: const EdgeInsets.all(48),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(color: t.inkMuted, fontSize: 14.5),
      ),
    ),
  );

  /// The min–max release year across the parts, ported from `yearRange`.
  static String? _yearRange(List<MetaPreview> parts) {
    final years = parts
        .map((p) => int.tryParse(p.releaseInfo ?? ''))
        .whereType<int>()
        .where((y) => y > 1900)
        .toList();
    if (years.isEmpty) return null;
    final lo = years.reduce((a, b) => a < b ? a : b);
    final hi = years.reduce((a, b) => a > b ? a : b);
    return lo == hi ? '$lo' : '$lo-$hi';
  }
}
