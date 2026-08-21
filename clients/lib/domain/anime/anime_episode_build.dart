import 'anime_kitsu_addon.dart';
import 'anizip.dart';
import 'kitsu_client.dart';

/// Builds the episode list from the addon meta's videos when present — carrying
/// their stream and IMDb cross-ids — and otherwise returns the raw Kitsu
/// episodes unchanged. The Kitsu episode of the same number supplies fallback
/// title, synopsis, thumbnail, airdate and length. Ported 1:1 from
/// `buildKitsuEpisodes`.
List<KitsuEpisode> buildKitsuEpisodes(
  AnimeKitsuMeta? addonMeta,
  List<KitsuEpisode> kitsuRawEpisodes,
) {
  final videos = addonMeta?.videos;
  if (videos == null || videos.isEmpty) return kitsuRawEpisodes;
  final kitsuByNumber = <int, KitsuEpisode>{
    for (final ep in kitsuRawEpisodes) ep.number: ep,
  };
  return [for (final v in videos) _fromVideo(v, kitsuByNumber[v.episode])];
}

KitsuEpisode _fromVideo(AnimeKitsuVideo v, KitsuEpisode? k) {
  final title = v.title.isNotEmpty
      ? v.title
      : (k != null && k.title.isNotEmpty ? k.title : 'Episode ${v.episode}');
  return KitsuEpisode(
    id: k?.id ?? v.episode,
    number: v.episode,
    seasonNumber: v.season ?? 1,
    title: title,
    synopsis: v.overview ?? k?.synopsis ?? '',
    thumbnail: v.thumbnail ?? k?.thumbnail,
    airdate: v.released ?? k?.airdate,
    length: k?.length,
    streamId: v.id,
    imdbId: v.imdbId,
    imdbSeason: v.imdbSeason,
    imdbEpisode: v.imdbEpisode,
  );
}

/// Enriches [episodes] in place from an ani.zip mapping: better titles, missing
/// overviews/thumbnails/airdates/runtimes, filler and absolute-number flags,
/// ratings, and IMDb season/episode routing derived from the mapping. Only
/// fills gaps — an existing value is never overwritten, except the airdate,
/// which ani.zip always wins. Ported 1:1 from `mergeAniZipEpisodes`.
void mergeAniZipEpisodes(List<KitsuEpisode> episodes, AniZipMapping? aniZip) {
  if (aniZip == null) return;
  final byNumber = aniZip.episodes;
  final azImdb = aniZip.mappings?.imdbId;
  for (final ep in episodes) {
    final az = byNumber['${ep.number}'];
    if (az == null) continue;

    final enrichedTitle = pickEpisodeTitle(az);
    if (enrichedTitle != null &&
        enrichedTitle.isNotEmpty &&
        (ep.title.isEmpty || ep.title == 'Episode ${ep.number}')) {
      ep.title = enrichedTitle;
    }
    if (az.overview.isNotEmpty && ep.synopsis.isEmpty) {
      ep.synopsis = az.overview;
    }
    final image = az.image;
    if (image != null &&
        image.isNotEmpty &&
        (ep.thumbnail == null || ep.thumbnail!.isEmpty)) {
      ep.thumbnail = image;
    }
    final airDate = az.airDate;
    if (airDate != null && airDate.isNotEmpty) ep.airdate = airDate;
    final runtime = az.runtime;
    if (runtime != null &&
        runtime != 0 &&
        (ep.length == null || ep.length == 0)) {
      ep.length = runtime;
    }
    if (az.filler == true) ep.filler = true;
    final abs = az.absoluteEpisodeNumber;
    if (abs != null && abs != 0) ep.absoluteNumber = abs;
    if (ep.rating == null && az.rating != null) {
      final r = num.tryParse(az.rating!);
      if (r != null && r.isFinite && r > 0) ep.rating = r;
    }
    final azSeason = az.seasonNumber;
    if (azSeason != null && azSeason > 0 && az.episodeNumber != null) {
      if (azImdb != null) ep.imdbId = azImdb;
      ep.imdbSeason ??= azSeason;
      ep.imdbEpisode ??= az.episodeNumber;
    }
  }
}
