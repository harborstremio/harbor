import '../../addons/models.dart';
import '../../trakt/trakt_client.dart';
import '../list_types.dart';

/// Resolves a Trakt user list (`user/list-slug`) to its items via the Trakt
/// client. Ported 1:1 from `resolveTrakt` in `src/lib/lists/sources/trakt.ts`,
/// with `traktItemToMeta`'s id/meta mapping inlined.
Future<List<MetaPreview>> resolveTraktList(
  TraktClient client,
  String ref,
) async {
  final parsed = _parseRef(ref);
  if (parsed == null) {
    throw const ListResolveError(ListErrorReason.unparseable, ListSource.trakt);
  }
  final (user, listId) = parsed;
  final dynamic rows;
  try {
    rows = await client.request(
      '/users/${Uri.encodeComponent(user)}'
      '/lists/${Uri.encodeComponent(listId)}/items/movies,shows',
    );
  } on TraktApiError catch (e) {
    if (e.status == 404 || e.status == 401) {
      throw const ListResolveError(ListErrorReason.notFound, ListSource.trakt);
    }
    throw const ListResolveError(ListErrorReason.network, ListSource.trakt);
  } catch (_) {
    throw const ListResolveError(ListErrorReason.network, ListSource.trakt);
  }
  return [
    for (final row in (rows is List ? rows : const []).whereType<Map>())
      ?_rowToItem(row.cast<String, dynamic>()),
  ];
}

/// `user/list-slug` (or a longer path — the first segment is the user, the last
/// is the list). Fewer than two segments is unparseable.
(String, String)? _parseRef(String ref) {
  final parts = ref.split('/').where((p) => p.isNotEmpty).toList();
  if (parts.length < 2) return null;
  return (parts.first, parts.last);
}

MetaPreview? _rowToItem(Map<String, dynamic> r) {
  final type = r['type'];
  final Map<String, dynamic>? entry;
  if (type == 'movie' && r['movie'] is Map) {
    entry = (r['movie'] as Map).cast<String, dynamic>();
  } else if (type == 'show' && r['show'] is Map) {
    entry = (r['show'] as Map).cast<String, dynamic>();
  } else {
    entry = null;
  }
  if (entry == null) return null;

  final ids = entry['ids'];
  final idsMap = ids is Map ? ids.cast<String, dynamic>() : const {};
  final tmdb = idsMap['tmdb'];
  final imdb = idsMap['imdb'];
  final String? id;
  if (tmdb is num) {
    id = type == 'movie'
        ? 'tmdb:movie:${tmdb.toInt()}'
        : 'tmdb:tv:${tmdb.toInt()}';
  } else if (imdb is String && imdb.isNotEmpty) {
    id = imdb;
  } else {
    id = null;
  }
  if (id == null) return null;

  final year = entry['year'];
  return MetaPreview({
    'id': id,
    'type': type == 'show' ? 'series' : 'movie',
    'name': (entry['title'] as String?) ?? '',
    if (year is num) 'releaseInfo': '${year.toInt()}',
  });
}
