import 'tmdb.dart';

/// Resolves a meta id to its IMDb `tt…` id, ported 1:1 from `tmdbImdbId`: a
/// `tt…` id passes through; a `tmdb:(movie|tv):<id>` id is resolved via TMDB's
/// `external_ids`; anything else (or a non-`tt` external id) yields null.
/// Returns null without a key. Used to give imdb-keyed stream addons a usable
/// id for TMDB-sourced titles.
Future<String?> tmdbImdbId(TmdbClient client, String metaId) async {
  if (metaId.startsWith('tt')) return metaId;
  if (!client.hasKey) return null;
  final m = RegExp(r'^tmdb:(movie|tv):(\d+)$').firstMatch(metaId);
  if (m == null) return null;

  Map<String, dynamic>? data;
  try {
    data = await client.get('${m[1]}/${m[2]}/external_ids');
  } catch (_) {
    return null;
  }
  final imdb = data?['imdb_id'];
  return (imdb is String && imdb.startsWith('tt')) ? imdb : null;
}

/// Resolves an IMDb `tt…` id to a `tmdb:(movie|tv):<id>` id via TMDB's `find`
/// endpoint, ported 1:1 from `tmdbIdFromImdb`. When [type] is given it is
/// preferred; otherwise a TV-only match wins over a movie one, else the first
/// available. Null without a key, for non-`tt` ids, or when nothing matches.
Future<String?> tmdbIdFromImdb(
  TmdbClient client,
  String imdbId, {
  String? type,
}) async {
  if (!imdbId.startsWith('tt') || !client.hasKey) return null;

  Map<String, dynamic>? data;
  try {
    data = await client.get('find/$imdbId', {'external_source': 'imdb_id'});
  } catch (_) {
    return null;
  }
  final movie = _firstResultId(data?['movie_results']);
  final tv = _firstResultId(data?['tv_results']);

  if (type == 'series' && tv != null) return 'tmdb:tv:$tv';
  if (type == 'movie' && movie != null) return 'tmdb:movie:$movie';
  if (tv != null && movie == null) return 'tmdb:tv:$tv';
  if (movie != null) return 'tmdb:movie:$movie';
  if (tv != null) return 'tmdb:tv:$tv';
  return null;
}

int? _firstResultId(dynamic list) {
  if (list is! List || list.isEmpty) return null;
  final first = list.first;
  return first is Map ? (first['id'] as num?)?.toInt() : null;
}
