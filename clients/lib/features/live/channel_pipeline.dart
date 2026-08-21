import '../../domain/iptv/channel_filter.dart';
import '../../domain/iptv/channel_order.dart';
import '../../domain/iptv/favorites.dart';
import '../../domain/iptv/group_prefs.dart';
import '../../domain/iptv/group_relevance.dart';
import '../../domain/iptv/m3u.dart';
import '../../domain/iptv/playlist.dart';
import '../../domain/iptv/rtl.dart';
import '../../domain/iptv/top_networks.dart';
import '../../domain/iptv/vod_classify.dart';

/// The Live TV view modes. Ports the `ViewMode` union of `use-channel-pipeline`.
enum LiveViewMode { home, grid, guide, multiview }

/// The derived channel/group lists a Live TV view renders. Ports the
/// `useChannelPipeline` return value.
class ChannelPipelineResult {
  const ChannelPipelineResult({
    required this.sortedGroups,
    required this.topRows,
    required this.showTopRows,
    required this.regionChannels,
    required this.shownChannels,
    required this.mvChannels,
    required this.visible,
    required this.counts,
    required this.groupLogos,
  });

  /// Groups ordered by relevance then user pin/hide (the view's group rail).
  final List<String> sortedGroups;

  /// The region's "top networks" shelves (empty outside US/BR/GB).
  final List<NetworkRow> topRows;
  final bool showTopRows;

  /// Live channels restricted to the region (candidates for promotion).
  final List<IptvChannel> regionChannels;

  /// All live channels after relevance sort, user order, and hidden-group
  /// removal (before the current group/query filter).
  final List<IptvChannel> shownChannels;

  /// De-duplicated live channels across every loaded playlist (multiview).
  final List<IptvChannel> mvChannels;

  /// The channels visible for the current group + query (or favorites).
  final List<IptvChannel> visible;

  /// Channel counts per group (over the order-resolved channels).
  final Map<String, int> counts;

  /// The first logo seen for each group.
  final Map<String, String?> groupLogos;
}

/// Composes the Live TV channel/group pipeline for a source: live-only filter →
/// relevance sort → user order (pins + play counts) → hidden-group removal →
/// group/query (or favorites) filter, plus the guide's top-network promotion,
/// the multiview channel set, and per-group logos. Pure port of
/// `views/live/hooks/use-channel-pipeline.ts` `useChannelPipeline` (the
/// favorites-hydrate effect is a side-effect the caller triggers separately).
ChannelPipelineResult buildChannelPipeline({
  required IptvPlaylist? playlist,
  required String region,
  required List<String> preferredLanguages,
  required LiveViewMode mode,
  required String? group,
  required String query,
  required Set<String> favoriteIds,
  required Map<String, StoredFavorite> favoriteItems,
  required Map<String, IptvPlaylist> allPlaylists,
  required List<IptvPlaylistSource> allSources,
  required List<String> pinnedOrder,
  required GroupPrefs groupPrefs,
  required int Function(String id) playCount,
}) {
  final inFavorites = group == favoritesGroupKey;

  final liveChannels = [
    for (final c in playlist?.channels ?? const <IptvChannel>[])
      if (isLiveChannel(c)) c,
  ];
  final sortedChannels = sortChannelsByGroupRelevance(
    liveChannels,
    region,
    preferredLanguages,
  );
  final userChannels = applyUserChannelOrder(
    sortedChannels,
    pinnedOrder,
    playCount: playCount,
  );
  final List<IptvChannel> shownChannels;
  if (groupPrefs.hidden.isEmpty) {
    shownChannels = userChannels;
  } else {
    final hidden = groupPrefs.hidden.toSet();
    shownChannels = [
      for (final c in userChannels)
        if (!hidden.contains(c.group ?? 'Uncategorized')) c,
    ];
  }

  final liveGroups = <String>{};
  for (final c in liveChannels) {
    final g = c.group;
    if (g != null && g.isNotEmpty) liveGroups.add(g);
  }
  final sortedGroups = sortGroupsByRelevance(
    liveGroups.toList(),
    region,
    preferredLanguages,
  );
  final userGroups = applyUserGroupOrder(sortedGroups, groupPrefs);

  final topRows = rowsForRegion(region);
  final showTopRows =
      mode == LiveViewMode.grid &&
      group == null &&
      query.trim().isEmpty &&
      topRows.isNotEmpty;

  final regionChannels = filterChannelsByRegion(shownChannels, region);

  final List<IptvChannel> orderedChannels;
  if (mode != LiveViewMode.guide ||
      group != null ||
      query.trim().isNotEmpty ||
      topRows.isEmpty) {
    orderedChannels = shownChannels;
  } else {
    orderedChannels = promoteTopChannelsToFront(
      shownChannels,
      topRows,
      candidates: regionChannels,
    );
  }

  final mvOut = <IptvChannel>[];
  final seenUrls = <String>{};
  for (final pl in allPlaylists.values) {
    for (final c in pl.channels) {
      if (!isLiveChannel(c) || seenUrls.contains(c.url)) continue;
      seenUrls.add(c.url);
      mvOut.add(c);
    }
  }
  final mvChannels = sortChannelsByGroupRelevance(
    mvOut,
    region,
    preferredLanguages,
  );

  final filtered = filterChannels(
    orderedChannels,
    inFavorites ? null : group,
    query,
    favorites: favoriteIds,
  );

  final List<IptvChannel> visible;
  if (!inFavorites) {
    visible = filtered.visible;
  } else {
    final favoriteChannels = _favoriteChannels(favoriteItems, allSources);
    final q = query.trim().toLowerCase();
    visible = q.isEmpty
        ? favoriteChannels
        : [
            for (final ch in favoriteChannels)
              if (arabicAwareMatch('${ch.name} ${ch.group ?? ''}', q)) ch,
          ];
  }

  final groupLogos = <String, String?>{};
  for (final ch in shownChannels) {
    final g = ch.group ?? 'Uncategorized';
    final logo = ch.logo;
    if (!groupLogos.containsKey(g) && logo != null && logo.isNotEmpty) {
      groupLogos[g] = logo;
    }
  }

  return ChannelPipelineResult(
    sortedGroups: userGroups,
    topRows: topRows,
    showTopRows: showTopRows,
    regionChannels: regionChannels,
    shownChannels: shownChannels,
    mvChannels: mvChannels,
    visible: visible,
    counts: filtered.counts,
    groupLogos: groupLogos,
  );
}

List<IptvChannel> _favoriteChannels(
  Map<String, StoredFavorite> favoriteItems,
  List<IptvPlaylistSource> allSources,
) {
  final nameById = {for (final s in allSources) s.id: s.name};
  final ready =
      [
        for (final f in favoriteItems.values)
          if (f.url.isNotEmpty) f,
      ]..sort((a, b) {
        final na = nameById[a.sourceId] ?? a.sourceId;
        final nb = nameById[b.sourceId] ?? b.sourceId;
        final byName = na.compareTo(nb);
        return byName != 0 ? byName : a.name.compareTo(b.name);
      });
  return [
    for (final f in ready)
      IptvChannel(
        id: f.id,
        tvgId: f.tvgId,
        name: f.name,
        logo: f.logo,
        group: nameById[f.sourceId] ?? 'Favorites',
        url: f.url,
      ),
  ];
}
