import '../../core/http/json_transport.dart';

/// The set of anime (by MAL id and AniList id) that have an English dub,
/// resolved from the community dub schedule. Ported 1:1 from web
/// `anime-dub-sub.ts`.
class AnimeDubSet {
  const AnimeDubSet(this.byMal, this.byAnilist);
  final Set<int> byMal;
  final Set<int> byAnilist;

  static const empty = AnimeDubSet(<int>{}, <int>{});

  /// Whether the anime behind [metaId] (a `mal:<id>` / `anilist:<id>`) has a dub.
  /// Ports `animeHasDub`.
  bool hasDub(String metaId) {
    if (metaId.startsWith('mal:')) {
      final m = int.tryParse(metaId.substring(4));
      if (m != null && byMal.contains(m)) return true;
    }
    if (metaId.startsWith('anilist:')) {
      final a = int.tryParse(metaId.substring(8));
      if (a != null && byAnilist.contains(a)) return true;
    }
    return false;
  }
}

const _dubFeedUrl =
    'https://raw.githubusercontent.com/RockinChaos/AniSchedule/master/raw/dub-schedule.json';

/// Fetches the community dub schedule and builds the MAL/AniList id sets. Ported
/// 1:1 from `anime-dub-sub.ts` `load`; a failure yields the empty set so the
/// badge simply stays hidden.
Future<AnimeDubSet> fetchAnimeDubSet(JsonTransport transport) async {
  try {
    final res = await transport.getJson(
      _dubFeedUrl,
      headers: const {'Accept': 'application/json'},
    );
    if (!res.ok) return AnimeDubSet.empty;
    final arr = res.data;
    if (arr is! List) return AnimeDubSet.empty;
    final mal = <int>{};
    final anilist = <int>{};
    for (final e in arr) {
      if (e is! Map) continue;
      final media = ((e['media'] as Map?)?['media']) as Map?;
      if (media == null) continue;
      final m = (media['idMal'] as num?)?.toInt();
      final a = (media['id'] as num?)?.toInt();
      if (m != null) mal.add(m);
      if (a != null) anilist.add(a);
    }
    return AnimeDubSet(mal, anilist);
  } catch (_) {
    return AnimeDubSet.empty;
  }
}
