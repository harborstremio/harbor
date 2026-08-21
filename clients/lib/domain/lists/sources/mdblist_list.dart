import '../../../core/http/json_transport.dart';
import '../../addons/models.dart';
import '../list_types.dart';

/// Resolves an MDBList list (`user/slug` or a numeric id) to its items. Ported
/// 1:1 from `resolveMdblist` in `src/lib/lists/sources/mdblist.ts`.
Future<List<MetaPreview>> resolveMdblistList(
  JsonTransport transport,
  String ref,
  String apiKey,
) async {
  if (apiKey.isEmpty) {
    throw const ListResolveError(
      ListErrorReason.missingKey,
      ListSource.mdblist,
    );
  }
  final url = Uri.https('api.mdblist.com', '/lists/$ref/items', {
    'apikey': apiKey,
  }).toString();
  final JsonResponse res;
  try {
    res = await transport.getJson(url);
  } on TransportException {
    throw const ListResolveError(ListErrorReason.network, ListSource.mdblist);
  }
  if (res.statusCode == 404) {
    throw const ListResolveError(ListErrorReason.notFound, ListSource.mdblist);
  }
  if (!res.ok) {
    throw const ListResolveError(ListErrorReason.network, ListSource.mdblist);
  }
  return [for (final row in _collectRows(res.data)) ?_rowToItem(row)];
}

/// Flattens the MDBList response, which is either a flat array or a
/// `{movies, shows}` object (each row gets its mediatype defaulted).
List<Map<String, dynamic>> _collectRows(dynamic json) {
  if (json is List) {
    return json.whereType<Map>().map((r) => r.cast<String, dynamic>()).toList();
  }
  if (json is Map) {
    final movies = (json['movies'] as List? ?? const []).whereType<Map>().map(
      (r) => {'mediatype': 'movie', ...r.cast<String, dynamic>()},
    );
    final shows = (json['shows'] as List? ?? const []).whereType<Map>().map(
      (r) => {'mediatype': 'show', ...r.cast<String, dynamic>()},
    );
    return [...movies, ...shows];
  }
  return const [];
}

MetaPreview? _rowToItem(Map<String, dynamic> r) {
  final mediatype = r['mediatype'];
  final isShow = mediatype == 'show' || mediatype == 'tv';
  final imdb = r['imdb_id'];
  final tmdb = r['tmdb_id'];
  final String? id;
  if (imdb is String && imdb.isNotEmpty) {
    id = imdb;
  } else if (tmdb is num) {
    id = isShow ? 'tmdb:tv:${tmdb.toInt()}' : 'tmdb:movie:${tmdb.toInt()}';
  } else {
    id = null;
  }
  if (id == null) return null;
  final year = r['release_year'];
  return MetaPreview({
    'id': id,
    'type': isShow ? 'series' : 'movie',
    'name': (r['title'] as String?) ?? '',
    if (year is num) 'releaseInfo': '${year.toInt()}',
  });
}
