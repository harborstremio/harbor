import '../addons/models.dart';
import '../catalog/catalog_row.dart';
import 'jikan.dart';
import 'jikan_client.dart';

/// Builds the four anime Home rails (Trending / New / Popular / Upcoming),
/// ported 1:1 from web `buildAnimeHomeRows` (`src/views/home/home-rows.ts`).
/// Each rail pulls three Jikan pages, de-duplicates by id, strips the franchise
/// suffix from titles, caps at 60, and is emitted only when at least six items
/// resolve. These are `noDedup` `series` rows that slot in at the tail of the
/// Home body.
Future<List<CatalogRow>> buildAnimeHomeRows(JikanClient jikan) async {
  Future<List<MetaPreview>> fetchMany(
    Future<List<MetaPreview>> Function(int page) fn,
    int pages,
  ) async {
    final results = await Future.wait([
      for (var i = 1; i <= pages; i++)
        fn(i).then((v) => v, onError: (_) => <MetaPreview>[]),
    ]);
    final seen = <String>{};
    final out = <MetaPreview>[];
    for (final list in results) {
      for (final m in list) {
        if (seen.add(m.id)) out.add(m);
      }
    }
    return out;
  }

  List<MetaPreview> cleanMetas(List<MetaPreview> list) => [
    for (final m in list)
      if (stripFranchiseSuffix(m.name) == m.name)
        m
      else
        MetaPreview({...m.json, 'name': stripFranchiseSuffix(m.name)}),
  ];

  CatalogRow row(String key, String title, List<MetaPreview> metas) =>
      CatalogRow(
        key: key,
        title: title,
        type: 'series',
        id: key,
        items: metas.take(60).toList(),
        noDedup: true,
      );

  try {
    final results = await Future.wait([
      fetchMany(jikan.topAiring, 3),
      fetchMany(jikan.newReleases, 3),
      fetchMany(jikan.topPopular, 3),
      fetchMany(jikan.upcoming, 3),
    ]);
    final airing = results[0];
    final newest = results[1];
    final popular = results[2];
    final upcoming = results[3];

    final out = <CatalogRow>[];
    if (airing.length >= 6) {
      out.add(row('anime-airing', 'Trending Anime', cleanMetas(airing)));
    }
    if (newest.length >= 6) {
      out.add(row('anime-new', 'New Anime Releases', cleanMetas(newest)));
    }
    if (popular.length >= 6) {
      out.add(row('anime-popular', 'Popular Anime', cleanMetas(popular)));
    }
    if (upcoming.length >= 6) {
      out.add(row('anime-upcoming', 'Upcoming Anime', cleanMetas(upcoming)));
    }
    return out;
  } catch (_) {
    return const [];
  }
}
