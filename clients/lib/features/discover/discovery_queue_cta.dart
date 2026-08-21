import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/feed_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/layout/idiom.dart';
import '../../domain/feed/feed_pool.dart';
import '../../domain/nav/frame.dart';

/// The Discover entry point into the one-at-a-time Discovery Queue: a banner of
/// the next few picks behind an "Explore your queue" pill. Ported 1:1 from
/// `components/discovery-queue-cta.tsx`; hides itself when the pool is empty.
class DiscoveryQueueCta extends ConsumerWidget {
  const DiscoveryQueueCta({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final pool = ref.watch(feedPoolProvider).value ?? const <FeedItem>[];
    final peek = pool.take(6).toList();
    if (peek.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: pageGutter(Idiom.of(context))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  tr.t('Your Discovery Queue'),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 28,
                    fontWeight: FontWeight.w500,
                    letterSpacing: -0.4,
                    height: 1.1,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  tr.t('{count} picks ready', {
                    'count': pool.length,
                  }).toUpperCase(),
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 12.5,
                    letterSpacing: 2.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Focusable(
            tokens: t,
            borderRadius: 16,
            onPressed: () => ref
                .read(navControllerProvider.notifier)
                .push(const Frame(FrameKind.queue, <String, Object?>{})),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: SizedBox(
                height: 156,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: t.elevated.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: t.edgeSoft),
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Row(
                        children: [
                          for (var i = 0; i < peek.length; i++)
                            Expanded(
                              child: Padding(
                                padding: EdgeInsets.only(left: i == 0 ? 0 : 1),
                                child: Opacity(
                                  opacity: 0.45 + i * 0.06,
                                  child: RpdbPosterImage(
                                    metaId: peek[i].meta.id,
                                    rawPoster:
                                        peek[i].meta.background ??
                                        peek[i].meta.poster,
                                    type: peek[i].meta.type,
                                    tokens: t,
                                    fallback: () =>
                                        ColoredBox(color: t.surface),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                      // The dark-light-dark wash that keeps the pill legible.
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [
                              Colors.black.withValues(alpha: 0.85),
                              Colors.black.withValues(alpha: 0.35),
                              Colors.black.withValues(alpha: 0.85),
                            ],
                            stops: const [0, 0.5, 1],
                          ),
                        ),
                      ),
                      Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 560),
                          child: Container(
                            height: 56,
                            margin: const EdgeInsets.symmetric(horizontal: 48),
                            padding: const EdgeInsets.symmetric(horizontal: 32),
                            decoration: BoxDecoration(
                              color: t.canvas.withValues(alpha: 0.85),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: t.ink.withValues(alpha: 0.15),
                              ),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    tr.t('Explore your queue'),
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: t.ink,
                                      fontSize: 18,
                                      fontWeight: FontWeight.w500,
                                      letterSpacing: -0.3,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Icon(
                                  Icons.arrow_forward,
                                  size: 18,
                                  color: t.inkSubtle,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
