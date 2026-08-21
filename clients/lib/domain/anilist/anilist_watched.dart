import '../anime/anime_mapping.dart';
import '../anime/kitsu_client.dart';
import 'anilist_client.dart';

/// The user's AniList list entry for a title. Ported from the `mediaListEntry`
/// shape.
class AnilistEntry {
  const AnilistEntry({required this.status, required this.progress, this.id});

  /// The AniList list-entry id, needed to delete the entry. Null when unknown.
  final int? id;

  /// `CURRENT`, `COMPLETED`, `PAUSED`, `DROPPED`, `PLANNING`, `REPEATING`.
  final String status;
  final int progress;
}

/// A title's episode count and the user's list entry. Ported from
/// `ListEntryInfo`.
class AnilistListEntry {
  const AnilistListEntry({this.episodes, this.entry});
  final int? episodes;
  final AnilistEntry? entry;
}

/// The watched episode keys (`season:episode`) and whether the title is
/// completed. Ported from `AnilistWatched`.
class AnilistWatchedResult {
  const AnilistWatchedResult({
    required this.watchedKeys,
    required this.completed,
  });
  final Set<String> watchedKeys;
  final bool completed;

  static const empty = AnilistWatchedResult(
    watchedKeys: <String>{},
    completed: false,
  );
}

const _malQuery =
    r'query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id } }';
const _listEntryQuery =
    r'query ($mediaId: Int) { Media(id: $mediaId, type: ANIME) '
    r'{ episodes mediaListEntry { id status progress } } }';

int? _leadingInt(String v) => int.tryParse(v.split(':').first);

int _season(KitsuEpisode e) => e.seasonNumber == 0 ? 1 : e.seasonNumber;

/// Resolves a Harbor id (`anilist:`/`kitsu:`/`mal:`) to an AniList media id.
/// Ported from `resolveAnilistMediaId`.
Future<int?> resolveAnilistMediaId(
  AnimeMapper mapper,
  AnilistClient client,
  String harborId,
) async {
  if (harborId.startsWith('anilist:')) {
    return _leadingInt(harborId.substring(8));
  }
  if (harborId.startsWith('kitsu:')) {
    final k = _leadingInt(harborId.substring(6));
    return k != null ? mapper.kitsuToAnilist(k) : null;
  }
  if (harborId.startsWith('mal:')) {
    final m = _leadingInt(harborId.substring(4));
    return m != null ? _malToAnilist(client, m) : null;
  }
  return null;
}

Future<int?> _malToAnilist(AnilistClient client, int idMal) async {
  try {
    final data = await client.request(
      _malQuery,
      variables: {'idMal': idMal},
      skipAuth: true,
    );
    final media = data?['Media'];
    return media is Map ? (media['id'] as num?)?.toInt() : null;
  } catch (_) {
    return null;
  }
}

/// Fetches the user's list entry for [mediaId]. Ported from `fetchListEntry`.
Future<AnilistListEntry?> fetchAnilistListEntry(
  AnilistClient client,
  String accessToken,
  int mediaId,
) async {
  final data = await client.request(
    _listEntryQuery,
    variables: {'mediaId': mediaId},
    accessToken: accessToken,
  );
  final media = data?['Media'];
  if (media is! Map) return null;
  final e = media['mediaListEntry'];
  AnilistEntry? entry;
  if (e is Map && e['status'] is String) {
    entry = AnilistEntry(
      id: (e['id'] as num?)?.toInt(),
      status: e['status'] as String,
      progress: (e['progress'] as num?)?.toInt() ?? 0,
    );
  }
  return AnilistListEntry(
    episodes: (media['episodes'] as num?)?.toInt(),
    entry: entry,
  );
}

/// Builds the watched key set from a list [entry] and the ordered [episodes]:
/// the first N episodes (all when completed, else the progress count) are
/// watched. Ported from the mapping in `useAnilistWatched`.
AnilistWatchedResult anilistWatchedKeys(
  AnilistEntry entry,
  List<KitsuEpisode> episodes,
) {
  final sorted = [...episodes]
    ..sort((a, b) {
      final s = _season(a).compareTo(_season(b));
      return s != 0 ? s : a.number.compareTo(b.number);
    });
  final total = sorted.length;
  final watchedCount = entry.status == 'COMPLETED'
      ? total
      : entry.progress.clamp(0, total);
  final watchedKeys = <String>{};
  for (var i = 0; i < watchedCount; i++) {
    final ep = sorted[i];
    watchedKeys.add('${_season(ep)}:${ep.number}');
  }
  final completed =
      entry.status == 'COMPLETED' || (total <= 1 && entry.progress >= 1);
  return AnilistWatchedResult(watchedKeys: watchedKeys, completed: completed);
}
