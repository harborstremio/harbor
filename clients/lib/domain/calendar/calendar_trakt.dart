import 'dart:math';

import '../addons/addon_client.dart';
import '../addons/models.dart';
import '../catalog/cinemeta.dart';
import '../trakt/trakt_client.dart';
import '../trakt/trakt_types.dart';
import 'calendar.dart';

/// Trakt allows the calendar to look at most six months forward.
const _traktMaxForwardMonths = 6;

String _pad(int n) => n.toString().padLeft(2, '0');

/// Cinemeta genres containing "animation"/"anime". Ports `isAnimationGenre`.
bool _isAnimationGenre(List<String>? genres) {
  if (genres == null) return false;
  const wanted = ['animation', 'anime'];
  return genres.any((g) => wanted.contains(g.toLowerCase()));
}

String? _episodeThumb(Meta? meta, int season, int number) {
  if (meta == null) return null;
  for (final v in meta.videos) {
    if ((v.season ?? 0) == season && (v.episode ?? 0) == number) {
      return v.thumbnail;
    }
  }
  return null;
}

/// The Trakt calendar for [month] (1-12) of [year] relative to [now]: the
/// signed-in user's upcoming episodes and movies, hydrated with Cinemeta
/// metadata (poster/background/genres/rating), as [CalendarItem]s. Empty when
/// the month is in the past or beyond the six-month forward window. Ports
/// `fetchTraktCalendar`.
Future<List<CalendarItem>> fetchTraktCalendar(
  TraktClient trakt,
  AddonClient addon, {
  required int year,
  required int month,
  required DateTime now,
}) async {
  final fwdMonths = (year - now.year) * 12 + (month - now.month);
  if (fwdMonths < 0 || fwdMonths > _traktMaxForwardMonths) return const [];
  final days = max(31, (fwdMonths + 1) * 31);
  final todayIso = calendarIso(now);

  final results = await Future.wait([
    trakt.fetchUpcomingEpisodes(todayIso: todayIso, days: days),
    trakt.fetchUpcomingMovies(todayIso: todayIso, days: days),
  ]);
  final eps = results[0] as List<TraktUpcomingEpisode>;
  final mvs = results[1] as List<TraktUpcomingMovie>;

  final epsInMonth = [
    for (final ep in eps)
      if (calendarInMonth(calendarDate10(ep.airDate), year, month)) ep,
  ];
  final mvsInMonth = [
    for (final m in mvs)
      if (calendarInMonth(calendarDate10(m.released), year, month)) m,
  ];

  final showIds = {
    for (final e in epsInMonth)
      if (e.ids.imdb != null) e.ids.imdb!,
  }.toList();
  final movieIds = {
    for (final m in mvsInMonth)
      if (m.ids.imdb != null) m.ids.imdb!,
  }.toList();

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
  for (final ep in epsInMonth) {
    final imdb = ep.ids.imdb;
    final meta = imdb != null ? showMeta[imdb] : null;
    final baseId =
        imdb ?? 'trakt:${ep.ids.tmdb ?? ep.ids.tvdb ?? ep.showTitle}';
    final epLabel = 'S${_pad(ep.season)}E${_pad(ep.number)}';
    final title = (ep.episodeTitle != null && ep.episodeTitle!.isNotEmpty)
        ? '${ep.showTitle} $epLabel: ${ep.episodeTitle}'
        : '${ep.showTitle} $epLabel';
    out.add(
      CalendarItem(
        id: '$baseId:${ep.season}:${ep.number}',
        imdbId: imdb,
        type: 'tv',
        name: title,
        poster: _episodeThumb(meta, ep.season, ep.number) ?? meta?.poster,
        background: meta?.background,
        releaseDate: calendarDate10(ep.airDate),
        isAnime: _isAnimationGenre(meta?.genres),
        overview: meta?.description ?? '',
        voteAverage: (meta?.imdbRating ?? 0).toDouble(),
      ),
    );
  }
  for (final m in mvsInMonth) {
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
        releaseDate: calendarDate10(m.released),
        isAnime: _isAnimationGenre(meta?.genres),
        overview: meta?.description ?? '',
        voteAverage: (meta?.imdbRating ?? 0).toDouble(),
      ),
    );
  }
  out.sort((a, b) => a.releaseDate.compareTo(b.releaseDate));
  return out;
}
