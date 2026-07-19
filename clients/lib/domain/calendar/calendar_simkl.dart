import '../../core/http/json_transport.dart';
import '../simkl/simkl_config.dart';
import 'calendar.dart';

const _cdnBase = 'https://data.simkl.in/calendar';

String _pad(Object? n) =>
    ((n as num?)?.toInt() ?? 0).toString().padLeft(2, '0');

/// Maps a Simkl CDN calendar row to a [CalendarItem]. Ports `mapCdnItem`.
CalendarItem _mapCdnItem(Map<String, dynamic> item, String type, bool isAnime) {
  final ids = item['ids'] is Map
      ? (item['ids'] as Map)
      : const <dynamic, dynamic>{};
  final imdb = ids['imdb'] is String ? ids['imdb'] as String : null;
  final tmdbStr = ids['tmdb']?.toString();
  final id =
      imdb ??
      (tmdbStr != null
          ? (type == 'movie' ? 'tmdb:movie:$tmdbStr' : 'tmdb:tv:$tmdbStr')
          : 'simkl:${ids['simkl_id']}');

  var name = (item['title'] ?? '').toString();
  final ep = item['episode'] is Map ? (item['episode'] as Map) : null;
  if (type == 'tv' &&
      ep != null &&
      ep['season'] != null &&
      ep['episode'] != null) {
    name = '$name S${_pad(ep['season'])}E${_pad(ep['episode'])}';
  }

  final posterField = item['poster'];
  final poster = posterField is String && posterField.isNotEmpty
      ? 'https://simkl.in/posters/${posterField}_m.jpg'
      : null;
  final rating = ((item['ratings'] as Map?)?['simkl'] as Map?)?['rating'];

  return CalendarItem(
    id: id,
    imdbId: imdb,
    type: type,
    name: name,
    poster: poster,
    releaseDate: calendarDate10(item['date']),
    isAnime: isAnime,
    voteAverage: (rating as num?)?.toDouble() ?? 0,
  );
}

Future<List<CalendarItem>> _fetchArchive(
  JsonTransport t,
  int year,
  int month,
  String catalog,
) async {
  final filename = catalog == 'movie' ? 'movie_release.json' : '$catalog.json';
  final url =
      '$_cdnBase/$year/$month/$filename'
      '?client_id=$simklClientId&app-name=$simklAppName'
      '&app-version=$simklAppVersion';
  final JsonResponse res;
  try {
    res = await t.getJson(
      url,
      headers: {'User-Agent': '$simklAppName/$simklAppVersion'},
    );
  } on TransportException {
    return const [];
  }
  if (!res.ok || res.data is! List) return const [];
  final type = catalog == 'movie' ? 'movie' : 'tv';
  return [
    for (final item in res.data as List)
      if (item is Map)
        _mapCdnItem(item.cast<String, dynamic>(), type, catalog == 'anime'),
  ];
}

/// The Simkl "premieres" calendar for [month] (1-12) of [year] — the public
/// Simkl CDN archive of TV, anime and movie premieres, merged and sorted by
/// date. No account needed. Ports `fetchSimklCdnCalendar`.
Future<List<CalendarItem>> fetchSimklPremieresCalendar(
  JsonTransport transport, {
  required int year,
  required int month,
}) async {
  final results = await Future.wait([
    _fetchArchive(transport, year, month, 'tv'),
    _fetchArchive(transport, year, month, 'anime'),
    _fetchArchive(transport, year, month, 'movie'),
  ]);
  final combined = [for (final r in results) ...r];
  combined.sort((a, b) => a.releaseDate.compareTo(b.releaseDate));
  return combined;
}
