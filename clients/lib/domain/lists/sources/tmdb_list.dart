import '../../addons/models.dart';
import '../../catalog/tmdb.dart';
import '../list_types.dart';

/// Resolves a TMDB list (a numeric id) to its items via the TMDB client. Ported
/// 1:1 from `resolveTmdb` in `src/lib/lists/sources/tmdb.ts`. The client already
/// carries the API key, so a null response (no key aside) is a missing list.
Future<List<MetaPreview>> resolveTmdbList(TmdbClient client, String ref) async {
  if (!client.hasKey) {
    throw const ListResolveError(ListErrorReason.missingKey, ListSource.tmdb);
  }
  final data = await client.get('list/$ref');
  if (data == null) {
    throw const ListResolveError(ListErrorReason.notFound, ListSource.tmdb);
  }
  final rows = (data['items'] as List?) ?? const [];
  final items = <MetaPreview>[];
  for (final row in rows.whereType<Map>()) {
    final r = row.cast<String, dynamic>();
    final mediaType = r['media_type'];
    if (mediaType == 'tv') {
      items.add(client.seriesMeta(r));
    } else if (mediaType == 'movie') {
      items.add(client.movieMeta(r));
    }
  }
  return items;
}
