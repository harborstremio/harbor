import '../../../core/http/json_transport.dart';
import '../../addons/models.dart';
import '../list_types.dart';

/// The Jikan anime `type`s Harbor treats as episodic (everything else — chiefly
/// `Movie` — is a movie). Ported from `SERIES_TYPES`.
const _seriesTypes = {'TV', 'OVA', 'ONA', 'Special', 'Music'};

const _jikanBase = 'https://api.jikan.moe/v4';

/// Resolves a MyAnimeList reference to its items via the Jikan API. A numeric
/// [ref] is a single anime; anything else is a username whose public animelist
/// is fetched. Ported 1:1 from `resolveMal` in `src/lib/lists/sources/mal.ts`.
Future<List<MetaPreview>> resolveMalList(
  JsonTransport transport,
  String ref,
) async {
  if (RegExp(r'^\d+$').hasMatch(ref)) {
    try {
      return await _fetchSingle(transport, ref);
    } on ListResolveError {
      rethrow;
    } catch (_) {
      throw const ListResolveError(ListErrorReason.network, ListSource.mal);
    }
  }
  final JsonResponse res;
  try {
    res = await transport.getJson(
      '$_jikanBase/users/${Uri.encodeComponent(ref)}/animelist?page=1',
    );
  } on TransportException {
    throw const ListResolveError(ListErrorReason.network, ListSource.mal);
  }
  if (res.statusCode == 404) {
    throw const ListResolveError(ListErrorReason.notFound, ListSource.mal);
  }
  if (!res.ok) {
    throw const ListResolveError(ListErrorReason.network, ListSource.mal);
  }
  final data = res.data;
  final rows = data is Map ? data['data'] : null;
  return [
    for (final row in (rows is List ? rows : const []).whereType<Map>())
      ?_rowToItem(row.cast<String, dynamic>()),
  ];
}

Future<List<MetaPreview>> _fetchSingle(
  JsonTransport transport,
  String id,
) async {
  final JsonResponse res;
  try {
    res = await transport.getJson('$_jikanBase/anime/$id');
  } on TransportException {
    throw const ListResolveError(ListErrorReason.network, ListSource.mal);
  }
  if (res.statusCode == 404) {
    throw const ListResolveError(ListErrorReason.notFound, ListSource.mal);
  }
  if (!res.ok) {
    throw const ListResolveError(ListErrorReason.network, ListSource.mal);
  }
  final data = res.data;
  final anime = data is Map ? data['data'] : null;
  if (anime is! Map) {
    throw const ListResolveError(ListErrorReason.notFound, ListSource.mal);
  }
  return [_toItem(anime.cast<String, dynamic>())];
}

MetaPreview? _rowToItem(Map<String, dynamic> row) {
  final a = row['anime'] ?? row['node'];
  if (a is! Map) return null;
  final anime = a.cast<String, dynamic>();
  if (anime['mal_id'] is! num) return null;
  return _toItem(anime);
}

MetaPreview _toItem(Map<String, dynamic> a) {
  final malId = (a['mal_id'] as num).toInt();
  final type = a['type'];
  // An episodic type (or a missing/empty one) is a series; anything else is a
  // movie — mirrors `a.type && !SERIES_TYPES.has(a.type) ? "movie" : "series"`.
  final isSeries =
      type is! String || type.isEmpty || _seriesTypes.contains(type);

  final titleEnglish = a['title_english'];
  final title = a['title'];
  final name = (titleEnglish is String && titleEnglish.isNotEmpty)
      ? titleEnglish
      : (title is String ? title : '');

  final year = a['year'];
  final aired = a['aired'];
  final airedFrom = aired is Map ? aired['from'] : null;
  final String? releaseInfo;
  if (year is num) {
    releaseInfo = '${year.toInt()}';
  } else if (airedFrom is String && airedFrom.length >= 4) {
    releaseInfo = airedFrom.substring(0, 4);
  } else {
    releaseInfo = null;
  }

  return MetaPreview({
    'id': 'mal:$malId',
    'type': isSeries ? 'series' : 'movie',
    'name': name,
    'poster': ?_poster(a),
    'releaseInfo': ?releaseInfo,
  });
}

String? _poster(Map<String, dynamic> a) {
  final images = a['images'];
  if (images is! Map) return null;
  final webp = images['webp'];
  if (webp is Map && webp['large_image_url'] is String) {
    return webp['large_image_url'] as String;
  }
  final jpg = images['jpg'];
  if (jpg is Map && jpg['large_image_url'] is String) {
    return jpg['large_image_url'] as String;
  }
  return null;
}
