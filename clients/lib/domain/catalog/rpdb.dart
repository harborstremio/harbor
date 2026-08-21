/// RatingPosterDB poster-URL builder, ported 1:1 from `src/lib/providers/rpdb.ts`.
/// Turns a meta id (+ optional complementary id) into a poster URL for the
/// configured host (default RPDB, custom template, Better-Posters, Posters+),
/// falling back to the raw poster when it can't build one.
library;

/// A parsed poster id, ported from `ParsedId`.
class ParsedRpdbId {
  const ParsedRpdbId({
    required this.mediaType,
    this.imdb,
    this.tmdbId,
    this.tvdbId,
  });
  final String? imdb;
  final String? tmdbId;
  final String? tvdbId;
  final String mediaType; // movie | series
}

/// Parses a meta id into its poster-relevant parts, ported from `parseMetaId`.
ParsedRpdbId? parseMetaId(String metaId) {
  if (metaId.isEmpty) return null;
  if (metaId.startsWith('tt')) {
    return ParsedRpdbId(imdb: metaId, mediaType: 'movie');
  }
  final tmdb = RegExp(r'^tmdb:(movie|tv):(\d+)$').firstMatch(metaId);
  if (tmdb != null) {
    return ParsedRpdbId(
      tmdbId: tmdb[2],
      mediaType: tmdb[1] == 'tv' ? 'series' : 'movie',
    );
  }
  final tvdb = RegExp(r'^tvdb:(\d+)$').firstMatch(metaId);
  if (tvdb != null) {
    return ParsedRpdbId(tvdbId: tvdb[1], mediaType: 'series');
  }
  return null;
}

String? _fillTemplate(String template, ParsedRpdbId id) {
  final idToken =
      id.imdb ?? (id.tmdbId != null ? '${id.mediaType}-${id.tmdbId}' : null);
  if (idToken == null) return null;
  var out = template;
  bool sub(String token, String? value) {
    if (!out.contains(token)) return true;
    if (value == null) return false;
    out = out.split(token).join(value);
    return true;
  }

  if (!sub('{imdbId}', id.imdb)) return null;
  if (!sub('{imdb_id}', id.imdb)) return null;
  if (!sub('{tmdbId}', id.tmdbId)) return null;
  if (!sub('{tmdb_id}', id.tmdbId)) return null;
  sub('{type}', id.mediaType);
  sub('{mediaType}', id.mediaType);
  if (!sub('{id}', idToken)) return null;
  return out;
}

String? _rpdbPath(String base, String key, ParsedRpdbId id) {
  final keySeg = key.isNotEmpty ? key : 'default';
  if (id.imdb != null) {
    return '$base/$keySeg/imdb/poster-default/${id.imdb}.jpg?fallback=true';
  }
  if (id.tmdbId != null) {
    return '$base/$keySeg/tmdb/poster-default/'
        '${id.mediaType}-${id.tmdbId}.jpg?fallback=true';
  }
  if (id.tvdbId != null) {
    return '$base/$keySeg/tvdb/poster-default/series-${id.tvdbId}.jpg?fallback=true';
  }
  return null;
}

String? _betterPostersPath(String base, ParsedRpdbId id) {
  if (id.imdb == null) return null;
  return '$base/poster/imdb/poster-default/${id.imdb}.jpg';
}

String? _postersPlusPath(String base, ParsedRpdbId id) {
  if (id.imdb == null || id.tmdbId == null) return null;
  final root = base.replaceFirst(RegExp(r'/poster$', caseSensitive: false), '');
  final type = id.mediaType == 'series' ? 'series' : 'movie';
  return '$root/poster?tmdb_id=${id.tmdbId}&imdb_id=${id.imdb}&type=$type';
}

ParsedRpdbId _mergeAlt(ParsedRpdbId id, String? altId) {
  if (altId == null) return id;
  final other = parseMetaId(altId);
  if (other == null) return id;
  final typed = id.tmdbId != null ? id : (other.tmdbId != null ? other : id);
  return ParsedRpdbId(
    imdb: id.imdb ?? other.imdb,
    tmdbId: id.tmdbId ?? other.tmdbId,
    tvdbId: id.tvdbId ?? other.tvdbId,
    mediaType: typed.mediaType,
  );
}

/// Builds a poster URL for [metaId], ported 1:1 from `rpdbPoster`. Routes by the
/// configured [posterBase] host; returns [fallback] when it can't build a URL.
String? rpdbPoster(
  String key,
  String metaId, {
  String? fallback,
  String? altId,
  String posterBase = '',
}) {
  final parsed = parseMetaId(metaId);
  if (parsed == null) return fallback;
  final id = _mergeAlt(parsed, altId);

  if (posterBase.contains('{')) {
    return _fillTemplate(posterBase, id) ?? fallback;
  }
  if (posterBase.isEmpty) {
    if (key.isEmpty) return fallback;
    return _rpdbPath('https://api.ratingposterdb.com', key, id) ?? fallback;
  }

  final host = posterBase.toLowerCase();
  if (host.contains('ratingposterdb.com')) {
    return _rpdbPath(posterBase, key, id) ?? fallback;
  }
  if (host.contains('btttr.cc')) {
    return _betterPostersPath(posterBase, id) ?? fallback;
  }
  if (host.contains('postersplus') || host.contains('elfhosted')) {
    return _postersPlusPath(posterBase, id) ?? fallback;
  }
  if (key.isNotEmpty) return _rpdbPath(posterBase, key, id) ?? fallback;
  return fallback;
}

/// Whether an imdb id must be resolved before a poster can be built for a
/// `tmdb:*` id, ported from `needsImdbForPoster`.
bool needsImdbForPoster(String key, String metaId, {String posterBase = ''}) {
  if (rpdbPoster(key, metaId, posterBase: posterBase) != null) return false;
  if (posterBase.isEmpty && key.isEmpty) return false;
  return RegExp(r'^tmdb:(movie|tv):\d+$').hasMatch(metaId);
}

/// Whether a tmdb id must be resolved before a poster can be built for a `tt…`
/// id, ported from `needsTmdbForPoster`.
bool needsTmdbForPoster(String key, String metaId, {String posterBase = ''}) {
  if (rpdbPoster(key, metaId, posterBase: posterBase) != null) return false;
  if (posterBase.isEmpty) return false;
  return metaId.startsWith('tt');
}
