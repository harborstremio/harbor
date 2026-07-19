import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/awards_providers.dart';
import '../../design/awards/award_icons.dart';
import '../../design/tokens.dart';
import '../../domain/awards/wikidata_awards.dart';

const Map<AwardType, String> _headlineFor = {
  AwardType.oscar: 'Academy Award',
  AwardType.emmy: 'Primetime Emmy',
  AwardType.bafta: 'BAFTA',
  AwardType.goldenGlobe: 'Golden Globe',
  AwardType.sag: 'SAG Award',
  AwardType.cannes: 'Cannes',
  AwardType.venice: 'Venice',
  AwardType.berlin: 'Berlin',
  AwardType.criticsChoice: "Critics' Choice",
};

const Map<AwardType, String> _nounFor = {
  AwardType.oscar: 'Oscar',
  AwardType.emmy: 'Emmy',
  AwardType.bafta: 'BAFTA',
  AwardType.goldenGlobe: 'Golden Globe',
  AwardType.sag: 'SAG Award',
  AwardType.cannes: 'Cannes Award',
  AwardType.venice: 'Venice Award',
  AwardType.berlin: 'Berlin Award',
  AwardType.criticsChoice: "Critics' Choice Award",
};

String _pluralNoun(AwardType type, int n) {
  final base = _nounFor[type] ?? 'Award';
  if (n == 1 || base.endsWith('s')) return base;
  return '${base}s';
}

/// The award badge overlaid on the detail hero's bottom-right: the title's top
/// award body as a laurel + a "N Oscars · N BAFTAs" summary. Ported from the web
/// `MetaAwardsCorner` (classic branch), merging the live Wikidata awards with
/// the bundled history. Hides itself on narrow heroes and for anime (the anime
/// award corner is a separate dataset). Decorative — non-interactive.
class MetaAwardsCorner extends ConsumerWidget {
  const MetaAwardsCorner({
    super.key,
    required this.imdbId,
    required this.name,
    required this.year,
    required this.isAnime,
    required this.tokens,
  });

  final String imdbId;
  final String name;
  final int? year;
  final bool isAnime;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isAnime) return const SizedBox.shrink();
    final t = tokens;
    final live =
        ref.watch(awardsProvider(imdbId)).value ?? const <AwardEntry>[];
    final history = ref.watch(awardsHistoryProvider).value;
    final awards = history != null
        ? history.mergeBundledAwards(live, name, year: year)
        : live;
    final summary = awardSummary(awards).take(2).toList();
    if (summary.isEmpty) return const SizedBox.shrink();

    return LayoutBuilder(
      builder: (context, c) {
        // Match the web host-width tiers: hidden < 520, compact < 820, else full.
        if (c.maxWidth < 520) return const SizedBox.shrink();
        final compact = c.maxWidth < 820;
        final top = summary.first;
        final won = top.wins > 0;
        final tint = laurelColorFor(top.type);

        final lines = <String>[];
        for (final item in summary) {
          if (item.wins > 0) {
            // A body with both wins and nominations shows both, 1:1 with web
            // ('3 Oscars · 5 nominations').
            var line = '${item.wins} ${_pluralNoun(item.type, item.wins)}';
            if (item.nominations > 0) {
              line +=
                  ' · ${item.nominations} '
                  '${item.nominations == 1 ? 'nomination' : 'nominations'}';
            }
            lines.add(line);
          } else if (item.nominations > 0) {
            lines.add(
              '${item.nominations} ${_pluralNoun(item.type, item.nominations)} '
              '${item.nominations == 1 ? 'nomination' : 'nominations'}',
            );
          }
        }
        final headline = compact
            ? 'Award ${won ? 'Winner' : 'Nominee'}'
            : '${_headlineFor[top.type] ?? 'Award'} ${won ? 'Winner' : 'Nominee'}';

        return Align(
          alignment: Alignment.bottomRight,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(0, 0, 40, 40),
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: c.maxWidth * 0.44),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          headline.toUpperCase(),
                          textAlign: TextAlign.right,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t.ink.withValues(alpha: 0.55),
                            fontSize: compact ? 9.5 : 10.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.8,
                          ),
                        ),
                        if (!compact)
                          for (final l in lines.take(2))
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                l,
                                textAlign: TextAlign.right,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: t.ink.withValues(alpha: 0.85),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (won)
                    Laurel(
                      size: compact ? 48 : 68,
                      color: tint,
                      child: AwardLogo(type: top.type, size: compact ? 18 : 24),
                    )
                  else
                    SizedBox(
                      width: compact ? 44 : 64,
                      height: compact ? 44 : 64,
                      child: Center(
                        child: Opacity(
                          opacity: 0.85,
                          child: AwardLogo(
                            type: top.type,
                            size: compact ? 26 : 36,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
