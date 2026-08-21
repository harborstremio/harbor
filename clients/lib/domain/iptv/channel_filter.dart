import 'm3u.dart';
import 'rtl.dart';

/// The synthetic group key selecting favorites. Ports `FAVORITES_GROUP_KEY`.
const String favoritesGroupKey = '__FAVORITES__';

/// The result of filtering a channel list: the visible channels, per-group
/// counts, and how many are favorited. Ports the `useChannelFilter` return.
class ChannelFilterResult {
  const ChannelFilterResult({
    required this.visible,
    required this.counts,
    required this.favoritesCount,
  });
  final List<IptvChannel> visible;
  final Map<String, int> counts;
  final int favoritesCount;
}

/// Filters [channels] by [group] (or the favorites key) and an Arabic-aware
/// [query] over "name group", also tallying per-group counts and the favorite
/// count. Ports `views/live/hooks/use-channel-filter.ts` `useChannelFilter`.
ChannelFilterResult filterChannels(
  List<IptvChannel> channels,
  String? group,
  String query, {
  Set<String> favorites = const {},
}) {
  final counts = <String, int>{};
  var favoritesCount = 0;
  for (final ch in channels) {
    final key = ch.group ?? 'Uncategorized';
    counts[key] = (counts[key] ?? 0) + 1;
    if (favorites.contains(ch.id)) favoritesCount++;
  }
  final q = query.trim().toLowerCase();
  final visible = <IptvChannel>[];
  for (final ch in channels) {
    if (group == favoritesGroupKey) {
      if (!favorites.contains(ch.id)) continue;
    } else if (group != null &&
        group.isNotEmpty &&
        (ch.group ?? 'Uncategorized') != group) {
      continue;
    }
    if (q.isNotEmpty && !arabicAwareMatch('${ch.name} ${ch.group ?? ''}', q)) {
      continue;
    }
    visible.add(ch);
  }
  return ChannelFilterResult(
    visible: visible,
    counts: counts,
    favoritesCount: favoritesCount,
  );
}
