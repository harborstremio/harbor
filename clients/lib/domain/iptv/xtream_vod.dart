import '../../core/http/json_transport.dart';
import 'm3u.dart';
import 'xtream.dart';

/// Cache of `get_series_info` responses, keyed `<baseId>::<seriesId>`. Ported
/// from `iptv/xtream-vod.ts` `seriesInfoCache`.
final Map<String, Object?> _seriesInfoCache = {};

/// Drops cached series info for a source (or all sources). Ports
/// `clearSeriesInfoCache`.
void clearSeriesInfoCache([String? baseId]) {
  if (baseId == null) {
    _seriesInfoCache.clear();
    return;
  }
  final prefix = '$baseId::';
  _seriesInfoCache.removeWhere((key, _) => key.startsWith(prefix));
}

/// The cap on how many series get expanded into episodes. Ported from
/// `MAX_SERIES_EXPANDED`.
const int maxSeriesExpanded = 1200;

Map<String, String> _catMap(Object? raw) {
  final m = <String, String>{};
  if (raw is List) {
    for (final c in raw) {
      if (c is Map && c['category_id'] != null) {
        m[c['category_id'].toString()] = (c['category_name'] ?? '').toString();
      }
    }
  }
  return m;
}

String _buildVodUrl(XtreamCreds creds, Object streamId, [Object? ext]) {
  final u = Uri.encodeComponent(creds.username);
  final p = Uri.encodeComponent(creds.password);
  final base = '${creds.base}/movie/$u/$p/$streamId';
  final e = ext?.toString().trim();
  return (e != null && e.isNotEmpty) ? '$base.$e' : base;
}

String _buildSeriesUrl(XtreamCreds creds, Object episodeId, [Object? ext]) {
  final u = Uri.encodeComponent(creds.username);
  final p = Uri.encodeComponent(creds.password);
  final base = '${creds.base}/series/$u/$p/$episodeId';
  final e = ext?.toString().trim();
  return (e != null && e.isNotEmpty) ? '$base.$e' : base;
}

/// A number that is truthy in JS (`Number(v) || …`): null when unparseable,
/// zero, or NaN.
int? _truthyInt(Object? v) {
  final n = v is num ? v : num.tryParse('${v ?? ''}');
  if (n == null || n == 0 || n.isNaN) return null;
  return n.toInt();
}

/// Runs [fn] over [items] with at most [limit] concurrent calls, preserving
/// order. Ports `mapLimit`.
Future<List<R>> _mapLimit<T, R>(
  List<T> items,
  int limit,
  Future<R> Function(T) fn,
) async {
  final out = List<R?>.filled(items.length, null);
  var cursor = 0;
  Future<void> worker() async {
    while (cursor < items.length) {
      final idx = cursor;
      cursor += 1;
      out[idx] = await fn(items[idx]);
    }
  }

  final n = limit < items.length ? limit : items.length;
  await Future.wait([for (var i = 0; i < n; i++) worker()]);
  return out.cast<R>();
}

String? _group(Object? categoryId, Map<String, String> cats) {
  if (categoryId == null) return null;
  final key = categoryId.toString();
  return key.isEmpty ? null : cats[key];
}

/// Fetches the Xtream VOD (movie) catalog as channels. Ports `fetchXtreamVod`.
Future<List<IptvChannel>> fetchXtreamVod(
  JsonTransport t,
  XtreamCreds creds,
  String baseId,
) async {
  final results = await Future.wait([
    xtreamFetch(t, apiUrl(creds, 'get_vod_categories')),
    xtreamFetch(t, apiUrl(creds, 'get_vod_streams')),
  ]);
  final cats = _catMap(results[0]);
  final rows = results[1] is List ? results[1] as List : const [];
  final out = <IptvChannel>[];
  for (final r in rows) {
    if (r is! Map || r['stream_id'] == null) continue;
    final streamId = r['stream_id'] as Object;
    final name = (r['name'] ?? '').toString().trim();
    final icon = (r['stream_icon'] ?? '').toString().trim();
    out.add(
      IptvChannel(
        id: '$baseId::xtvod::$streamId',
        name: name.isNotEmpty ? name : 'Movie $streamId',
        logo: icon.isEmpty ? null : icon,
        group: _group(r['category_id'], cats),
        url: _buildVodUrl(creds, streamId, r['container_extension']),
        attrs: const {'tvg-type': 'movie'},
      ),
    );
  }
  return out;
}

