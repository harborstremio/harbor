import '../catalog/tmdb.dart';

const _animationGenreId = 16;

String? _poster(Object? p) =>
    p is String && p.isNotEmpty ? '$tmdbImg/w342$p' : null;
String? _wide(Object? p) =>
    p is String && p.isNotEmpty ? '$tmdbImg/w780$p' : null;

String _d10(Object? v) {
  final s = (v ?? '').toString();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

bool _hasAnimation(Object? genres) =>
    genres is List &&
    genres.any(
      (g) => g is Map && (g['id'] as num?)?.toInt() == _animationGenreId,
    );

/// One upcoming episode resolved from TMDB. Ported from `TmdbUpcomingEpisode`.
class TmdbUpcomingEpisode {
  const TmdbUpcomingEpisode({
    required this.season,
    required this.number,
    required this.name,
    required this.airDate,
    this.image,
    this.overview = '',
    this.voteAverage = 0,
  });

  final int season;
  final int number;
  final String name;
  final String airDate;
  final String? image;
  final String overview;
  final double voteAverage;
}

/// A series' upcoming episodes from TMDB. Ported from `TmdbTvUpcoming`.
class TmdbTvUpcoming {
  const TmdbTvUpcoming({
    required this.name,
    this.poster,
    required this.isAnime,
    required this.episodes,
  });

  final String name;
  final String? poster;
  final bool isAnime;
  final List<TmdbUpcomingEpisode> episodes;
}

/// A movie's release info from TMDB. Ported from `TmdbMovieRelease`.
class TmdbMovieRelease {
  const TmdbMovieRelease({
    required this.name,
    this.poster,
    this.background,
    required this.releaseDate,
    required this.isAnime,
    this.overview = '',
    this.voteAverage = 0,
  });

  final String name;
  final String? poster;
  final String? background;
  final String releaseDate;
  final bool isAnime;
  final String overview;
  final double voteAverage;
}

/// Resolves a `tt…` IMDb id to its TMDB tv/movie ids (`find/<id>`). Ports
/// `tmdbFindByImdb`.
Future<({int? tvId, int? movieId})> tmdbFindByImdb(
  TmdbClient tmdb,
  String ttId,
) async {
  final data = await tmdb.get('find/$ttId', {'external_source': 'imdb_id'});
  int? firstId(Object? list) {
    if (list is List && list.isNotEmpty && list.first is Map) {
      return ((list.first as Map)['id'] as num?)?.toInt();
    }
    return null;
  }

  return (
    tvId: firstId(data?['tv_results']),
    movieId: firstId(data?['movie_results']),
  );
}

/// A series' episodes airing within [inWindow]: the next/last-airing seasons
/// plus any season whose air date is in the window, expanded to their in-window
/// episodes. Ports `tmdbTvUpcoming`.
Future<TmdbTvUpcoming?> tmdbTvUpcoming(
  TmdbClient tmdb,
  int tvId,
  bool Function(String date) inWindow,
) async {
  final tv = await tmdb.get('tv/$tvId');
  if (tv == null) return null;
  final isAnime = _hasAnimation(tv['genres']);

  final seasons = <int>{};
  final next = (tv['next_episode_to_air'] as Map?)?['season_number'];
  if (next is num) seasons.add(next.toInt());
  final last = (tv['last_episode_to_air'] as Map?)?['season_number'];
  if (last is num) seasons.add(last.toInt());
  for (final s in (tv['seasons'] as List?) ?? const []) {
    if (s is! Map) continue;
    final n = s['season_number'];
    final airDate = s['air_date'];
    if (n is num && airDate is String && inWindow(_d10(airDate))) {
      seasons.add(n.toInt());
    }
  }

  final episodes = <TmdbUpcomingEpisode>[];
  for (final season in seasons) {
    final sd = await tmdb.get('tv/$tvId/season/$season');
    for (final ep in (sd?['episodes'] as List?) ?? const []) {
      if (ep is! Map) continue;
      final date = _d10(ep['air_date']);
      final number = ep['episode_number'];
      if (date.isEmpty || !inWindow(date) || number is! num) continue;
      episodes.add(
        TmdbUpcomingEpisode(
          season: (ep['season_number'] as num?)?.toInt() ?? season,
          number: number.toInt(),
          name: (ep['name'] ?? '').toString(),
          airDate: date,
          image: _wide(ep['still_path']),
          overview: (ep['overview'] ?? '').toString(),
          voteAverage: (ep['vote_average'] as num?)?.toDouble() ?? 0,
        ),
      );
    }
  }
  return TmdbTvUpcoming(
    name: (tv['name'] ?? '').toString(),
    poster: _poster(tv['poster_path']),
    isAnime: isAnime,
    episodes: episodes,
  );
}

/// A movie's release info (`movie/<id>`). Ports `tmdbMovieRelease`.
Future<TmdbMovieRelease?> tmdbMovieRelease(TmdbClient tmdb, int movieId) async {
  final m = await tmdb.get('movie/$movieId');
  if (m == null) return null;
  return TmdbMovieRelease(
    name: (m['title'] ?? '').toString(),
    poster: _poster(m['poster_path']),
    background: _wide(m['backdrop_path']),
    releaseDate: _d10(m['release_date']),
    isAnime: _hasAnimation(m['genres']),
    overview: (m['overview'] ?? '').toString(),
    voteAverage: (m['vote_average'] as num?)?.toDouble() ?? 0,
  );
}
