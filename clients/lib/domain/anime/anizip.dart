import 'dart:async';

import 'package:meta/meta.dart';

import '../../core/http/json_transport.dart';

const _endpoint = 'https://api.ani.zip/mappings';
const _timeout = Duration(seconds: 4);

/// One episode from an AniZip mapping. Ported from `AniZipEpisode`.
class AniZipEpisode {
  const AniZipEpisode({
    this.seasonNumber,
    this.episodeNumber,
    this.absoluteEpisodeNumber,
    this.tvdbShowId,
    this.tvdbId,
    this.anidbEid,
    this.airDate,
    this.airDateUtc,
    this.runtime,
    this.image,
    this.rating,
    this.finaleType,
    this.filler,
    this.overview = '',
    this.titles = const {},
  });

  final int? seasonNumber;
  final int? episodeNumber;
  final int? absoluteEpisodeNumber;
  final int? tvdbShowId;
  final int? tvdbId;
  final int? anidbEid;
  final String? airDate;
  final String? airDateUtc;
  final int? runtime;
  final String? image;
  final String? rating;
  final String? finaleType;
  final bool? filler;
  final String overview;
  final Map<String, String> titles;

  static AniZipEpisode fromJson(Map raw) => AniZipEpisode(
    seasonNumber: (raw['seasonNumber'] as num?)?.toInt(),
    episodeNumber: (raw['episodeNumber'] as num?)?.toInt(),
    absoluteEpisodeNumber: (raw['absoluteEpisodeNumber'] as num?)?.toInt(),
    tvdbShowId: (raw['tvdbShowId'] as num?)?.toInt(),
    tvdbId: (raw['tvdbId'] as num?)?.toInt(),
    anidbEid: (raw['anidbEid'] as num?)?.toInt(),
    airDate: raw['airDate'] is String ? raw['airDate'] as String : null,
    airDateUtc: raw['airDateUtc'] is String
        ? raw['airDateUtc'] as String
        : null,
    runtime: (raw['runtime'] as num?)?.toInt(),
    image: raw['image'] is String ? raw['image'] as String : null,
    rating: raw['rating'] is String ? raw['rating'] as String : null,
    finaleType: raw['finaleType'] is String
        ? raw['finaleType'] as String
        : null,
    filler: raw['filler'] is bool ? raw['filler'] as bool : null,
    overview: raw['overview'] is String ? raw['overview'] as String : '',
    titles: _titles(raw['titles']),
  );
}

Map<String, String> _titles(Object? raw) {
  if (raw is! Map) return const {};
  return {
    for (final e in raw.entries)
      if (e.value is String) e.key.toString(): e.value as String,
  };
}

/// The external-id cross references carried in a mapping. Ported from the
/// `mappings` field of `AniZipMapping`.
class AniZipIds {
  const AniZipIds({
    this.anilistId,
    this.kitsuId,
    this.malId,
    this.anidbId,
    this.thetvdbId,
    this.themoviedbId,
    this.imdbId,
    this.type,
  });

  final int? anilistId;
  final int? kitsuId;
  final int? malId;
  final int? anidbId;
  final int? thetvdbId;
  final int? themoviedbId;
  final String? imdbId;

  /// The anime form (`TV`, `MOVIE`, `OVA`, …), used to redirect a side entry to
  /// its main TV series.
  final String? type;

  static AniZipIds? fromJson(Object? raw) {
    if (raw is! Map) return null;
    return AniZipIds(
      anilistId: (raw['anilist_id'] as num?)?.toInt(),
      kitsuId: (raw['kitsu_id'] as num?)?.toInt(),
      malId: (raw['mal_id'] as num?)?.toInt(),
      anidbId: (raw['anidb_id'] as num?)?.toInt(),
      thetvdbId: (raw['thetvdb_id'] as num?)?.toInt(),
      themoviedbId: (raw['themoviedb_id'] as num?)?.toInt(),
      imdbId: raw['imdb_id'] is String ? raw['imdb_id'] as String : null,
      type: raw['type'] is String ? raw['type'] as String : null,
    );
  }
}

/// An AniZip anime→episodes mapping. Ported from `AniZipMapping`.
class AniZipMapping {
  const AniZipMapping({
    this.titles = const {},
    this.episodes = const {},
    this.mappings,
  });

  final Map<String, String> titles;

  /// Episodes keyed by their AniZip episode key (usually the number).
  final Map<String, AniZipEpisode> episodes;

  /// External-id cross references, used to bridge to TVDB/IMDb/TMDB.
  final AniZipIds? mappings;

  static AniZipMapping? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final eps = raw['episodes'];
    return AniZipMapping(
      titles: _titles(raw['titles']),
      episodes: eps is Map
          ? {
              for (final e in eps.entries)
                if (e.value is Map)
                  e.key.toString(): AniZipEpisode.fromJson(e.value as Map),
            }
          : const {},
      mappings: AniZipIds.fromJson(raw['mappings']),
    );
  }
}

// The mappings rarely change, so lookups (including negative results) are cached
// for the process lifetime and concurrent identical lookups share one request —
// ported from the module-level `cache`/`inflight` maps in `anizip.ts`.
final Map<String, AniZipMapping?> _cache = {};
final Map<String, Future<AniZipMapping?>> _inflight = {};

/// Clears the process-wide AniZip cache. For tests only, so cached lookups from
/// one case do not leak into the next.
@visibleForTesting
void resetAniZipCache() {
  _cache.clear();
  _inflight.clear();
}

Future<AniZipMapping?> _get(JsonTransport t, String query) {
  if (_cache.containsKey(query)) return Future.value(_cache[query]);
  final existing = _inflight[query];
  if (existing != null) return existing;
  final p = _fetch(t, query);
  _inflight[query] = p;
  // Statement body, not an arrow — an arrow would return the removed future and
  // have it await itself.
  return p.whenComplete(() {
    _inflight.remove(query);
  });
}

Future<AniZipMapping?> _fetch(JsonTransport t, String query) async {
  try {
    final res = await t.getJson('$_endpoint?$query').timeout(_timeout);
    final mapping = res.ok ? AniZipMapping.fromJson(res.data) : null;
    _cache[query] = mapping;
    return mapping;
  } catch (_) {
    _cache[query] = null;
    return null;
  }
}

Future<AniZipMapping?> aniZipByKitsu(JsonTransport t, int kitsuId) =>
    _get(t, 'kitsu_id=$kitsuId');

Future<AniZipMapping?> aniZipByAnilist(JsonTransport t, int anilistId) =>
    _get(t, 'anilist_id=$anilistId');

Future<AniZipMapping?> aniZipByMal(JsonTransport t, int malId) =>
    _get(t, 'mal_id=$malId');

Future<AniZipMapping?> aniZipByAnidb(JsonTransport t, int anidbId) =>
    _get(t, 'anidb_id=$anidbId');

Future<AniZipMapping?> aniZipByImdb(JsonTransport t, String imdbId) =>
    _get(t, 'imdb_id=$imdbId');

Future<AniZipMapping?> aniZipByTmdbTv(JsonTransport t, int tmdbId) =>
    _get(t, 'themoviedb_id=$tmdbId');

/// The best display title for an episode: English, then romaji, then Japanese.
/// Ports `pickEpisodeTitle`.
String? pickEpisodeTitle(AniZipEpisode? ep) {
  final titles = ep?.titles;
  if (titles == null) return null;
  return titles['en'] ?? titles['x-jat'] ?? titles['ja'];
}
