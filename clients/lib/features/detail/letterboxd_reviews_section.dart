import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/stremboxd_providers.dart';
import '../../core/net/safe_launch.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/stremboxd/letterboxd_reviews.dart';

/// The detail-page Letterboxd reviews section (web detail `LetterboxdReviews`) —
/// popular community reviews scraped from the film's Letterboxd page. Read-only,
/// films only, self-hides when there are none. Honors the shared `blurComments`
/// reveal gate like the Trakt / AniList comment sections.
class LetterboxdReviewsSection extends ConsumerStatefulWidget {
  const LetterboxdReviewsSection({
    super.key,
    required this.type,
    required this.id,
    required this.tokens,
  });

  final String type;
  final String id;
  final HarborTokens tokens;

  @override
  ConsumerState<LetterboxdReviewsSection> createState() =>
      _LetterboxdReviewsSectionState();
}

class _LetterboxdReviewsSectionState
    extends ConsumerState<LetterboxdReviewsSection> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final reviews =
        ref
            .watch(
              letterboxdReviewsProvider((type: widget.type, id: widget.id)),
            )
            .asData
            ?.value ??
        const <LetterboxdReview>[];
    if (reviews.isEmpty) return const SizedBox.shrink();

    final t = widget.tokens;
    final g = pageGutter(Idiom.of(context));
    final tr = ref.watch(translationsProvider);
    final blurred =
        ref.watch(settingsProvider).getBool('blurComments') && !_revealed;

    final list = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final r in reviews) _ReviewTile(review: r, tokens: t, tr: tr),
      ],
    );

    return Padding(
      padding: EdgeInsets.fromLTRB(g, 40, g, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr.t('Letterboxd Reviews'),
            style: TextStyle(
              color: t.ink,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          if (blurred)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Stack(
                children: [
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 200),
                    child: list,
                  ),
                  Positioned.fill(
                    child: BackdropFilter(
                      filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              t.canvas.withValues(alpha: 0.05),
                              t.canvas.withValues(alpha: 0.78),
                              t.canvas.withValues(alpha: 0.95),
                            ],
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 48, bottom: 16),
                          child: Center(
                            child: Focusable(
                              tokens: t,
                              borderRadius: 12,
                              onPressed: () => setState(() => _revealed = true),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: t.ink,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  tr.t('Reveal comments'),
                                  style: TextStyle(
                                    color: t.canvas,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            list,
        ],
      ),
    );
  }
}

String _reviewDate(String? iso) {
  if (iso == null) return '';
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[d.month - 1]} ${d.day}, ${d.year}';
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({
    required this.review,
    required this.tokens,
    required this.tr,
  });

  final LetterboxdReview review;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final r = review;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipOval(
            child: SizedBox(
              width: 34,
              height: 34,
              child: r.avatar != null
                  ? CachedNetworkImage(
                      imageUrl: r.avatar!,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => _initial(t, r.author),
                      placeholder: (_, _) => _initial(t, r.author),
                    )
                  : _initial(t, r.author),
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
                      child: Focusable(
                        tokens: t,
                        borderRadius: 6,
                        onPressed: () {
                          if (r.authorUrl.isNotEmpty) {
                            launchExternalUrl(r.authorUrl);
                          }
                        },
                        child: Text(
                          r.author.isNotEmpty ? r.author : tr.t('Anonymous'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    if (r.rating != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        r.rating!,
                        style: const TextStyle(
                          color: Color(0xFFFCD34D),
                          fontSize: 13,
                        ),
                      ),
                    ],
                    if (r.lang != null && r.lang != 'en') ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: t.raised,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          r.lang!.toUpperCase(),
                          style: TextStyle(color: t.inkSubtle, fontSize: 9),
                        ),
                      ),
                    ],
                    const Spacer(),
                    Text(
                      _reviewDate(r.date),
                      style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  r.text,
                  style: TextStyle(
                    color: t.inkMuted,
                    fontSize: 13.5,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _initial(HarborTokens t, String name) => ColoredBox(
    color: t.inkMuted.withValues(alpha: 0.2),
    child: Center(
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(
          color: t.inkMuted,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );
}
