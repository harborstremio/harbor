import '../anime/anime_mapping.dart';
import '../anime/kitsu_client.dart';
import 'mal_client.dart';

/// The user's MyAnimeList list entry for a title. Ported from the
/// `my_list_status` shape in `mal/mutations.ts`.
class MalEntry {
  const MalEntry({required this.status, required this.numEpisodesWatched});

  /// `watching`, `completed`, `on_hold`, `dropped`, `plan_to_watch`.
  final String status;
  final int numEpisodesWatched;
}

/// A title's episode count and the user's list entry. Ported from
/// `ListEntryInfo`.
class MalListEntry {
  const MalListEntry({this.numEpisodes, this.entry});
  final int? numEpisodes;
  final MalEntry? entry;
}

/// The watched episode keys (`season:episode`) and whether the title is
/// completed. Ported from `MalWatched`.
class MalWatchedResult {
  const MalWatchedResult({required this.watchedKeys, required this.completed});
  final Set<String> watchedKeys;
  final bool completed;

  static const empty = MalWatchedResult(
    watchedKeys: <String>{},
    completed: false,
  );
}

int? _leadingInt(String v) => int.tryParse(v.split(':').first);

int _season(KitsuEpisode e) => e.seasonNumber == 0 ? 1 : e.seasonNumber;

/// Resolves a Harbor id (`mal:`/`anilist:`/`kitsu:`) to a MyAnimeList media id.
/// Ported from `resolveMalMediaId`.
Future<int?> resolveMalMediaId(AnimeMapper mapper, String harborId) async {
  if (harborId.startsWith('mal:')) {
    return _leadingInt(harborId.substring(4));
  }
  if (harborId.startsWith('anilist:')) {
    final a = _leadingInt(harborId.substring(8));
    return a != null ? mapper.anilistToMal(a) : null;
  }
  if (harborId.startsWith('kitsu:')) {
    final k = _leadingInt(harborId.substring(6));
    if (k == null) return null;
    final a = await mapper.kitsuToAnilist(k);
    return a != null ? mapper.anilistToMal(a) : null;
  }
  return null;
}

/// Fetches the user's list entry for [malId]. Ported from `fetchListEntry`.
Future<MalListEntry?> fetchMalListEntry(
  MalClient client,
  String accessToken,
  int malId,
) async {
  final data = await client.get(
    '/anime/$malId?fields=num_episodes,my_list_status',
    accessToken: accessToken,
  );
  if (data == null) return null;
  final s = data['my_list_status'];
  MalEntry? entry;
  if (s is Map && s['status'] is String) {
    entry = MalEntry(
      status: s['status'] as String,
      numEpisodesWatched: (s['num_episodes_watched'] as num?)?.toInt() ?? 0,
    );
  }
  return MalListEntry(
    numEpisodes: (data['num_episodes'] as num?)?.toInt(),
    entry: entry,
  );
}

/// Builds the watched key set from a list [entry] and the ordered [episodes]:
/// the first N episodes (all when completed, else the watched count) are
/// watched. Ported from the mapping in `useMalWatched`.
MalWatchedResult malWatchedKeys(MalEntry entry, List<KitsuEpisode> episodes) {
  final sorted = [...episodes]
    ..sort((a, b) {
      final s = _season(a).compareTo(_season(b));
      return s != 0 ? s : a.number.compareTo(b.number);
    });
  final total = sorted.length;
  final watchedCount = entry.status == 'completed'
      ? total
      : entry.numEpisodesWatched.clamp(0, total);
  final watchedKeys = <String>{};
  for (var i = 0; i < watchedCount; i++) {
    final ep = sorted[i];
    watchedKeys.add('${_season(ep)}:${ep.number}');
  }
  final completed =
      entry.status == 'completed' ||
      (total <= 1 && entry.numEpisodesWatched >= 1);
  return MalWatchedResult(watchedKeys: watchedKeys, completed: completed);
}
