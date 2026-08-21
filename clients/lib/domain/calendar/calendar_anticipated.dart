import '../addons/addon_client.dart';
import '../addons/models.dart';
import '../catalog/cinemeta.dart';
import '../trakt/trakt_client.dart';
import '../trakt/trakt_types.dart';
import 'calendar.dart';

/// The anticipated calendar for [month] (1-12) of [year]: Trakt's most-listed
/// unreleased shows and movies whose premiere/release falls in the month,
/// hydrated with Cinemeta metadata. Shows carry a `:premiere` id and a
/// "(premiere)" name. Ports `fetchAnticipatedCalendar`.
Future<List<CalendarItem>> fetchAnticipatedCalendar(
  TraktClient trakt,
  AddonClient addon, {
  required int year,
  required int month,
}) async {
  final results = await Future.wait([
    trakt.fetchAnticipatedShows(),
    trakt.fetchAnticipatedMovies(),
  ]);
  final shows = (results[0] as List<TraktAnticipatedShow>)
      .where((s) => calendarInMonth(s.firstAired, year, month))
      .toList();
  final movies = (results[1] as List<TraktAnticipatedMovie>)
      .where((m) => calendarInMonth(m.released, year, month))
      .toList();

  final showIds = [
    for (final s in shows)
      if (s.ids.imdb != null) s.ids.imdb!,
  ];
  final movieIds = [
    for (final m in movies)
      if (m.ids.imdb != null) m.ids.imdb!,
  ];
  final metas = await Future.wait([
    ...showIds.map((id) => addon.meta(cinemetaBase, 'series', id)),
    ...movieIds.map((id) => addon.meta(cinemetaBase, 'movie', id)),
  ]);
  final showMeta = <String, Meta?>{
    for (var i = 0; i < showIds.length; i++) showIds[i]: metas[i].valueOrNull,
  };
  final movieMeta = <String, Meta?>{
    for (var i = 0; i < movieIds.length; i++)
      movieIds[i]: metas[showIds.length + i].valueOrNull,
  };

  final out = <CalendarItem>[];
  for (final s in shows) {
    final imdb = s.ids.imdb;
    final meta = imdb != null ? showMeta[imdb] : null;
    final base = imdb ?? 'trakt:${s.ids.tmdb ?? s.ids.tvdb ?? s.title}';
    out.add(
      CalendarItem(
        id: '$base:premiere',
        imdbId: imdb,
        type: 'tv',
        name: '${s.title} (premiere)',
        poster: meta?.poster,
        background: meta?.background,
        releaseDate: s.firstAired,
        isAnime: false,
        overview: meta?.description ?? s.overview,
        voteAverage: (meta?.imdbRating ?? 0).toDouble(),
      ),
    );
  }
  for (final m in movies) {
    final imdb = m.ids.imdb;
    final meta = imdb != null ? movieMeta[imdb] : null;
    out.add(
      CalendarItem(
        id: imdb ?? 'trakt:${m.ids.tmdb ?? m.title}',
        imdbId: imdb,
        type: 'movie',
        name: m.title,
        poster: meta?.poster,
        background: meta?.background,
        releaseDate: m.released,
        isAnime: false,
        overview: meta?.description ?? m.overview,
        voteAverage: (meta?.imdbRating ?? 0).toDouble(),
      ),
    );
  }
  out.sort((a, b) => a.releaseDate.compareTo(b.releaseDate));
  return out;
}
