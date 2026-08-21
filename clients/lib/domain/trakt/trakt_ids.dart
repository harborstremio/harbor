import 'trakt_types.dart';

/// The episode context that lets a bare series id resolve to one episode.
/// Ported from `TraktEpisodeRef`.
class TraktEpisodeRef {
  const TraktEpisodeRef({
    required this.season,
    required this.episode,
    this.imdbId,
    this.imdbSeason,
    this.imdbEpisode,
  });

  final int season;
  final int episode;
  final String? imdbId;
  final int? imdbSeason;
  final int? imdbEpisode;
}

/// The result of mapping a Stremio meta id to a Trakt target: either a resolved
/// [target], or a [reason] it was skipped (`anime` — a kitsu/mal id with no
/// IMDb episode mapping — or `unrecognized`). Ported from `IdResolution`.
class TraktIdResolution {
  const TraktIdResolution.ok(this.target) : reason = null;
  const TraktIdResolution.skip(this.reason) : target = null;

  final TraktTarget? target;
  final String? reason;

  bool get ok => target != null;
}

final _ttId = RegExp(r'^tt\d+$');

/// Maps a Stremio meta id (and optional [episode] context) to a Trakt write
/// target. Ports `stremioIdToTraktTarget` verbatim: IMDb (`tt…`) and TMDB
/// (`tmdb:…`) ids resolve to movie/show/episode targets; kitsu/mal anime resolve
/// only when an IMDb episode mapping is supplied; everything else is skipped.
TraktIdResolution stremioIdToTraktTarget(
  String metaId, {
  TraktEpisodeRef? episode,
}) {
  if (metaId.isEmpty) return const TraktIdResolution.skip('unrecognized');

  if (metaId.startsWith('kitsu:') || metaId.startsWith('mal:')) {
    final imdb = episode?.imdbId;
    if (imdb != null &&
        _ttId.hasMatch(imdb) &&
        episode?.imdbSeason != null &&
        episode?.imdbEpisode != null) {
      return TraktIdResolution.ok(
        TraktEpisodeTarget(
          showIds: TraktIds(imdb: imdb),
          season: episode!.imdbSeason!,
          number: episode.imdbEpisode!,
        ),
      );
    }
    return const TraktIdResolution.skip('anime');
  }

  if (metaId.startsWith('tt')) {
    final parts = metaId.split(':');
    final imdb = parts[0];
    if (!_ttId.hasMatch(imdb)) {
      return const TraktIdResolution.skip('unrecognized');
    }
    if (parts.length >= 3) {
      final season = int.tryParse(parts[1]);
      final number = int.tryParse(parts[2]);
      if (season == null || number == null) {
        return const TraktIdResolution.skip('unrecognized');
      }
      return TraktIdResolution.ok(
        TraktEpisodeTarget(
          showIds: TraktIds(imdb: imdb),
          season: season,
          number: number,
        ),
      );
    }
    if (episode != null) {
      return TraktIdResolution.ok(
        TraktEpisodeTarget(
          showIds: TraktIds(imdb: imdb),
          season: episode.season,
          number: episode.episode,
        ),
      );
    }
    return TraktIdResolution.ok(TraktMovieTarget(TraktIds(imdb: imdb)));
  }

  if (metaId.startsWith('tmdb:')) {
    final parts = metaId.split(':');
    final kind = parts.length > 1 ? parts[1] : '';
    final id = parts.length > 2 ? int.tryParse(parts[2]) : null;
    if (id == null) return const TraktIdResolution.skip('unrecognized');

    if (kind == 'movie') {
      return TraktIdResolution.ok(TraktMovieTarget(TraktIds(tmdb: id)));
    }
    if (kind == 'tv') {
      if (parts.length >= 5) {
        final season = int.tryParse(parts[3]);
        final number = int.tryParse(parts[4]);
        if (season != null && number != null) {
          return TraktIdResolution.ok(
            TraktEpisodeTarget(
              showIds: TraktIds(tmdb: id),
              season: season,
              number: number,
            ),
          );
        }
      }
      if (episode != null) {
        return TraktIdResolution.ok(
          TraktEpisodeTarget(
            showIds: TraktIds(tmdb: id),
            season: episode.season,
            number: episode.episode,
          ),
        );
      }
      return TraktIdResolution.ok(TraktShowTarget(TraktIds(tmdb: id)));
    }
    return const TraktIdResolution.skip('unrecognized');
  }

  return const TraktIdResolution.skip('unrecognized');
}
