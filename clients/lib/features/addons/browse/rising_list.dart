import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/layout/idiom.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/addons_velocity.dart';
import '../../../domain/addons/community_index.dart';
import '../../../domain/addons/models.dart';
import '../../../domain/addons/stremio_addons_client.dart';
import 'community_row.dart';

const _rose300 = Color(0xFFFDA4AF);
const _rose500 = Color(0xFFF43F5E);

/// The "Top rising" browse list, ported 1:1 from `RisingList`: the site rising
/// board first, then locally-computed top movers, then a "no velocity data" card
/// once neither has anything.
class RisingList extends ConsumerWidget {
  const RisingList({
    super.key,
    required this.category,
    required this.search,
    required this.allowAdult,
    required this.installedIds,
    required this.onOpen,
    this.onChange,
  });

  final String? category;
  final String? search;
  final bool allowAdult;
  final Set<String> installedIds;
  final void Function(String manifestId) onOpen;
  final VoidCallback? onChange;

  bool _isInstalled(SAAddon a) {
    final id = a.manifest?.id;
    return id != null && id.isNotEmpty && installedIds.contains(id);
  }

  bool _matchesText(String q, String name, String slug, String desc) =>
      name.toLowerCase().contains(q) ||
      slug.toLowerCase().contains(q) ||
      desc.toLowerCase().contains(q);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final q = search?.trim().toLowerCase() ?? '';
    final rising = ref.watch(risingProvider).value ?? const <SARisingAddon>[];

    final official = rising.where((a) {
      if (!allowAdult && category != 'nsfw' && (a.manifest?.adult ?? false)) {
        return false;
      }
      if (category != null && !a.categories.any((c) => c.slug == category)) {
        return false;
      }
      if (q.isNotEmpty &&
          !_matchesText(
            q,
            a.manifest?.name ?? '',
            a.slug,
            a.manifest?.description ?? '',
          )) {
        return false;
      }
      return true;
    }).toList();

    if (official.isNotEmpty) {
      return _list(context, [
        for (final a in official)
          CommunityRow(
            addon: a,
            installed: _isInstalled(a),
            onOpen: onOpen,
            onChange: onChange,
            showRising: true,
            risingDelta: a.recentStars,
            risingWindow: 1,
          ),
      ]);
    }

    final movers = (ref.watch(moversProvider(80)).value ?? const <MoverEntry>[])
        .where((m) {
          if (category != null &&
              !m.community.categories.any((c) => c.slug == category)) {
            return false;
          }
          if (q.isNotEmpty &&
              !_matchesText(
                q,
                m.community.name ?? '',
                m.community.slug,
                m.community.description ?? '',
              )) {
            return false;
          }
          return true;
        })
        .toList();

    if (movers.isEmpty) return _emptyCard(t);

    return _list(context, [
      for (final m in movers)
        CommunityRow(
          addon: _synthetic(m.community),
          installed: _isInstalled(_synthetic(m.community)),
          onOpen: onOpen,
          onChange: onChange,
          showRising: true,
          risingDelta: m.delta,
          risingWindow: m.windowDays,
        ),
    ]);
  }

  SAAddon _synthetic(SACommunity c) => SAAddon(
    uuid: c.uuid,
    url: c.url,
    manifestUrl: c.manifestUrl,
    slug: c.slug,
    stars: c.stars,
    categories: c.categories,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    manifest: Manifest({
      'id': c.manifestId ?? '',
      'name': c.name ?? c.slug,
      'description': c.description ?? '',
      'logo': ?c.logo,
      'background': ?c.background,
    }),
  );

  Widget _list(BuildContext context, List<Widget> rows) => ListView.separated(
    // Clear the TV overscan crop so the last row isn't eaten by the bezel.
    padding: EdgeInsets.only(
      bottom: 24 + overscanInset(Idiom.of(context)).bottom,
    ),
    itemCount: rows.length,
    separatorBuilder: (_, _) => const SizedBox(height: 8),
    itemBuilder: (_, i) => rows[i],
  );

  Widget _emptyCard(HarborTokens t) => Center(
    child: Container(
      constraints: const BoxConstraints(maxWidth: 520),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edge, style: BorderStyle.solid),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _rose500.withValues(alpha: 0.15),
              border: Border.all(color: _rose500.withValues(alpha: 0.3)),
            ),
            child: const Icon(Icons.trending_up, size: 20, color: _rose300),
          ),
          const SizedBox(height: 12),
          Text(
            'No velocity data yet',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: t.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Trending tracks star growth across your Harbor visits. Open the '
            'addons page again tomorrow and the top risers will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12.5, height: 1.5, color: t.inkMuted),
          ),
        ],
      ),
    ),
  );
}
