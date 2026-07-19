import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/nav_controller.dart';
import '../../../app/providers.dart';
import '../../../app/sports_providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import '../../../domain/nav/frame.dart';
import '../../../domain/sports/sports_espn.dart';
import 'sports_card.dart';
import 'sports_customize_modal.dart';

/// The Live-TV sports marquee — the "Live & Upcoming" scoreboard strip with a
/// live count, league filter chips, and the game cards. Ported from
/// `SportsMarquee`; polls the scoreboard every 12 seconds and opens the match
/// detail on select. The auto-scroll is dropped in favour of D-pad scrolling.
class SportsRail extends ConsumerWidget {
  const SportsRail({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final configured = ref
        .watch(settingsProvider)
        .getStringList('sportsLeagues');
    final userLeagues = configured.isNotEmpty
        ? configured
        : kDefaultSportsLeagues;
    final selected = ref.watch(selectedSportsLeagueProvider);
    final fetchLeagues = selected == 'all' ? userLeagues : [selected];
    final games =
        ref.watch(sportsGamesProvider(fetchLeagues.join(','))).asData?.value ??
        const <SportsGame>[];
    final live = liveCount(games);

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Text(
                'Live & Upcoming',
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 2.2,
                ),
              ),
              if (live > 0) ...[
                const SizedBox(width: 10),
                Container(
                  height: 18,
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: t.danger,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '$live LIVE',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              ],
              const Spacer(),
              Focusable(
                tokens: t,
                borderRadius: 999,
                onPressed: () => _customize(context, ref, userLeagues),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: t.elevated,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: t.edgeSoft.withValues(alpha: 0.5),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.tune, size: 13, color: t.inkMuted),
                      const SizedBox(width: 6),
                      Text(
                        'Customize',
                        style: TextStyle(
                          color: t.inkMuted,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _LeagueChip(
                  label: 'All',
                  active: selected == 'all',
                  tokens: t,
                  onTap: () => ref
                      .read(selectedSportsLeagueProvider.notifier)
                      .select('all'),
                ),
                for (final key in userLeagues)
                  if (leagueByKey(key) case final def?)
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: _LeagueChip(
                        label: getLeagueLabel(def),
                        logo: def.logo,
                        active: selected == def.key,
                        tokens: t,
                        onTap: () => ref
                            .read(selectedSportsLeagueProvider.notifier)
                            .select(def.key),
                      ),
                    ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (games.isEmpty)
            Container(
              height: 60,
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              decoration: BoxDecoration(
                color: t.elevated.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: t.edgeSoft.withValues(alpha: 0.45)),
              ),
              child: Text(
                'No live or upcoming games right now.',
                style: TextStyle(color: t.inkSubtle, fontSize: 13),
              ),
            )
          else
            SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: games.length,
                separatorBuilder: (_, _) => const SizedBox(width: 16),
                itemBuilder: (context, i) => SportsCard(
                  game: games[i],
                  onSelect: (g) => ref
                      .read(navControllerProvider.notifier)
                      .push(Frame(FrameKind.matchDetail, {'game': g.toJson()})),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _customize(
    BuildContext context,
    WidgetRef ref,
    List<String> current,
  ) async {
    final keys = await showSportsCustomizeModal(
      context: context,
      tokens: ref.read(tokensProvider),
      selected: current,
    );
    if (keys != null) {
      await ref.read(settingsProvider.notifier).setValue('sportsLeagues', keys);
    }
  }
}

class _LeagueChip extends StatelessWidget {
  const _LeagueChip({
    required this.label,
    required this.active,
    required this.tokens,
    required this.onTap,
    this.logo,
  });

  final String label;
  final bool active;
  final HarborTokens tokens;
  final VoidCallback onTap;
  final String? logo;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onTap,
      child: Container(
        height: 36,
        padding: EdgeInsets.only(left: logo != null ? 6 : 14, right: 14),
        decoration: BoxDecoration(
          color: active ? t.ink : t.elevated,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active
                ? Colors.transparent
                : t.edgeSoft.withValues(alpha: 0.6),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (logo != null) ...[
              SizedBox(
                width: 24,
                height: 24,
                child: CachedNetworkImage(
                  imageUrl: logo!,
                  fit: BoxFit.contain,
                  errorWidget: (_, _, _) => const SizedBox.shrink(),
                ),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                color: active ? t.canvas : t.inkMuted,
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
