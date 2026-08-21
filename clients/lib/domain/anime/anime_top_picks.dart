import '../../core/storage/kv_store.dart';
import '../addons/models.dart';
import '../discover/affinity.dart';
import '../library/playback_history.dart' show WatchedSet;
import '../stremio/library_item.dart';
import 'anime_top_picks_utils.dart';
import 'jikan.dart' show animeFranchiseKey, stripFranchiseSuffix;
import 'jikan_client.dart';
import 'kitsu_client.dart';
import 'watch_history_recs.dart' show malIdForItem;

/// The "For You" anime top-picks target size.
const int kAnimeTopPicksCap = 24;

/// Kitsu relationship roles that count as a "next thing to watch" for a
/// finished franchise. Ported from web `SEQUEL_ROLES`.
const Set<String> _sequelRoles = {
  'sequel',
  'side_story',
  'parent_story',
  'spinoff',
  'spin_off',
};

Future<List<MetaPreview>> _safe(
  Future<List<MetaPreview>> Function() f,
) async {
  try {
    return await f();
  } catch (_) {
    return const [];
  }
}

/// A [MetaPreview] with any franchise suffix stripped from its name, so the
/// pick renders "Attack on Titan" not "Attack on Titan: Final Season". Ported
/// from `cleanName`.
MetaPreview _cleanName(MetaPreview m) {
  final name = stripFranchiseSuffix(m.name);
  return name == m.name ? m : MetaPreview({...m.json, 'name': name});
}

/// The sequels / side stories of the finished-franchise [seeds] (first six),
/// pulled from Kitsu relations. Ported from `sequelMetas`.
Future<List<MetaPreview>> _sequelMetas(
  JikanClient jikan,
  KitsuClient kitsu,
  KvStore kv,
  List<LibraryItem> seeds,
) async {
  final lists = await Future.wait(
    seeds.take(6).map((item) async {
      try {
        final malId = await malIdForItem(jikan, kv, (
          id: item.id,
          name: item.name,
        ));
        if (malId == null) return const <MetaPreview>[];
        final kitsuId = parseKitsuId(item.id);
        if (kitsuId == null) return const <MetaPreview>[];
        final related = await kitsu.kitsuRelated(kitsuId);
        return [
          for (final rel in related)
            if (_sequelRoles.contains(rel.role)) rel.meta,
        ];
      } catch (_) {
        return const <MetaPreview>[];
      }
    }),
  );
  return [for (final l in lists) ...l];
}

/// Assembles the personalized anime "For You" picks — ported 1:1 from the async
/// body of `useAnimeTopPicks`. Gathers candidates from watch-history recs,
/// affinity-seeded genre pages, new/airing rows and finished-franchise sequels,
/// scores and dedups them by franchise, then tops up from broad Jikan lists
/// until [kAnimeTopPicksCap] survive. Records the shown franchises in the
/// rotation ring and returns the ranked list (the caller persists the cache).
///
/// Reactivity (taste/playback/prefs subscriptions in the web hook) is the
/// provider's job — this is the pure gather, so it stays testable.
Future<List<MetaPreview>> assembleAnimeTopPicks({
  required JikanClient jikan,
  required KitsuClient kitsu,
  required KvStore kv,
  required List<LibraryItem> libItems,
  required Iterable<String> continueWatchingNames,
  required List<MetaPreview> heroMetas,
  required List<MetaPreview> watchHistoryRecs,
  required List<int> favoriteGenres,
  required Affinity affinity,
  required WatchedSet watched,
  required Set<String> voted,
  required bool hideAdult,
  required int seed,
  required int pageSeed,
  AnimeShownPicksRing? ring,
}) async {
  final picksRing = ring ?? AnimeShownPicksRing(kv);
  final genres = animeSeedGenres(favoriteGenres, affinity);
  final seeds = finishedFranchises(libItems).seeds;

  final results = await Future.wait([
    _safe(() => jikan.topAiring(pageFor('airing', pageSeed))),
    _safe(() => jikan.newReleases(pageFor('new', pageSeed))),
    for (final id in genres)
      _safe(() => jikan.byGenre(id, pageFor('g$id', pageSeed))),
  ]);
  final airing = results[0];
  final fresh = results[1];
  final genreLists = results.sublist(2);

  final skip = buildAnimeExclusion(
    heroMetas: heroMetas,
    continueWatchingNames: continueWatchingNames,
    libItems: libItems,
    recentlyShown: picksRing.recentlyShown(),
    watched: watched,
    voted: voted,
    hideAdult: hideAdult,
  );

  final byFranchise = <String, PickEntry>{};
  void add(MetaPreview m, PickSource source, [int idx = 0, int len = 0]) {
    if (skip(m)) return;
    final fk = animeFranchiseKey(m.name);
    final s = scorePick(m, source, affinity, recsIndex: idx, recsLen: len);
    final existing = byFranchise[fk];
    if (existing != null) {
      existing.score += s;
    } else {
      byFranchise[fk] = PickEntry(meta: _cleanName(m), score: s);
    }
  }

  for (var i = 0; i < watchHistoryRecs.length; i++) {
    add(watchHistoryRecs[i], PickSource.rec, i, watchHistoryRecs.length);
  }
  final maxGenre = genreLists.fold<int>(0, (a, l) => l.length > a ? l.length : a);
  for (var i = 0; i < maxGenre; i++) {
    for (final list in genreLists) {
      if (i < list.length) add(list[i], PickSource.genre);
    }
  }
  for (final m in fresh) {
    add(m, PickSource.newRelease);
  }
  for (final m in airing) {
    add(m, PickSource.airing);
  }

  final sequels = await _sequelMetas(jikan, kitsu, kv, seeds);
  for (final m in sequels) {
    add(m, PickSource.sequel);
  }

  var page = 2;
  while (byFranchise.length < kAnimeTopPicksCap && page <= 5) {
    final more = await Future.wait([
      for (final id in genres) _safe(() => jikan.byGenre(id, page)),
      if (page == 2) _safe(() => jikan.topAnime(1)),
      if (page == 3) _safe(() => jikan.topPopular(1)),
    ]);
    for (final list in more) {
      for (final m in list) {
        add(m, PickSource.top);
      }
    }
    page++;
  }

  if (byFranchise.length < kAnimeTopPicksCap) {
    final floor = await _safe(() => jikan.topAiring(1));
    for (final m in floor) {
      if (byFranchise.length >= kAnimeTopPicksCap) break;
      final fk = animeFranchiseKey(m.name);
      if (byFranchise.containsKey(fk)) continue;
      if (watched.contains(m.id, m.name)) continue;
      byFranchise[fk] = PickEntry(
        meta: _cleanName(m),
        score: scorePick(m, PickSource.airing, affinity),
      );
    }
  }

  final ranked = rankPicks(byFranchise, seed, kAnimeTopPicksCap);
  picksRing.record([for (final m in ranked) animeFranchiseKey(m.name)]);
  return ranked;
}
