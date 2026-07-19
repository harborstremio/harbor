import 'playlist.dart';
import 'vod_classify.dart';
import 'vod_title.dart';

/// A VOD movie derived from a playlist channel. Ports `iptv/vod.ts` `VodMovie`.
class VodMovie {
  const VodMovie({
    required this.id,
    required this.title,
    this.year,
    this.logo,
    this.group,
    required this.url,
    required this.playlistId,
    required this.playlistName,
  });
  final String id;
  final String title;
  final int? year;
  final String? logo;
  final String? group;
  final String url;
  final String playlistId;
  final String playlistName;
}

/// One episode of a VOD series. Ports `VodEpisode`.
class VodEpisode {
  VodEpisode({
    required this.season,
    required this.episode,
    required this.title,
    required this.url,
    this.logo,
  });
  final int season;

  /// Reassigned by fallback numbering when the source had no SxxEyy marker.
  int episode;
  final String title;
  final String url;
  final String? logo;
}

/// A VOD series with its grouped episodes. Ports `VodSeries`.
class VodSeries {
  VodSeries({
    required this.id,
    required this.title,
    this.logo,
    this.group,
    required this.playlistId,
    required this.playlistName,
    required this.episodes,
    this.seasons = const [],
  });
  final String id;
  final String title;
  String? logo;
  final String? group;
  final String playlistId;
  final String playlistName;
  final List<VodEpisode> episodes;
  List<int> seasons;
}

/// The full VOD library. Ports `VodLibrary`.
class VodLibrary {
  const VodLibrary({required this.movies, required this.series});
  final List<VodMovie> movies;
  final List<VodSeries> series;
}

/// Whether a playlist id is a synthetic external one. Ports
/// `isExternalPlaylistId`.
bool isExternalPlaylistId(String id) =>
    id.startsWith('iptv:') || id.startsWith('vod:');

final RegExp _nonAlnum = RegExp(r'[^a-z0-9]+');
final RegExp _edgeDash = RegExp(r'^-|-$');

String _norm(String s) =>
    s.toLowerCase().replaceAll(_nonAlnum, '-').replaceAll(_edgeDash, '');

void _numberFallbackEpisodes(List<VodEpisode> episodes) {
  final fallback = [
    for (final e in episodes)
      if (e.episode == 0) e,
  ];
  if (fallback.isEmpty) return;
  fallback.sort((a, b) => a.url.compareTo(b.url));
  for (var i = 0; i < fallback.length; i++) {
    fallback[i].episode = i + 1;
  }
}

/// Classifies every VOD channel across the playlists into a deduped movie list
/// and episode-grouped series list. Ports `buildVodLibrary`.
VodLibrary buildVodLibrary(
  Iterable<IptvPlaylist> playlists,
  Map<String, String> names,
) {
  final movies = <VodMovie>[];
  final movieSeen = <String>{};
  final seriesMap = <String, VodSeries>{};

  for (final pl in playlists) {
    final plName = names[pl.id] ?? pl.name;
    for (final ch in pl.channels) {
      final kind = classifyChannel(ch);
      if (kind == VodKind.live) continue;

      if (kind == VodKind.movie) {
        final title = cleanTitle(ch.name);
        final year = extractYear(ch.name);
        final dedupe = '${pl.id}|${_norm(title)}|${year ?? ''}';
        if (movieSeen.contains(dedupe)) continue;
        movieSeen.add(dedupe);
        movies.add(
          VodMovie(
            id: 'vod:${ch.id}',
            title: title,
            year: year,
            logo: ch.logo,
            group: ch.group,
            url: ch.url,
            playlistId: pl.id,
            playlistName: plName,
          ),
        );
        continue;
      }

      final fromEpisode = showTitleFromEpisode(ch.name);
      final show = fromEpisode.isNotEmpty ? fromEpisode : cleanTitle(ch.name);
      final key = '${pl.id}|${_norm(show)}';
      var series = seriesMap[key];
      if (series == null) {
        series = VodSeries(
          id: 'vod:series:${pl.id}:${_norm(show)}',
          title: show,
          logo: ch.logo,
          group: ch.group,
          playlistId: pl.id,
          playlistName: plName,
          episodes: [],
        );
        seriesMap[key] = series;
      }
      final logo = ch.logo;
      if ((series.logo == null || series.logo!.isEmpty) &&
          logo != null &&
          logo.isNotEmpty) {
        series.logo = logo;
      }
      final se = parseSeriesEpisode(ch.name);
      series.episodes.add(
        VodEpisode(
          season: se?.season ?? 1,
          episode: se?.episode ?? 0,
          title: cleanTitle(ch.name),
          url: ch.url,
          logo: ch.logo,
        ),
      );
    }
  }

  final series = seriesMap.values.toList();
  for (final s in series) {
    _numberFallbackEpisodes(s.episodes);
    s.episodes.sort((a, b) {
      final bySeason = a.season.compareTo(b.season);
      return bySeason != 0 ? bySeason : a.episode.compareTo(b.episode);
    });
    s.seasons = (<int>{for (final e in s.episodes) e.season}.toList()..sort());
  }
  movies.sort((a, b) => a.title.compareTo(b.title));
  series.sort((a, b) => a.title.compareTo(b.title));
  return VodLibrary(movies: movies, series: series);
}
