import '../addons/addon_client.dart';
import '../catalog/cinemeta.dart' show cinemetaBase;
import '../catalog/tmdb.dart' show TmdbClient;
import '../catalog/tmdb_details.dart' show Episode, tmdbSeasonEpisodes;

/// Cross-season episode list for a series id, the Flutter port of the web
/// `fetchEpisodeList` used by the Continue-Watching advance engine. Handles the
/// `tmdb:tv:<id>` branch (reusing [tmdbSeasonEpisodes]) and, when an [AddonClient]
/// is supplied, the `tt…` cinemeta branch (`meta/series/{id}` `videos`, ports web
/// `loadCinemetaEpisodes`). Anime ids return `const []` for now (later slice).
///
/// A small in-memory LRU (id → episodes) mirrors the web `tmdbSeasonCache`, so
/// the advance provider never refetches the same series on every rebuild. Only
/// successful fetches are cached; a network failure returns `[]` uncached so it
/// is retried.

const int _cacheCap = 200;
final Map<String, List<Episode>> _cache = {};
final List<String> _order = [];

void _put(String id, List<Episode> eps) {
  if (_cache.containsKey(id)) {
    _order.remove(id);
  }
  _cache[id] = eps;
  _order.add(id);
  while (_order.length > _cacheCap) {
    _cache.remove(_order.removeAt(0));
  }
}

/// Clears the episode LRU (test hook + a settings-change reset point).
void clearSeriesEpisodeCache() {
  _cache.clear();
  _order.clear();
}

/// The season+episode catalog for [id], sorted ascending. `[]` on fetch failure
/// or for an id no branch handles.
Future<List<Episode>> fetchSeriesEpisodes({
  required String id,
  required TmdbClient client,
  AddonClient? addon,
}) async {
  final cached = _cache[id];
  if (cached != null) return cached;

  if (id.startsWith('tmdb:tv:') && client.hasKey) {
    final tvId = int.tryParse(id.substring('tmdb:tv:'.length));
    if (tvId == null) return const [];
    final lang = client.language.isNotEmpty ? client.language : 'en';
    final detail = await client.get('tv/$tvId', {'language': lang});
    // A network failure returns null — leave it uncached so it retries.
    if (detail == null) return const [];
    final seasonNums = <int>[
      for (final s in (detail['seasons'] as List?) ?? const [])
        if (s is Map && (s['season_number'] as num?) != null)
          if ((s['season_number'] as num).toInt() >= 1)
            (s['season_number'] as num).toInt(),
    ]..sort();
    final all = <Episode>[];
    for (final sn in seasonNums) {
      all.addAll(await tmdbSeasonEpisodes(client, tvId, sn));
    }
    _put(id, all);
    return all;
  }

  // Cinemeta (IMDb-id) series: the `videos` of its meta. Ports web
  // `loadCinemetaEpisodes`.
  if (id.startsWith('tt') && addon != null) {
    final meta = (await addon.meta(cinemetaBase, 'series', id)).valueOrNull;
    if (meta == null) return const []; // failure — uncached, retried
    final eps =
        <Episode>[
          for (final v in meta.videos)
            if (v.season != null && v.season! >= 1 && v.episode != null)
              Episode(
                id: 0,
                episodeNumber: v.episode!,
                seasonNumber: v.season!,
                name: v.title ?? '',
                overview: v.overview ?? '',
                stillPath: v.thumbnail,
                airDate: v.released,
                runtime: null,
                voteAverage: null,
              ),
        ]..sort(
          (a, b) => a.seasonNumber != b.seasonNumber
              ? a.seasonNumber.compareTo(b.seasonNumber)
              : a.episodeNumber.compareTo(b.episodeNumber),
        );
    _put(id, eps);
    return eps;
  }

  return const [];
}
