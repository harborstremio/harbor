import 'dart:math' as math;

import '../addons/models.dart';

/// A season/episode reference.
typedef EpisodeRef = ({int season, int episode});

/// The lead time (seconds) before an episode ends at which the next-episode
/// countdown appears, ported from the web `nextEpisodeLead`: `0` disables it, a
/// positive [setting] is used verbatim, and the default `-1` (auto) scales with
/// the runtime — 4% of it, clamped to 15–45 seconds.
int nextEpisodeLead(int setting, double durationSec) {
  if (setting == 0) return 0;
  if (setting > 0) return setting;
  return math.min(45, math.max(15, (durationSec * 0.04).round()));
}

/// The episodes immediately before and after ([season], [episode]) in the
/// series' ordered video list, ported from `computeAdjacent` in the web
/// `series-episodes.ts`. Videos without both a season and episode (specials,
/// extras) are skipped so navigation follows the numbered run; a current episode
/// absent from the list yields no neighbours.
({EpisodeRef? prev, EpisodeRef? next}) adjacentEpisodes(
  List<VideoRef> videos,
  int season,
  int episode,
) {
  final eps = [
    for (final v in videos)
      if (v.season != null && v.episode != null) v,
  ];
  final idx = eps.indexWhere((v) => v.season == season && v.episode == episode);
  if (idx < 0) return (prev: null, next: null);
  return (
    prev: idx > 0
        ? (season: eps[idx - 1].season!, episode: eps[idx - 1].episode!)
        : null,
    next: idx < eps.length - 1
        ? (season: eps[idx + 1].season!, episode: eps[idx + 1].episode!)
        : null,
  );
}
