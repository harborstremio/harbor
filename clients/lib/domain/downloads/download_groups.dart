import 'downloads_store.dart';

// Groups downloads for the Downloads view, ported from the `buildGroups` spec in
// `docs/60`: each movie is its own group; episodes group by series id. Groups
// are ordered by their best (lowest) status rank, then by most-recent start.

enum DownloadGroupKind { movie, show }

/// A Downloads-view group: a single movie, or a series' episodes.
class DownloadGroup {
  const DownloadGroup({required this.kind, required this.items});
  final DownloadGroupKind kind;
  final List<DownloadItem> items;
}

int _statusRank(DownloadStatus s) => switch (s) {
  DownloadStatus.downloading => 0,
  DownloadStatus.error => 1,
  DownloadStatus.done => 2,
  _ => 3,
};

/// Buckets [items] into movie / show groups and sorts them by best status rank
/// then most-recent `startedAt`. [items] is expected newest-first already.
List<DownloadGroup> buildDownloadGroups(List<DownloadItem> items) {
  final showOrder = <String>[];
  final shows = <String, List<DownloadItem>>{};
  final groups = <DownloadGroup>[];
  for (final item in items) {
    if (item.season != null) {
      if (!shows.containsKey(item.metaId)) showOrder.add(item.metaId);
      shows.putIfAbsent(item.metaId, () => []).add(item);
    } else {
      groups.add(DownloadGroup(kind: DownloadGroupKind.movie, items: [item]));
    }
  }
  for (final id in showOrder) {
    // Episodes read in natural season/episode order within a show, not the
    // newest-first store order (web `ShowGroup` sort).
    final episodes = [...shows[id]!]
      ..sort((a, b) {
        final s = (a.season ?? 0).compareTo(b.season ?? 0);
        return s != 0 ? s : (a.episode ?? 0).compareTo(b.episode ?? 0);
      });
    groups.add(DownloadGroup(kind: DownloadGroupKind.show, items: episodes));
  }

  int bestRank(DownloadGroup g) =>
      g.items.map((i) => _statusRank(i.status)).reduce((a, b) => a < b ? a : b);
  int mostRecent(DownloadGroup g) =>
      g.items.map((i) => i.startedAt).reduce((a, b) => a > b ? a : b);

  groups.sort((a, b) {
    final r = bestRank(a).compareTo(bestRank(b));
    if (r != 0) return r;
    return mostRecent(b).compareTo(mostRecent(a));
  });
  return groups;
}
