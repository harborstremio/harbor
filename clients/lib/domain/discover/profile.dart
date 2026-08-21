import '../addons/models.dart';
import '../catalog/tmdb_details.dart';
import 'affinity.dart';

/// The decade label (`1990s`) for a `year`/release string, or null. Ported 1:1
/// from `decadeOf`.
String? decadeOf(String? year) {
  if (year == null || year.isEmpty) return null;
  final head = year.length >= 4 ? year.substring(0, 4) : year;
  final y = int.tryParse(head);
  if (y == null) return null;
  return '${(y ~/ 10) * 10}s';
}

/// The normalized two-letter language code, or null. Ported 1:1 from `normLang`.
String? normLang(String? code) {
  if (code == null) return null;
  final c = code.trim().toLowerCase();
  return c.length >= 2 ? c.substring(0, 2) : null;
}

/// The taste snapshot for a fully-resolved TMDB detail — top-5 cast, all
/// directors/creators, genres, keywords, decade and language. Ported 1:1 from
/// `profileFromDetail`.
ProfileSnapshot profileFromDetail(TmdbDetail d) => ProfileSnapshot(
  cast: [for (final c in d.cast.take(5)) c.id],
  directors: [for (final p in d.directors) p.id],
  creators: [for (final p in d.creators) p.id],
  genres: d.genres,
  keywords: d.keywords,
  decade: decadeOf(d.year),
  language: normLang(d.originalLanguage),
);

/// The taste snapshot from a catalog meta — genres and decade only (a meta has
/// no cast/crew/keywords). Ported 1:1 from `profileFromMeta`.
ProfileSnapshot profileFromMeta(MetaPreview m) =>
    ProfileSnapshot(genres: m.genres, decade: decadeOf(m.releaseInfo));
