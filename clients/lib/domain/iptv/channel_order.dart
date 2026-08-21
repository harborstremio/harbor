import 'channel_stats.dart';
import 'group_prefs.dart';
import 'm3u.dart';

/// Reorders channels for display: pinned channels first (in pin order), then
/// most-watched channels (≥ [mostWatchedMin] plays, by play count desc), then
/// everything else in original order. Ports `applyUserChannelOrder` — the
/// play-count read becomes the injected [playCount] callback.
List<IptvChannel> applyUserChannelOrder(
  List<IptvChannel> channels,
  List<String> pinnedOrder, {
  required int Function(String id) playCount,
  int mostWatchedMin = mostWatchedMinPlays,
}) {
  if (channels.isEmpty) return channels;
  final pinRank = <String, int>{
    for (var i = 0; i < pinnedOrder.length; i++) pinnedOrder[i]: i,
  };
  final pinned = <IptvChannel>[];
  final watched = <({IptvChannel ch, int n})>[];
  final rest = <IptvChannel>[];
  for (final ch in channels) {
    if (pinRank.containsKey(ch.id)) {
      pinned.add(ch);
      continue;
    }
    final n = playCount(ch.id);
    if (n >= mostWatchedMin) {
      watched.add((ch: ch, n: n));
      continue;
    }
    rest.add(ch);
  }
  if (pinned.isEmpty && watched.isEmpty) return channels;
  pinned.sort((a, b) => (pinRank[a.id] ?? 0).compareTo(pinRank[b.id] ?? 0));
  watched.sort((a, b) => b.n.compareTo(a.n));
  return [...pinned, ...watched.map((w) => w.ch), ...rest];
}

/// Reorders groups: hidden groups removed, pinned groups first (in pin order),
/// then the rest in original order. Ports `applyUserGroupOrder`.
List<String> applyUserGroupOrder(List<String> groups, GroupPrefs prefs) {
  if (prefs.pinned.isEmpty && prefs.hidden.isEmpty) return groups;
  final hidden = prefs.hidden.toSet();
  final pinRank = <String, int>{
    for (var i = 0; i < prefs.pinned.length; i++) prefs.pinned[i]: i,
  };
  final pinned = <String>[];
  final rest = <String>[];
  for (final g in groups) {
    if (hidden.contains(g)) continue;
    if (pinRank.containsKey(g)) {
      pinned.add(g);
    } else {
      rest.add(g);
    }
  }
  pinned.sort((a, b) => (pinRank[a] ?? 0).compareTo(pinRank[b] ?? 0));
  return [...pinned, ...rest];
}
