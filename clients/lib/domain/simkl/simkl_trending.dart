import '../../core/http/json_transport.dart';
import 'simkl_config.dart';
import 'simkl_types.dart';

int? _numId(Object? v) {
  if (v is num) return v.toInt();
  if (v is String && v.trim().isNotEmpty) return int.tryParse(v.trim());
  return null;
}

/// The trailing (year) segment of a Simkl CDN `release_date` like `MM/DD/YYYY`
/// (web `release_date.split("/").pop()`).
int? _year(Object? v) {
  if (v is! String || v.isEmpty) return null;
  return int.tryParse(v.split('/').last);
}

SimklWatchItem? _item(Object? x, String type) {
  if (x is! Map) return null;
  final title = x['title']?.toString();
  if (title == null || title.isEmpty) return null;
  final ids = x['ids'] is Map ? x['ids'] as Map : const {};
  final imdb = ids['imdb'];
  return SimklWatchItem(
    type: type,
    title: title,
    year: _year(x['release_date']),
    ids: SimklIds(
      simkl: _numId(ids['simkl_id']),
      imdb: (imdb is String && imdb.isNotEmpty) ? imdb : null,
      tmdb: _numId(ids['tmdb']),
      mal: _numId(ids['mal']),
      kitsu: _numId(ids['kitsu']),
    ),
  );
}

/// Parses the Simkl trending CDN payload (`{tv, movies, anime}`) into a single
/// interleaved list (tv → movie → anime per index), ports web
/// `fetchSimklTrending`. `tv`/`anime` are series, `movies` are movies.
List<SimklWatchItem> parseSimklTrending(Object? json) {
  if (json is! Map) return const [];
  final tv = json['tv'] is List ? json['tv'] as List : const [];
  final movies = json['movies'] is List ? json['movies'] as List : const [];
  final anime = json['anime'] is List ? json['anime'] as List : const [];
  final out = <SimklWatchItem>[];
  final maxLen = [
    tv.length,
    movies.length,
    anime.length,
  ].reduce((a, b) => a > b ? a : b);
  for (var i = 0; i < maxLen; i++) {
    if (i < tv.length) {
      final it = _item(tv[i], 'show');
      if (it != null) out.add(it);
    }
    if (i < movies.length) {
      final it = _item(movies[i], 'movie');
      if (it != null) out.add(it);
    }
    if (i < anime.length) {
      final it = _item(anime[i], 'show');
      if (it != null) out.add(it);
    }
  }
  return out;
}

/// Fetches Simkl's public "trending today" list from the CDN (no auth). Empty on
/// any failure. Ports web `fetchSimklTrending`.
Future<List<SimklWatchItem>> fetchSimklTrending(JsonTransport transport) async {
  final url =
      'https://data.simkl.in/discover/trending/today_100.json'
      '?client_id=$simklClientId&app-name=$simklAppName'
      '&app-version=$simklAppVersion';
  try {
    final res = await transport.getJson(
      url,
      headers: {'User-Agent': '$simklAppName/$simklAppVersion'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) return const [];
    return parseSimklTrending(res.data);
  } catch (_) {
    return const [];
  }
}
