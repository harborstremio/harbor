import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/curated.dart';
import '../../../domain/addons/resolved_addon.dart';
import '../addon_utils.dart';
import 'category_grid.dart';
import 'community_addons_rail.dart';
import 'hero_card.dart';
import 'rail.dart';

/// The Discover tab body — the sign-in nudge, the featured hero, the community
/// ratings rail, an Editor-picks "Starters" rail, the category grid, and the
/// remaining curated rails. Ported 1:1 from `DiscoverPane`.
class DiscoverPane extends ConsumerWidget {
  const DiscoverPane({
    super.key,
    required this.hero,
    required this.rails,
    required this.installedIds,
    required this.authKey,
    required this.onOpen,
    required this.onInstall,
    required this.onUninstall,
    required this.onCategorySelect,
    this.onRefetch,
  });

  final DiscoverHero? hero;
  final List<DiscoverRail> rails;
  final Set<String> installedIds;
  final String? authKey;
  final void Function(String id) onOpen;
  final Future<void> Function(ResolvedAddon) onInstall;
  final Future<void> Function(ResolvedAddon) onUninstall;
  final void Function(String cat) onCategorySelect;
  final VoidCallback? onRefetch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);

    DiscoverRail? essential;
    final other = <DiscoverRail>[];
    for (final r in rails) {
      if (r.rail.id == 'essential') {
        essential = r;
      } else {
        other.add(r);
      }
    }
    final heroId = hero?.entry.id ?? '';
    final editorPicks = essential == null
        ? const <ResolvedAddon>[]
        : [
            for (final it in essential.items)
              if (idOf(it) != heroId) it,
          ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (authKey == null)
          Padding(
            padding: const EdgeInsets.only(bottom: 40),
            child: _signInBanner(t),
          ),
        if (hero != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 40),
            child: HeroCard(
              resolved: hero!.resolved,
              onOpen: () => onOpen(hero!.entry.id),
              onInstall: () => onInstall(hero!.resolved),
              onUninstall: () => onUninstall(hero!.resolved),
              installed: installedIds.contains(hero!.entry.id),
            ),
          ),
        CommunityAddonsRail(
          installedIds: installedIds,
          onOpen: onOpen,
          onChange: onRefetch,
        ),
        if (editorPicks.isNotEmpty)
          Rail(
            title: 'Starters',
            blurb: 'Common picks for a fresh setup.',
            layout: CuratedRailLayout.list,
            items: editorPicks,
            installedIds: installedIds,
            onOpen: onOpen,
            onInstall: onInstall,
            onUninstall: onUninstall,
          ),
        CategoryGrid(onCategorySelect: onCategorySelect),
        for (final entry in other)
          Rail(
            title: entry.rail.title,
            blurb: entry.rail.blurb,
            layout: entry.rail.layout,
            items: entry.items,
            installedIds: installedIds,
            onOpen: onOpen,
            onInstall: onInstall,
            onUninstall: onUninstall,
          ),
      ],
    );
  }

  Widget _signInBanner(HarborTokens t) {
    const amber = Color(0xFFFCD34D);
    const amberText = Color(0xFFFDE68A);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: amber.withValues(alpha: 0.06),
        border: Border.all(color: amber.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sign in to sync your addons across devices',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: amberText,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Anything you install in Harbor pushes back to your Stremio account '
            'so it shows up on mobile too. Sign in via the avatar in the '
            'bottom-left of the sidebar.',
            style: TextStyle(fontSize: 13.5, height: 1.5, color: t.inkMuted),
          ),
        ],
      ),
    );
  }
}
