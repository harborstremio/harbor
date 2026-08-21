import 'simkl_types.dart';

/// The result of mapping a Stremio meta id to a Simkl target: either a resolved
/// [target], or a [reason] it was skipped (`anime` — a kitsu id or a mal episode
/// that needs MAL resolution — or `unrecognized`). Ported from `IdResolution`.
class SimklIdResolution {
  const SimklIdResolution.ok(this.target) : reason = null;
  const SimklIdResolution.skip(this.reason) : target = null;

  final SimklTarget? target;
  final String? reason;

  bool get ok => target != null;
}

/// The show/movie ids of a Simkl target. Ports `simklTargetIds`.
SimklIds simklTargetIds(SimklTarget target) => switch (target) {
  SimklEpisodeTarget(:final showIds) => showIds,
  SimklMovieTarget(:final ids) => ids,
  SimklShowTarget(:final ids) => ids,
};

final _ttId = RegExp(r'^tt\d+$');

/// Maps a Stremio meta id (and optional [episode] context) to a Simkl target.
/// Ports `stremioIdToSimklTarget` verbatim: `mal:` is a show, `kitsu:` is
/// skipped as anime, IMDb/TMDB ids resolve to movie/show/episode targets, and
/// everything else is unrecognized.
SimklIdResolution stremioIdToSimklTarget(
  String metaId, {
  ({int season, int episode})? episode,
}) {
  if (metaId.isEmpty) return const SimklIdResolution.skip('unrecognized');

  if (metaId.startsWith('mal:')) {
    final parts = metaId.split(':');
    final n = parts.length > 1 ? int.tryParse(parts[1]) : null;
    if (n == null) return const SimklIdResolution.skip('unrecognized');
    if (episode != null) return const SimklIdResolution.skip('anime');
    return SimklIdResolution.ok(SimklShowTarget(SimklIds(mal: n)));
  }

  if (metaId.startsWith('kitsu:')) {
    return const SimklIdResolution.skip('anime');
  }

  if (metaId.startsWith('tt')) {
    final parts = metaId.split(':');
    final imdb = parts[0];
    if (!_ttId.hasMatch(imdb)) {
      return const SimklIdResolution.skip('unrecognized');
    }
    if (parts.length >= 3) {
      final season = int.tryParse(parts[1]);
      final number = int.tryParse(parts[2]);
      if (season == null || number == null) {
        return const SimklIdResolution.skip('unrecognized');
      }
      return SimklIdResolution.ok(
        SimklEpisodeTarget(
          showIds: SimklIds(imdb: imdb),
          season: season,
          number: number,
        ),
      );
    }
    if (episode != null) {
      return SimklIdResolution.ok(
        SimklEpisodeTarget(
          showIds: SimklIds(imdb: imdb),
          season: episode.season,
          number: episode.episode,
        ),
      );
    }
    return SimklIdResolution.ok(SimklMovieTarget(SimklIds(imdb: imdb)));
  }

  if (metaId.startsWith('tmdb:')) {
    final parts = metaId.split(':');
    final kind = parts.length > 1 ? parts[1] : '';
    final id = parts.length > 2 ? int.tryParse(parts[2]) : null;
    if (id == null) return const SimklIdResolution.skip('unrecognized');

    if (kind == 'movie') {
      return SimklIdResolution.ok(SimklMovieTarget(SimklIds(tmdb: id)));
    }
    if (kind == 'tv') {
      if (parts.length >= 5) {
        final season = int.tryParse(parts[3]);
        final number = int.tryParse(parts[4]);
        if (season != null && number != null) {
          return SimklIdResolution.ok(
            SimklEpisodeTarget(
              showIds: SimklIds(tmdb: id),
              season: season,
              number: number,
            ),
          );
        }
      }
      if (episode != null) {
        return SimklIdResolution.ok(
          SimklEpisodeTarget(
            showIds: SimklIds(tmdb: id),
            season: episode.season,
            number: episode.episode,
          ),
        );
      }
      return SimklIdResolution.ok(SimklShowTarget(SimklIds(tmdb: id)));
    }
    return const SimklIdResolution.skip('unrecognized');
  }

  return const SimklIdResolution.skip('unrecognized');
}
