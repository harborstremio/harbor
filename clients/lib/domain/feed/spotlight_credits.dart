import 'dart:math' as math;

import '../catalog/tmdb.dart' show kGenreMovieToTv, kGenreTvToMovie;
import '../catalog/tmdb_person.dart' show PersonCredit, PersonDetail;
import 'feed_seed.dart' show hashStr;
import 'genre_spotlights.dart' show Spotlight;

const Set<String> _directorJobs = {'Director'};
const Set<String> _writerJobs = {'Writer', 'Screenplay', 'Story', 'Teleplay'};

/// The genre ids equivalent to [id] across movie and TV, ported 1:1 from
/// `genreEquivalents` (the id plus its movie↔tv companions).
List<int> genreEquivalents(int id) {
  final out = [id];
  final tv = kGenreMovieToTv[id];
  if (tv != null) out.add(tv);
  final movie = kGenreTvToMovie[id];
  if (movie != null) out.add(movie);
  return out;
}

/// Whether a cast credit is a cameo / self-appearance / archive footage that
/// should be excluded from a spotlight, ported 1:1 from `isCameo`.
bool isCameo(PersonCredit c) {
  final ch = (c.character ?? '').toLowerCase().trim();
  if (ch.isEmpty) return false;
  if (ch.contains('(uncredited)') ||
      ch.contains('archive footage') ||
      ch.contains('archival footage')) {
    return true;
  }
  if (ch == 'self' ||
      ch == 'himself' ||
      ch == 'herself' ||
      ch == 'themselves') {
    return true;
  }
  if (ch.startsWith('self ') ||
      ch.startsWith('himself ') ||
      ch.startsWith('herself ')) {
    return true;
  }
  return false;
}

/// A deterministic [0, 1) jitter for [seed], ported 1:1 from the spotlight
/// `jitter` (the FNV-1a hash over the unit range).
double jitter(String seed) => hashStr(seed) / 0xFFFFFFFF;

double _log2(num x) => math.log(x) / math.ln2;

/// The ranked credits for a [spotlight] within [genreId], ported 1:1 from the
/// web `spotlightCredits`: pick the person's directing/writing crew (or, for an
/// actor, their non-cameo cast), keep titles with a poster that sit in the
/// genre (or a companion / related genre) and — for TV — ran at least two
/// episodes, de-dupe, then rank by rating × log-popularity with a per-title
/// jitter so the order varies between people.
List<PersonCredit> spotlightCredits(
  PersonDetail person,
  Spotlight spotlight,
  int genreId,
) {
  final dept = spotlight.dept;
  final jobs = dept == 'Directing'
      ? _directorJobs
      : dept == 'Writing'
      ? _writerJobs
      : null;
  final pool = jobs != null
      ? person.crew.where((c) => jobs.contains(c.job ?? '')).toList()
      : spotlight.presenter
      ? person.cast
      : person.cast.where((c) => !isCameo(c)).toList();

  final accepted = <int>{
    ...genreEquivalents(genreId),
    for (final r in spotlight.relatedGenreIds) ...genreEquivalents(r),
  };
  final matched = pool
      .where(
        (c) =>
            c.poster != null &&
            (spotlight.presenter ||
                c.mediaType != 'tv' ||
                (c.episodeCount ?? 0) >= 2) &&
            c.genreIds.any(accepted.contains),
      )
      .toList();

  final seen = <int>{};
  final unique = <PersonCredit>[];
  for (final c in matched) {
    if (seen.add(c.id)) unique.add(c);
  }

  double score(PersonCredit c) =>
      c.voteAverage *
      _log2(2 + c.voteCount) *
      (0.7 + jitter('${spotlight.name}:${c.id}') * 0.6);
  unique.sort((a, b) => score(b).compareTo(score(a)));
  return unique;
}
