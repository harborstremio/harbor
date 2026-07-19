import 'm3u.dart';
import 'vod_title.dart';

/// Whether a channel is live TV vs on-demand. Ports `iptv/vod-classify.ts`
/// `VodKind`.
enum VodKind { live, movie, series }

final RegExp _vodExtRe = RegExp(
  r'\.(mkv|mp4|avi|m4v|mov|flv|wmv|mpg|mpeg|webm)(\?|$)',
  caseSensitive: false,
);
final RegExp _liveExtRe = RegExp(r'\.(ts|m3u8)(\?|$)', caseSensitive: false);
final RegExp _movieGroupRe = RegExp(
  r'\b(vod|movie|movies|film|films|cinema|pel[ií]culas?|filme)\b',
  caseSensitive: false,
);
final RegExp _seriesGroupRe = RegExp(
  r'\b(serie|series|s[ée]ries|tv ?show|tv ?shows|staffel|temporada)\b',
  caseSensitive: false,
);
final RegExp _movieOrSeriesUrlRe = RegExp(
  r'/(movie|series)/',
  caseSensitive: false,
);
final RegExp _seriesUrlRe = RegExp(r'/series/', caseSensitive: false);
final RegExp _movieUrlRe = RegExp(r'/movie/', caseSensitive: false);
final RegExp _liveUrlRe = RegExp(r'/live/', caseSensitive: false);

// Matches the web's `attrs["tvg-type"] || attrs["type"] || ""` (empty string is
// falsy in JS, so an empty tvg-type falls through to type).
String _declared(IptvChannel ch) {
  final tvgType = ch.attrs['tvg-type'];
  if (tvgType != null && tvgType.isNotEmpty) return tvgType.toLowerCase();
  return (ch.attrs['type'] ?? '').toLowerCase();
}

/// Whether [ch] is a live channel (not a VOD movie/series). Ports
/// `isLiveChannel`.
bool isLiveChannel(IptvChannel ch) {
  final declared = _declared(ch);
  if (declared == 'movie' || declared == 'series') return false;
  return !_movieOrSeriesUrlRe.hasMatch(ch.url);
}

/// Classifies a channel as live / movie / series from its declared type, URL
/// path, container extension, group, and episode markers. Ports
/// `classifyChannel`.
VodKind classifyChannel(IptvChannel ch) {
  final url = ch.url;
  final group = ch.group ?? '';
  final declared = _declared(ch);

  if (declared == 'movie') return VodKind.movie;
  if (declared == 'series') return VodKind.series;

  if (_seriesUrlRe.hasMatch(url)) return VodKind.series;
  if (_movieUrlRe.hasMatch(url)) return VodKind.movie;
  if (_liveUrlRe.hasMatch(url)) return VodKind.live;

  final vodExt = _vodExtRe.hasMatch(url);
  final liveExt = _liveExtRe.hasMatch(url);
  final movieFile = vodExt && !liveExt && !_seriesGroupRe.hasMatch(group);

  if (!movieFile && parseSeriesEpisode(ch.name) != null) return VodKind.series;

  if (_seriesGroupRe.hasMatch(group) && !liveExt) return VodKind.series;
  if (_movieGroupRe.hasMatch(group) && !liveExt) return VodKind.movie;

  if (vodExt && !liveExt) return VodKind.movie;
  return VodKind.live;
}
