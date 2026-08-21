/// Episode-file matching, ported from `src/lib/streams/episode-file.ts`. Used by
/// the debrid providers and the local torrent engine to pick the right file out
/// of a season pack.
library;

/// A season/episode target; either field may be null when unknown.
class EpisodeHint {
  const EpisodeHint({required this.season, required this.episode});
  final int? season;
  final int? episode;
}

final RegExp _videoExtRe = RegExp(
  r'\.(mkv|mp4|avi|mov|m4v|webm|ts|flv|wmv|m2ts|mpg|mpeg|ogv|3gp)(\?|#|$)',
  caseSensitive: false,
);

/// The regex matching a file name for (season, episode) across the common
/// `SxxExx`, bare `sxxexx`, and `NxNN` conventions.
RegExp episodeFileRegex(int season, int episode) {
  final s = season.toString().padLeft(2, '0');
  final e = episode.toString().padLeft(2, '0');
  return RegExp(
    's0*$season[^0-9]?e0*$episode(?![0-9])|$s$e(?![0-9])|\\b${season}x0*$episode(?![0-9])',
    caseSensitive: false,
  );
}

/// Returns the index of the file in [names] matching [hint], preferring a name
/// that is also a video file. Returns -1 when the hint is incomplete or nothing
/// matches.
int matchEpisodeFileIndex(List<String> names, EpisodeHint? hint) {
  if (hint == null || hint.season == null || hint.episode == null) return -1;
  final re = episodeFileRegex(hint.season!, hint.episode!);
  var anyMatch = -1;
  for (var i = 0; i < names.length; i++) {
    final name = names[i];
    if (!re.hasMatch(name)) continue;
    if (_videoExtRe.hasMatch(name)) return i;
    if (anyMatch < 0) anyMatch = i;
  }
  return anyMatch;
}
