import '../../core/http/json_transport.dart';
import '../addons/addon_client.dart';
import '../addons/models.dart';
import '../catalog/cinemeta.dart';
import '../catalog/tvdb.dart';
import '../ratings/harbor_imdb.dart';
import 'anime_fillers.dart';
import 'anime_mapping.dart';
import 'anime_tvdb_thumbs.dart';
import 'kitsu_client.dart';

bool _hasThumb(KitsuEpisode ep) => ep.thumbnail?.isNotEmpty ?? false;

/// Enriches an anime's episodes in place with data the base Kitsu/addon build
/// lacks: filler flags, fresh IMDb episode ratings, and episode thumbnails from
/// Cinemeta then TVDB. Ported 1:1 from `anime-episode-enrich.ts`. Each source is
/// best-effort — a failure leaves the episodes as they were.
class AnimeEpisodeEnricher {
  AnimeEpisodeEnricher({
    required AnimeMapper mapper,
    required AnimeFillers fillers,
    required AddonClient addon,
    required TvdbClient tvdb,
    required JsonTransport transport,
  }) : _mapper = mapper,
       _fillers = fillers,
       _addon = addon,
       _tvdb = tvdb,
       _transport = transport;

  final AnimeMapper _mapper;
  final AnimeFillers _fillers;
  final AddonClient _addon;
  final TvdbClient _tvdb;
  final JsonTransport _transport;

  /// Runs the filler, IMDb-rating and thumbnail enrichers over [episodes]. The
  /// filler and rating passes run concurrently with the thumbnail pass, which
  /// tries Cinemeta before falling back to TVDB.
  Future<void> enrich(
    List<KitsuEpisode> episodes, {
    required int kitsuId,
    String? imdbId,
    required String tvdbKey,
  }) async {
    await Future.wait([
      _enrichFiller(episodes, kitsuId),
      _enrichHarborImdb(episodes, imdbId),
      _enrichThumbs(episodes, imdbId, kitsuId, tvdbKey),
    ]);
  }

  Future<void> _enrichFiller(List<KitsuEpisode> episodes, int kitsuId) async {
    if (episodes.any((ep) => ep.filler == true)) return;
    final malId = await _guard(_mapper.kitsuToMal(kitsuId));
    if (malId == null || malId == 0) return;
    final fillers =
        await _guard(_fillers.fillerEpisodes(malId)) ?? const <int>{};
    if (fillers.isEmpty) return;
    for (final ep in episodes) {
      final n = ep.absoluteNumber ?? ep.number;
      if (fillers.contains(n)) ep.filler = true;
    }
  }

  Future<void> _enrichHarborImdb(
    List<KitsuEpisode> episodes,
    String? imdbId,
  ) async {
    if (imdbId == null || !imdbId.startsWith('tt')) return;
    final map = await _guard(harborImdbEpisodes(_transport, imdbId));
    if (map == null || map.isEmpty) return;
    for (final ep in episodes) {
      final season = ep.imdbSeason ?? ep.seasonNumber;
      final n = ep.imdbEpisode ?? ep.number;
      final real = map['$season:$n'];
      if (real != null && real > 0) {
        ep.rating = real;
        ep.ratingIsImdb = true;
      }
    }
  }

  Future<void> _enrichThumbs(
    List<KitsuEpisode> episodes,
    String? imdbId,
    int kitsuId,
    String tvdbKey,
  ) async {
    await _enrichCinemetaThumbs(episodes, imdbId);
    await _enrichTvdbThumbs(episodes, kitsuId, tvdbKey);
  }

  Future<void> _enrichCinemetaThumbs(
    List<KitsuEpisode> episodes,
    String? imdbId,
  ) async {
    if (imdbId == null || !imdbId.startsWith('tt')) return;
    if (episodes.every(_hasThumb)) return;
    final meta = await _guard(_cinemetaSeries(imdbId));
    final videos = meta?.videos ?? const <VideoRef>[];
    if (videos.isEmpty) return;

    final bySeasonEpisode = <String, String>{};
    final byAbsolute = <int, String>{};
    final ordered =
        [
          for (final v in videos)
            if ((v.thumbnail?.isNotEmpty ?? false) &&
                v.season != null &&
                v.episode != null)
              v,
        ]..sort((a, b) {
          final s = (a.season ?? 0).compareTo(b.season ?? 0);
          return s != 0 ? s : (a.episode ?? 0).compareTo(b.episode ?? 0);
        });
    var pos = 0;
    for (final v in ordered) {
      final thumb = v.thumbnail!;
      bySeasonEpisode['${v.season}:${v.episode}'] = thumb;
      if ((v.season ?? 0) > 0) {
        pos += 1;
        byAbsolute.putIfAbsent(pos, () => thumb);
      }
    }

    for (final ep in episodes) {
      if (_hasThumb(ep)) continue;
      final season = ep.imdbSeason ?? ep.seasonNumber;
      final epNum = ep.imdbEpisode ?? ep.number;
      final hit =
          bySeasonEpisode['$season:$epNum'] ??
          byAbsolute[ep.absoluteNumber ?? ep.number];
      if (hit != null) ep.thumbnail = hit;
    }
  }

  Future<void> _enrichTvdbThumbs(
    List<KitsuEpisode> episodes,
    int kitsuId,
    String tvdbKey,
  ) async {
    if (tvdbKey.isEmpty) return;
    if (episodes.every(_hasThumb)) return;
    final tvdbId = await _guard(_mapper.kitsuToTvdb(kitsuId));
    if (tvdbId == null || tvdbId == 0) return;
    final seasons = <int>{
      for (final ep in episodes) ep.imdbSeason ?? ep.seasonNumber,
    }.toList();
    final index = await _guard(
      fetchTvdbThumbs(_tvdb, tvdbKey, tvdbId, seasons),
    );
    if (index == null) return;
    for (final ep in episodes) {
      if (_hasThumb(ep)) continue;
      final season = ep.imdbSeason ?? ep.seasonNumber;
      final epNum = ep.imdbEpisode ?? ep.number;
      final abs = ep.absoluteNumber;
      final hit =
          index.bySeasonEpisode['$season:$epNum'] ??
          (abs != null ? index.byAbsolute[abs] : null) ??
          index.byAbsolute[ep.number];
      if (hit != null) ep.thumbnail = hit;
    }
  }

  Future<Meta?> _cinemetaSeries(String imdbId) async =>
      (await _addon.meta(cinemetaBase, 'series', imdbId)).valueOrNull;

  static Future<T?> _guard<T>(Future<T> f) async {
    try {
      return await f;
    } catch (_) {
      return null;
    }
  }
}
