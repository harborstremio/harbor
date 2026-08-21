import 'wrapped_types.dart';

/// Derives the viewer's year archetype from their movie/series/anime split,
/// their busiest day, and their title count. Ported 1:1 from
/// `src/lib/wrapped/archetype.ts` (same thresholds and copy).
WrappedArchetype deriveArchetype({
  required WatchSplit split,
  required LongestBinge longestBinge,
  required int totalTitles,
}) {
  final movies = split.movies;
  final series = split.series;
  final anime = split.anime;
  final total = (movies + series + anime) == 0 ? 1 : (movies + series + anime);

  if (anime / total >= 0.5) {
    return const WrappedArchetype(
      id: 'weeb',
      label: 'The Anime Devotee',
      blurb: 'Over half your year was anime. Respect the grind.',
    );
  }
  if (longestBinge.count >= 8) {
    return WrappedArchetype(
      id: 'binger',
      label: 'The Binger',
      blurb: 'You once tore through ${longestBinge.count} in a single day.',
    );
  }
  if (movies / total >= 0.6) {
    return const WrappedArchetype(
      id: 'cinephile',
      label: 'The Film Buff',
      blurb: 'Movies are your natural habitat.',
    );
  }
  if (series / total >= 0.6) {
    return const WrappedArchetype(
      id: 'serialist',
      label: 'The Series Slayer',
      blurb: 'You live one episode at a time.',
    );
  }
  if (totalTitles >= 60) {
    return const WrappedArchetype(
      id: 'explorer',
      label: 'The Explorer',
      blurb: 'You cast a wide net across everything.',
    );
  }
  return const WrappedArchetype(
    id: 'balanced',
    label: 'The Well-Rounded',
    blurb: 'A little of everything, all year long.',
  );
}
