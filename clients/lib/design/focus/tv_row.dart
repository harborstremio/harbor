import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../domain/addons/models.dart';
import '../../domain/nav/frame.dart';
import '../layout/idiom.dart';
import '../tokens.dart';
import 'focusable.dart';
import 'focusable_poster.dart';

/// A titled horizontal rail of poster tiles. Its own [FocusTraversalGroup] keeps
/// left/right movement within the row; the focused item scrolls into view. Cell
/// size follows the user's `posterScale`.
class TvRow extends ConsumerWidget {
  const TvRow({
    super.key,
    required this.title,
    required this.items,
    required this.tokens,
    required this.onSelect,
    this.autofocusFirst = false,
    this.viewAll = true,
    this.kicker,
    this.sourceBadge,
    this.kids = false,
    this.trailing,
  });

  final String title;

  /// An optional muted sub-line under the title (the filter rails' kicker).
  final String? kicker;

  /// An optional source pill shown after the title (e.g. `Letterboxd` for the
  /// Stremboxd-bridged rows), mirroring the web row's amber source chip.
  final String? sourceBadge;
  final List<MetaPreview> items;
  final HarborTokens tokens;
  final void Function(MetaPreview item) onSelect;
  final bool autofocusFirst;

  /// Whether to offer a "View all" action opening the full grid (shown only
  /// when the row holds more than a screenful; disable for special rails).
  final bool viewAll;

  /// Whether this row is on the kids surface (star-style rating badge).
  final bool kids;

  /// An optional focusable control shown at the end of the header row, left of
  /// "View all" (e.g. a Pin-to-Home toggle on a browse catalog).
  final Widget? trailing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final tr = ref.watch(translationsProvider);
    final scale = settings.getDouble('posterScale');
    final width = scaledPosterCell(150, scale);
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 4, g, 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: tokens.ink,
                              fontSize: scaledRowTitle(
                                20,
                                settings.getDouble('rowTitleScale'),
                              ),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (sourceBadge != null) ...[
                          const SizedBox(width: 8),
                          _SourceBadge(label: sourceBadge!),
                        ],
                      ],
                    ),
                    if (kicker != null)
                      Text(
                        kicker!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: tokens.inkSubtle,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
              ),
              ?trailing,
              if (viewAll && items.length > 12)
                Focusable(
                  tokens: tokens,
                  scale: 1.0,
                  borderRadius: 8,
                  onPressed: () => ref
                      .read(navControllerProvider.notifier)
                      .push(
                        Frame(FrameKind.grid, {
                          'title': title,
                          'items': [for (final i in items) i.json],
                        }),
                      ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    child: Text(
                      tr.t('View all'),
                      style: TextStyle(
                        color: tokens.inkMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        SizedBox(
          height: scaledRailHeight(
            scale,
            hideTitles: settings.getBool('hidePosterTitles'),
          ),
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) => FocusablePoster(
                item: items[i],
                tokens: tokens,
                width: width,
                autofocus: autofocusFirst && i == 0,
                kids: kids,
                onPressed: () => onSelect(items[i]),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The amber source pill after a row title (web's `bg-amber-400/10` /
/// `text-amber-300/80` chip on the Letterboxd rows).
class _SourceBadge extends StatelessWidget {
  const _SourceBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0x1AFBBF24),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          color: Color(0xCCFCD34D),
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}
