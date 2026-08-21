import '../../core/http/json_transport.dart';

/// One episode video from the anime-kitsu Stremio addon meta. Ported from
/// `AnimeKitsuVideo`. `season` is nullable because the episode-build merge
/// treats it as optional (`v.season ?? 1`).
class AnimeKitsuVideo {
  const AnimeKitsuVideo({
    required this.id,
    required this.title,
    required this.episode,
    this.season,
    this.released,
    this.thumbnail,
    this.overview,
    this.imdbId,
    this.imdbSeason,
    this.imdbEpisode,
  });

  final String id;
  final String title;
  final int episode;
  final int? season;
  final String? released;
  final String? thumbnail;
  final String? overview;
  final String? imdbId;
  final int? imdbSeason;
  final int? imdbEpisode;

  /// Parses one video, or null when it carries no episode number (unusable — it
  /// cannot be keyed or numbered downstream).
  static AnimeKitsuVideo? fromJson(Object? v) {
    if (v is! Map) return null;
    final episode = (v['episode'] as num?)?.toInt();
    if (episode == null) return null;
    return AnimeKitsuVideo(
      id: v['id'] as String? ?? '',
      title: v['title'] as String? ?? '',
      episode: episode,
      season: (v['season'] as num?)?.toInt(),
      released: v['released'] as String?,
      thumbnail: v['thumbnail'] as String?,
      overview: v['overview'] as String?,
      imdbId: v['imdb_id'] as String?,
      imdbSeason: (v['imdbSeason'] as num?)?.toInt(),
      imdbEpisode: (v['imdbEpisode'] as num?)?.toInt(),
    );
  }
}

/// The anime-kitsu addon's meta for one title, with its episode videos. Ported
/// from `AnimeKitsuMeta`.
class AnimeKitsuMeta {
  const AnimeKitsuMeta({
    required this.id,
    required this.type,
    required this.name,
    required this.videos,
    this.poster,
    this.background,
    this.logo,
    this.description,
    this.releaseInfo,
    this.imdbRating,
    this.imdbId,
  });

  final String id;

  /// `series` or `movie`.
  final String type;
  final String name;
  final List<AnimeKitsuVideo> videos;
  final String? poster;
  final String? background;
  final String? logo;
  final String? description;
  final String? releaseInfo;
  final String? imdbRating;
  final String? imdbId;

  static AnimeKitsuMeta fromJson(Map<String, dynamic> m) => AnimeKitsuMeta(
    id: m['id'] as String,
    type: m['type'] == 'movie' ? 'movie' : 'series',
    name: m['name'] as String? ?? '',
    poster: m['poster'] as String?,
    background: m['background'] as String?,
    logo: m['logo'] as String?,
    description: m['description'] as String?,
    releaseInfo: m['releaseInfo'] as String?,
    imdbRating: m['imdbRating'] as String?,
    imdbId: m['imdb_id'] as String?,
    videos: [
      if (m['videos'] is List)
        for (final v in m['videos'] as List) ?AnimeKitsuVideo.fromJson(v),
    ],
  );
}

void _lruSet<K, V>(Map<K, V> map, K key, V value, int max) {
  map.remove(key);
  map[key] = value;
  while (map.length > max) {
    map.remove(map.keys.first);
  }
}

/// The anime-kitsu Stremio addon meta provider — episode videos with IMDb
/// cross-ids that back anime episode building. Ported from
/// `lib/providers/anime-kitsu-addon.ts`. Only anime-scheme ids (kitsu/mal/
/// anilist/anidb) are served; a title's meta is fetched from the series
/// endpoint and, failing that, the movie endpoint. Successful metas are cached
/// (6h TTL, 300-entry LRU) with in-flight de-duplication; misses are not cached.
class AnimeKitsuAddonClient {
  AnimeKitsuAddonClient(
    this._transport, {
    DateTime Function() clock = DateTime.now,
    this.ttl = const Duration(hours: 6),
    this.cacheMax = 300,
  }) : _clock = clock;

  static const _host = 'https://anime-kitsu.strem.fun';

  final JsonTransport _transport;
  final DateTime Function() _clock;
  final Duration ttl;
  final int cacheMax;

  final Map<String, ({AnimeKitsuMeta? v, int t})> _cache = {};
  final Map<String, Future<AnimeKitsuMeta?>> _inflight = {};

  int get _now => _clock().millisecondsSinceEpoch;

  static bool _isAnimeId(String id) =>
      id.startsWith('kitsu:') ||
      id.startsWith('mal:') ||
      id.startsWith('anilist:') ||
      id.startsWith('anidb:');

  Future<AnimeKitsuMeta?> meta(String metaId) {
    if (!_isAnimeId(metaId)) return Future.value(null);
    final hit = _cache[metaId];
    if (hit != null && _now - hit.t < ttl.inMilliseconds) {
      return Future.value(hit.v);
    }
    final existing = _inflight[metaId];
    if (existing != null) return existing;
    final p = _fetch(metaId);
    _inflight[metaId] = p;
    // Statement body, not an arrow — an arrow would return the removed future
    // and have it await itself.
    return p.whenComplete(() {
      _inflight.remove(metaId);
    });
  }

  Future<AnimeKitsuMeta?> _fetch(String metaId) async {
    try {
      final enc = Uri.encodeComponent(metaId);
      Map<String, dynamic>? raw;
      final r = await _transport.getJson('$_host/meta/series/$enc.json');
      if (r.ok && r.data is Map) raw = (r.data as Map).cast<String, dynamic>();
      final seriesMeta = raw?['meta'];
      if (seriesMeta is! Map || seriesMeta['id'] == null) {
        final r2 = await _transport.getJson('$_host/meta/movie/$enc.json');
        if (r2.ok && r2.data is Map) {
          raw = (r2.data as Map).cast<String, dynamic>();
        }
      }
      final m = raw?['meta'];
      if (m is! Map || m['id'] == null) return null;
      final out = AnimeKitsuMeta.fromJson(m.cast<String, dynamic>());
      _lruSet(_cache, metaId, (v: out, t: _now), cacheMax);
      return out;
    } catch (_) {
      return null;
    }
  }
}