/// Fetches the Xtream series catalog and expands each series into per-episode
/// channels (bounded concurrency, throttle-aware, cached). Ports
/// `fetchXtreamSeries`.
Future<List<IptvChannel>> fetchXtreamSeries(
  JsonTransport t,
  XtreamCreds creds,
  String baseId,
) async {
  final results = await Future.wait([
    xtreamFetch(t, apiUrl(creds, 'get_series_categories')),
    xtreamFetch(t, apiUrl(creds, 'get_series')),
  ]);
  final cats = _catMap(results[0]);
  final all = results[1] is List ? results[1] as List : const [];
  final series = all.take(maxSeriesExpanded).toList();
  var throttled = false;

  final perSeries = await _mapLimit<Object?, List<IptvChannel>>(series, 6, (
    s,
  ) async {
    if (s is! Map || s['series_id'] == null) return const [];
    final seriesId = s['series_id'] as Object;
    final rawName = (s['name'] ?? '').toString().trim();
    final seriesName = rawName.isNotEmpty ? rawName : 'Series $seriesId';
    final group = _group(s['category_id'], cats);
    final coverRaw = (s['cover'] ?? '').toString().trim();
    final cover = coverRaw.isEmpty ? null : coverRaw;

    final cacheKey = '$baseId::$seriesId';
    var info = _seriesInfoCache[cacheKey];
    if (info == null) {
      if (throttled) return const [];
      try {
        info = await xtreamFetch(
          t,
          apiUrl(creds, 'get_series_info', {'series_id': seriesId.toString()}),
        );
      } on XtreamAuthError catch (e) {
        if (RegExp(r'HTTP (?:429|403)').hasMatch(e.toString())) {
          throttled = true;
        }
        return const [];
      }
      _seriesInfoCache[cacheKey] = info;
    }
    final episodes = info is Map ? info['episodes'] : null;
    if (episodes is! Map) return const [];

    final eps = <IptvChannel>[];
    for (final seasonKey in episodes.keys) {
      final list = episodes[seasonKey];
      if (list is! List) continue;
      for (final ep in list) {
        if (ep is! Map || ep['id'] == null) continue;
        final epId = ep['id'] as Object;
        final season = _truthyInt(ep['season']) ?? _truthyInt(seasonKey) ?? 1;
        final epNum = _truthyInt(ep['episode_num']) ?? 0;
        final movieImage = ep['info'] is Map
            ? (ep['info'] as Map)['movie_image']
            : null;
        final img = (movieImage ?? '').toString().trim();
        eps.add(
          IptvChannel(
            id: '$baseId::xtep::$epId',
            name: '$seriesName S${season}E$epNum',
            logo: img.isNotEmpty ? img : cover,
            group: group,
            url: _buildSeriesUrl(creds, epId, ep['container_extension']),
            attrs: const {'tvg-type': 'series'},
          ),
        );
      }
    }
    return eps;
  });
  return [for (final list in perSeries) ...list];
}

/// Fetches VOD + series together, tolerating a failure of either half. Ports
/// `fetchXtreamVodAndSeries`.
Future<List<IptvChannel>> fetchXtreamVodAndSeries(
  JsonTransport t,
  XtreamCreds creds,
  String baseId,
) async {
  final results = await Future.wait([
    fetchXtreamVod(t, creds, baseId).catchError((_) => const <IptvChannel>[]),
    fetchXtreamSeries(
      t,
      creds,
      baseId,
    ).catchError((_) => const <IptvChannel>[]),
  ]);
  return [...results[0], ...results[1]];
}
