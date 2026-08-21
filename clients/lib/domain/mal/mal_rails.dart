import '../addons/models.dart';
import 'mal_client.dart';

/// One entry from the user's MyAnimeList anime list, for the Anime-tab rails.
class MalRailEntry {
  const MalRailEntry({
    required this.id,
    required this.title,
    required this.status,
    this.poster,
    this.mean,
    this.updatedAt,
  });

  final int id;
  final String title;
  final String status;
  final String? poster;
  final double? mean;
  final String? updatedAt;
}

/// The MAL list rails, in the order the Anime tab renders them. Ported from
/// `RAIL_ORDER` in use-mal-anime-rails.ts.
const _railOrder = <({String key, String title, String status})>[
  (key: 'watching', title: 'Watching', status: 'watching'),
  (key: 'planning', title: 'Plan to Watch', status: 'plan_to_watch'),
  (key: 'completed', title: 'Completed', status: 'completed'),
  (key: 'onhold', title: 'On Hold', status: 'on_hold'),
  (key: 'dropped', title: 'Dropped', status: 'dropped'),
];

const _listPath =
    '/users/@me/animelist?fields=my_list_status,num_episodes,mean,'
    'main_picture,alternative_titles,media_type&nsfw=true&limit=1000';

MalRailEntry? _parseNode(Map node) {
  final mls = node['my_list_status'];
  if (mls is! Map) return null;
  final id = (node['id'] as num?)?.toInt();
  final title = node['title'] as String?;
  if (id == null || title == null || title.isEmpty) return null;
  final pic = node['main_picture'] as Map?;
  return MalRailEntry(
    id: id,
    title: title,
    status: '${mls['status']}',
    poster: (pic?['large'] ?? pic?['medium']) as String?,
    mean: (node['mean'] as num?)?.toDouble(),
    updatedAt: mls['updated_at'] as String?,
  );
}

/// The user's MAL anime list (first 1000, deduped by id). Ported from
/// `fetchMalList` — a MAL list beyond 1000 titles (rare) is not paged, a
/// minor deviation.
Future<List<MalRailEntry>> fetchMalAnimeList(
  MalClient client,
  String accessToken,
) async {
  final data = await client.get(_listPath, accessToken: accessToken);
  final list = (data?['data'] as List?) ?? const [];
  final out = <MalRailEntry>[];
  final seen = <int>{};
  for (final e in list.whereType<Map>()) {
    final node = e['node'];
    if (node is! Map) continue;
    final entry = _parseNode(node);
    if (entry == null || !seen.add(entry.id)) continue;
    out.add(entry);
  }
  return out;
}

/// Maps a MAL list entry to a Harbor meta. Ported from `malEntryToMeta` — the
/// MAL mean (0–10) is the rating directly.
MetaPreview malRailEntryToMeta(MalRailEntry e) => MetaPreview.fromJson({
  'id': 'mal:${e.id}',
  'type': 'series',
  'name': e.title,
  if (e.poster != null) 'poster': e.poster,
  if (e.mean != null) 'imdbRating': e.mean!.toStringAsFixed(1),
});

/// A rendered MAL rail — its key, title and metas.
typedef MalRail = ({String key, String title, List<MetaPreview> metas});

/// Groups the list entries into the status rails (Watching / Plan / Completed /
/// On Hold / Dropped), sorting the Watching + Completed rails newest-first.
/// Ported from `useMalAnimeRails`.
List<MalRail> buildMalAnimeRails(List<MalRailEntry> entries) {
  final byStatus = <String, List<MalRailEntry>>{};
  for (final e in entries) {
    (byStatus[e.status] ??= []).add(e);
  }
  final out = <MalRail>[];
  for (final rail in _railOrder) {
    var list = byStatus[rail.status] ?? const <MalRailEntry>[];
    if (rail.key == 'watching' || rail.key == 'completed') {
      list = [...list]
        ..sort((a, b) => (b.updatedAt ?? '').compareTo(a.updatedAt ?? ''));
    }
    if (list.isNotEmpty) {
      out.add((
        key: rail.key,
        title: rail.title,
        metas: [for (final e in list) malRailEntryToMeta(e)],
      ));
    }
  }
  return out;
}
