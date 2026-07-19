import 'dart:math' as math;

import 'tmdb.dart';
import 'tmdb_media.dart';

const _animationGenre = 16;

/// The logo, backdrop and TMDB id resolved for an anime title. Ported from the
/// return of `tmdbAnimeLogo`.
class TmdbAnimeArt {
  const TmdbAnimeArt({this.logo, this.backdrop, this.tmdbId});

  final String? logo;
  final String? backdrop;
  final int? tmdbId;
}

String? _year4(Object? v) =>
    (v is String && v.length >= 4) ? v.substring(0, 4) : null;

/// Scores a TMDB search hit against the target anime title, ported 1:1 from
/// `scoreHit`: exact/prefix/substring name match, Japanese origin, the
/// animation genre, year proximity, and a capped popularity term.
double _scoreHit(
  String name, {
  required String hitName,
  String? year,
  String? origin,
  bool isAnim = false,
  num? popularity,
  String? targetYear,
}) {
  var s = 0.0;
  final a = name.toLowerCase().trim();
  final b = hitName.toLowerCase().trim();
  if (a == b) {
    s += 60;
  } else if (b.startsWith(a) || a.startsWith(b)) {
    s += 30;
  } else if (b.contains(a)) {
    s += 18;
  }
  if (origin == 'JP') s += 25;
  if (isAnim) s += 15;
  if (targetYear != null && year == targetYear) {
    s += 20;
  } else if (targetYear != null && year != null) {
    final hy = num.tryParse(year);
    final ty = num.tryParse(targetYear);
    if (hy != null && ty != null && (hy - ty).abs() <= 1) s += 8;
  }
  s += math.min(10, math.log(1 + (popularity ?? 0)));
  return s;
}

/// Finds the best-matching TMDB id (and its original language) for an anime by
/// title/year, searching the tv or movie index and ranking with [_scoreHit].
/// Ported from `tmdbAnimeMatch`.
Future<({int id, String? originalLang})?> tmdbAnimeMatch(
  TmdbClient client,
  String name,
  String? year,
  String kind,
) async {
  if (!client.hasKey || name.isEmpty) return null;
  final params = <String, String>{'query': name, 'include_adult': 'false'};
  if (year != null && year.isNotEmpty) {
    params[kind == 'tv' ? 'first_air_date_year' : 'year'] = year;
  }
  final data = await client.get(
    kind == 'tv' ? 'search/tv' : 'search/movie',
    params,
  );
  final results = data?['results'];
  if (results is! List || results.isEmpty) return null;

  ({int id, String? originalLang, double score})? best;
  for (final h in results) {
    if (h is! Map) continue;
    final id = (h['id'] as num?)?.toInt();
    if (id == null) continue;
    final originalLang = h['original_language'] as String?;
    final String hitName;
    final String? hitYear;
    final String? origin;
    if (kind == 'tv') {
      hitName = (h['name'] as String?) ?? (h['original_name'] as String?) ?? '';
      hitYear = _year4(h['first_air_date']);
      final oc = h['origin_country'];
      origin =
          (oc is List && oc.isNotEmpty ? oc.first as String? : null) ??
          (originalLang == 'ja' ? 'JP' : null);
    } else {
      hitName =
          (h['title'] as String?) ?? (h['original_title'] as String?) ?? '';
      hitYear = _year4(h['release_date']);
      origin = originalLang == 'ja' ? 'JP' : null;
    }
    final genreIds = h['genre_ids'];
    final isAnim =
        genreIds is List && genreIds.any((g) => g == _animationGenre);
    final score = _scoreHit(
      name,
      hitName: hitName,
      year: hitYear,
      origin: origin,
      isAnim: isAnim,
      popularity: h['popularity'] as num?,
      targetYear: year,
    );
    if (best == null || score > best.score) {
      best = (id: id, originalLang: originalLang, score: score);
    }
  }
  return best == null ? null : (id: best.id, originalLang: best.originalLang);
}

/// Resolves an anime title to its TMDB logo and backdrop (and id), matching the
/// title then reading the localized image set. Ported 1:1 from `tmdbAnimeLogo`.
Future<TmdbAnimeArt?> tmdbAnimeLogo(
  TmdbClient client,
  String name,
  String? year,
  String kind,
) async {
  final match = await tmdbAnimeMatch(client, name, year, kind);
  if (match == null) return null;
  final imgs = await client.get('$kind/${match.id}/images', {
    'include_image_language': imageLangParam(
      client.imageLangNames,
      originalLang: match.originalLang,
    ),
  });
  final logos = [
    for (final l in (imgs?['logos'] as List? ?? const []))
      if (l is Map) l.cast<String, dynamic>(),
  ];
  final logo = pickLogo(
    logos,
    client.imageLangNames,
    originalLang: match.originalLang,
  );
  final backdrops = imgs?['backdrops'];
  final backdropPath =
      (backdrops is List && backdrops.isNotEmpty && backdrops.first is Map)
      ? (backdrops.first as Map)['file_path'] as String?
      : null;
  return TmdbAnimeArt(
    logo: logo,
    backdrop: backdropPath != null
        ? 'https://image.tmdb.org/t/p/original$backdropPath'
        : null,
    tmdbId: match.id,
  );
}
