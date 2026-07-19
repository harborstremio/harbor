import '../../core/http/json_transport.dart';
import '../addons/models.dart';

/// Parses the numeric Kitsu id out of a `kitsu:<id>` meta id, or null. Ported
/// 1:1 from `parseKitsuId`.
int? parseKitsuId(String metaId) {
  final m = RegExp(r'^kitsu:(\d+)').firstMatch(metaId);
  return m != null ? int.parse(m.group(1)!) : null;
}

/// A Kitsu anime detail record. Ported from `KitsuAnimeDetail`.
class KitsuAnimeDetail {
  const KitsuAnimeDetail({
    required this.id,
    required this.slug,
    required this.title,
    required this.synopsis,
    this.poster,
    this.backdrop,
    this.rating,
    this.episodeCount,
    this.episodeLength,
    this.status,
    this.subtype,
    this.year,
    this.startDate,
    this.endDate,
    this.ageRating,
    this.ageRatingGuide,
    this.trailerYtId,
    this.popularityRank,
    this.ratingRank,
    required this.genres,
    required this.genreSlugs,
    required this.categories,
  });

  final int id;
  final String slug;
  final String title;
  final String synopsis;
  final String? poster;
  final String? backdrop;
  final String? rating;
  final int? episodeCount;
  final int? episodeLength;
  final String? status;
  final String? subtype;
  final String? year;
  final String? startDate;
  final String? endDate;
  final String? ageRating;
  final String? ageRatingGuide;
  final String? trailerYtId;
  final int? popularityRank;
  final int? ratingRank;
  final List<String> genres;
  final List<String> genreSlugs;
  final List<String> categories;
}

/// A related anime and its relationship role. Ported from `KitsuRelated`.
class KitsuRelated {
  const KitsuRelated({required this.role, required this.meta});

  final String role;
  final MetaPreview meta;
}

/// A production studio credit. Ported from `KitsuStudio`.
class KitsuStudio {
  const KitsuStudio({required this.id, required this.name, required this.role});
  final int id;
  final String name;
  final String role;
}

/// A streaming service link. Ported from `KitsuStreamer`.
class KitsuStreamer {
  const KitsuStreamer({
    required this.id,
    required this.url,
    required this.service,
    required this.subtitles,
    required this.dubs,
  });
  final int id;
  final String url;
  final String service;
  final List<String> subtitles;
  final List<String> dubs;
}

/// An episode entry. Ported from `KitsuEpisode`. The fields the ani.zip merge
/// enriches in place are mutable, mirroring the source's in-place mutation.
class KitsuEpisode {
  KitsuEpisode({
    required this.id,
    required this.number,
    required this.seasonNumber,
    required this.title,
    required this.synopsis,
    this.thumbnail,
    this.airdate,
    this.length,
    this.streamId,
    this.imdbId,
    this.imdbSeason,
    this.imdbEpisode,
    this.filler,
    this.absoluteNumber,
    this.rating,
  });

  final int id;
  final int number;
  final int seasonNumber;
  String title;
  String synopsis;
  String? thumbnail;
  String? airdate;
  int? length;

  /// The addon video id used to resolve a stream, when built from addon meta.
  final String? streamId;
  String? imdbId;
  int? imdbSeason;
  int? imdbEpisode;
  bool? filler;
  int? absoluteNumber;
  num? rating;

  /// Whether [rating] came from the Harbor IMDb service, set during enrichment.
  bool? ratingIsImdb;

  /// A metahub thumbnail URL derived from the series IMDb id, used when no other
  /// thumbnail resolves. Set by the anime detail assembly.
  String? thumbnailFallback;

  /// The meta id this episode was sourced from, set when collected across a
  /// franchise's entries.
  String? sourceMetaId;
}

/// A character with its (preferred-Japanese) voice actor. Ported from
/// `KitsuCharacter`.
class KitsuCharacter {
  const KitsuCharacter({
    required this.id,
    required this.name,
    required this.role,
    this.image,
    this.voiceActor,
    this.voiceActorId,
    this.voiceActorImage,
    this.language,
  });
  final int id;
  final String name;
  final String role;
  final String? image;
  final String? voiceActor;
  final int? voiceActorId;
  final String? voiceActorImage;
  final String? language;
}

/// The Kitsu (kitsu.io) anime provider — JSON:API detail and relationship
/// fetches, cached for 30 minutes. Ported from the core of `lib/providers/
/// kitsu.ts`. Inject [clock] for tests. Raw direct HTTP — no proxy.
class KitsuClient {
  KitsuClient(
    this._transport, {
    DateTime Function() clock = DateTime.now,
    bool Function() adultHidden = _notHidden,
    this.cacheTtl = const Duration(minutes: 30),
  }) : _clock = clock,
       _adultHidden = adultHidden;

  static bool _notHidden() => false;

  static const _base = 'https://kitsu.io/api/edge';
  static const _headers = {'Accept': 'application/vnd.api+json'};

  final JsonTransport _transport;
  final DateTime Function() _clock;
  final bool Function() _adultHidden;
  final Duration cacheTtl;

  final Map<String, ({int at, Object? data})> _cache = {};

  int get _now => _clock().millisecondsSinceEpoch;

  Future<Object?> _get(String path) async {
    final url = '$_base$path';
    final hit = _cache[url];
    if (hit != null && _now - hit.at < cacheTtl.inMilliseconds) return hit.data;
    try {
      final r = await _transport.getJson(url, headers: _headers);
      if (!r.ok) return null;
      _cache[url] = (at: _now, data: r.data);
      return r.data;
    } catch (_) {
      return null;
    }
  }

  /// Full detail for one anime (with genres and categories). Ported from
  /// `kitsuAnime`.
  Future<KitsuAnimeDetail?> kitsuAnime(int id) async {
    final j = await _get('/anime/$id?include=genres,categories');
    final data = (j is Map ? j['data'] : null);
    if (data is! Map) return null;
    final a = _attrs(data);
    final genres = <String>[];
    final genreSlugs = <String>[];
    final categories = <String>[];
    for (final inc in _included(j)) {
      final attrs = _attrs(inc);
      if (inc['type'] == 'genres') {
        if (attrs['name'] is String) genres.add(attrs['name'] as String);
        if (attrs['slug'] is String) genreSlugs.add(attrs['slug'] as String);
      } else if (inc['type'] == 'categories') {
        if (attrs['title'] is String) categories.add(attrs['title'] as String);
      }
    }
    final start = a['startDate'] as String?;
    return KitsuAnimeDetail(
      id: int.tryParse('${data['id']}') ?? id,
      slug: a['slug'] as String? ?? '',
      title: _bestTitle(a),
      synopsis:
          (a['synopsis'] as String?) ?? (a['description'] as String?) ?? '',
      poster: _pickImg(a['posterImage']),
      backdrop: _pickImg(a['coverImage']),
      rating: _ratingToTen(a['averageRating'] as String?),
      episodeCount: (a['episodeCount'] as num?)?.toInt(),
      episodeLength: (a['episodeLength'] as num?)?.toInt(),
      status: a['status'] as String?,
      subtype: a['subtype'] as String?,
      year: (start != null && start.length >= 4) ? start.substring(0, 4) : null,
      startDate: start,
      endDate: a['endDate'] as String?,
      ageRating: a['ageRating'] as String?,
      ageRatingGuide: a['ageRatingGuide'] as String?,
      trailerYtId: a['youtubeVideoId'] as String?,
      popularityRank: (a['popularityRank'] as num?)?.toInt(),
      ratingRank: (a['ratingRank'] as num?)?.toInt(),
      genres: genres,
      genreSlugs: genreSlugs,
      categories: categories,
    );
  }

  /// The related anime (sequels, side stories, …) for one anime. Ported from
  /// `kitsuRelated`.
  Future<List<KitsuRelated>> kitsuRelated(int id) async {
    final j = await _get(
      '/anime/$id/media-relationships?include=destination&page[limit]=12',
    );
    final data = (j is Map ? j['data'] : null);
    if (data is! List) return const [];
    final animeById = <String, Map<String, dynamic>>{};
    for (final inc in _included(j)) {
      if (inc['type'] == 'anime') animeById['${inc['id']}'] = inc;
    }
    final out = <KitsuRelated>[];
    for (final rel in data) {
      if (rel is! Map) continue;
      final dest = ((rel['relationships'] as Map?)?['destination'] as Map?);
      final destData = dest?['data'];
      if (destData is! Map) continue; // to-many refs are skipped
      final a = animeById['${destData['id']}'];
      if (a == null) continue;
      out.add(
        KitsuRelated(
          role: (_attrs(rel)['role'] as String?) ?? 'related',
          meta: _attrsToMeta('${a['id']}', _attrs(a)),
        ),
      );
    }
    return out;
  }

  /// The main TV series in an anime's relationships (most episodes), for
  /// resolving a movie/OVA to its parent show. Ported from `kitsuMainTvSeries`.
  Future<int?> kitsuMainTvSeries(int id) async {
    final j = await _get(
      '/anime/$id/media-relationships?include=destination&page[limit]=20',
    );
    int? best;
    var bestEps = -1;
    for (final inc in _included(j)) {
      final a = _attrs(inc);
      if (inc['type'] != 'anime' || a['subtype'] != 'TV') continue;
      final nid = int.tryParse('${inc['id']}');
      final eps = (a['episodeCount'] as num?)?.toInt() ?? 0;
      if (nid != null && nid != id && eps > bestEps) {
        bestEps = eps;
        best = nid;
      }
    }
    return best;
  }

  /// The episodes of an anime, ordered by number. Ported from `kitsuEpisodes`.
  Future<List<KitsuEpisode>> kitsuEpisodes(int id, [int limit = 60]) async {
    final j = await _get('/anime/$id/episodes?page[limit]=$limit&sort=number');
    final data = (j is Map ? j['data'] : null);
    if (data is! List) return const [];
    return [
      for (final ep in data)
        if (ep is Map) _episode(ep.cast<String, dynamic>()),
    ];
  }

  KitsuEpisode _episode(Map<String, dynamic> ep) {
    final a = _attrs(ep);
    final number = (a['number'] as num?)?.toInt();
    return KitsuEpisode(
      id: int.tryParse('${ep['id']}') ?? 0,
      number: number ?? 0,
      seasonNumber: (a['seasonNumber'] as num?)?.toInt() ?? 1,
      title: a['canonicalTitle'] as String? ?? 'Episode ${number ?? '?'}',
      synopsis:
          (a['synopsis'] as String?) ?? (a['description'] as String?) ?? '',
      thumbnail: _pickImg(a['thumbnail']),
      airdate: a['airdate'] as String?,
      length: (a['length'] as num?)?.toInt(),
    );
  }

  /// The characters and (Japanese-preferred) voice actors. Ported from
  /// `kitsuCharacters`.
  Future<List<KitsuCharacter>> kitsuCharacters(int id, [int limit = 30]) async {
    final j = await _get(
      '/anime/$id/anime-characters?include=character,castings.person'
      '&page[limit]=$limit&sort=role',
    );
    final data = (j is Map ? j['data'] : null);
    if (data is! List) return const [];

    final charById = <String, Map<String, dynamic>>{};
    final castingById = <String, Map<String, dynamic>>{};
    final personById = <String, Map<String, dynamic>>{};
    for (final inc in _included(j)) {
      switch (inc['type']) {
        case 'characters':
          charById['${inc['id']}'] = inc;
        case 'animeCastings':
          castingById['${inc['id']}'] = inc;
        case 'people':
          personById['${inc['id']}'] = inc;
      }
    }

    final out = <KitsuCharacter>[];
    for (final ac in data) {
      if (ac is! Map) continue;
      final rels = (ac['relationships'] as Map?) ?? const {};
      final charId = ((rels['character'] as Map?)?['data'] as Map?)?['id'];
      final ch = charById['$charId'];
      if (ch == null) continue;

      final castingsData = (rels['castings'] as Map?)?['data'];
      Map<String, dynamic>? chosen;
      if (castingsData is List) {
        for (final c in castingsData) {
          if (c is! Map) continue;
          final casting = castingById['${c['id']}'];
          if (casting == null) continue;
          final locale = (_attrs(casting)['locale'] as String? ?? '')
              .toLowerCase();
          if (locale == 'ja') {
            chosen = casting;
            break;
          }
          chosen ??= casting;
        }
      }

      Map<String, dynamic>? va;
      if (chosen != null) {
        final pid =
            ((chosen['relationships'] as Map?)?['person'] as Map?)?['data']
                as Map?;
        if (pid != null) va = personById['${pid['id']}'];
      }
      final chAttrs = _attrs(ch);
      final vaAttrs = va != null ? _attrs(va) : const <String, dynamic>{};
      out.add(
        KitsuCharacter(
          id: int.tryParse('${ch['id']}') ?? 0,
          name:
              chAttrs['canonicalName'] as String? ??
              (chAttrs['names'] as Map?)?['en'] as String? ??
              'Character',
          role: _attrs(ac)['role'] as String? ?? 'supporting',
          image: _pickImg(chAttrs['image']),
          voiceActor: vaAttrs['name'] as String?,
          voiceActorId: va != null ? int.tryParse('${va['id']}') : null,
          voiceActorImage: _pickImg(vaAttrs['image']),
          language: chosen != null ? _attrs(chosen)['locale'] as String? : null,
        ),
      );
    }
    return out;
  }

  /// The production studios, ported from `kitsuStudios`.
  Future<List<KitsuStudio>> kitsuStudios(int id) async {
    final j = await _get(
      '/anime/$id/anime-productions?include=producer&page[limit]=20',
    );
    final data = (j is Map ? j['data'] : null);
    if (data is! List) return const [];
    final byId = {
      for (final inc in _included(j))
        if (inc['type'] == 'producers') '${inc['id']}': inc,
    };
    final out = <KitsuStudio>[];
    for (final prod in data) {
      if (prod is! Map) continue;
      final ref =
          ((prod['relationships'] as Map?)?['producer'] as Map?)?['data'];
      if (ref is! Map) continue;
      final p = byId['${ref['id']}'];
      if (p == null) continue;
      out.add(
        KitsuStudio(
          id: int.tryParse('${p['id']}') ?? 0,
          name: _attrs(p)['name'] as String? ?? 'Studio',
          role: _attrs(prod)['role'] as String? ?? 'production',
        ),
      );
    }
    return out;
  }

  /// The streaming-service links, ported from `kitsuStreamingLinks`.
  Future<List<KitsuStreamer>> kitsuStreamingLinks(int id) async {
    final j = await _get(
      '/anime/$id/streaming-links?include=streamer&page[limit]=20',
    );
    final data = (j is Map ? j['data'] : null);
    if (data is! List) return const [];
    final byId = {
      for (final inc in _included(j))
        if (inc['type'] == 'streamers') '${inc['id']}': inc,
    };
    final out = <KitsuStreamer>[];
    for (final link in data) {
      if (link is! Map) continue;
      final a = _attrs(link);
      final url = a['url'] as String?;
      final ref =
          ((link['relationships'] as Map?)?['streamer'] as Map?)?['data'];
      if (url == null || ref is! Map) continue;
      final s = byId['${ref['id']}'];
      if (s == null) continue;
      out.add(
        KitsuStreamer(
          id: int.tryParse('${s['id']}') ?? 0,
          url: url,
          service: _attrs(s)['siteName'] as String? ?? 'Streaming',
          subtitles: _strList(a['subs']),
          dubs: _strList(a['dubs']),
        ),
      );
    }
    return out;
  }

  /// Similar anime by shared genres, most-watched first. Ported from
  /// `kitsuSimilarByGenres`.
  Future<List<MetaPreview>> kitsuSimilarByGenres(
    List<String> genreSlugs,
    int excludeId, [
    int limit = 18,
  ]) async {
    if (genreSlugs.isEmpty) return const [];
    final slug = genreSlugs.take(4).join(',');
    final ageFilter = _adultHidden() ? '&filter[ageRating]=G,PG,R' : '';
    final j = await _get(
      '/anime?filter[genres]=${Uri.encodeQueryComponent(slug)}$ageFilter'
      '&sort=-userCount&page[limit]=${limit + 6}',
    );
    final data = (j is Map ? j['data'] : null);
    if (data is! List) return const [];
    final out = <MetaPreview>[];
    for (final a in data) {
      if (a is! Map) continue;
      if (int.tryParse('${a['id']}') == excludeId) continue;
      out.add(_attrsToMeta('${a['id']}', _attrs(a)));
      if (out.length >= limit) break;
    }
    return out;
  }

  /// The wide cover image for an anime, ported from `kitsuCoverImage`.
  Future<String?> kitsuCoverImage(int id) async {
    final j = await _get('/anime/$id?fields[anime]=coverImage');
    final data = (j is Map ? j['data'] : null);
    return data is Map ? _pickImg(_attrs(data)['coverImage']) : null;
  }

  // ── JSON:API helpers ─────────────────────────────────────────────────────

  static List<String> _strList(Object? v) => [
    if (v is List)
      for (final x in v)
        if (x is String) x,
  ];

  static Map<String, dynamic> _attrs(Object? resource) =>
      resource is Map && resource['attributes'] is Map
      ? (resource['attributes'] as Map).cast<String, dynamic>()
      : const {};

  static List<Map<String, dynamic>> _included(Object? doc) => [
    if (doc is Map && doc['included'] is List)
      for (final x in doc['included'] as List)
        if (x is Map) x.cast<String, dynamic>(),
  ];

  static String? _pickImg(Object? img) {
    if (img is! Map) return null;
    return (img['original'] ?? img['large'] ?? img['medium'] ?? img['small'])
        as String?;
  }

  static String? _ratingToTen(String? raw) {
    if (raw == null) return null;
    final n = num.tryParse(raw);
    return n == null ? null : (n / 10).toStringAsFixed(1);
  }

  static String _bestTitle(Map<String, dynamic> a) {
    final titles = (a['titles'] as Map?)?.cast<String, dynamic>() ?? const {};
    return (titles['en'] as String?)?.isNotEmpty == true
        ? titles['en'] as String
        : (a['canonicalTitle'] as String?)?.isNotEmpty == true
        ? a['canonicalTitle'] as String
        : (titles['en_jp'] as String?)?.isNotEmpty == true
        ? titles['en_jp'] as String
        : 'Unknown';
  }

  static MetaPreview _attrsToMeta(String id, Map<String, dynamic> a) {
    final start = a['startDate'] as String?;
    return MetaPreview({
      'id': 'kitsu:$id',
      'type': a['subtype'] == 'movie' ? 'movie' : 'series',
      'name': _bestTitle(a),
      'poster': ?_pickImg(a['posterImage']),
      'background': ?_pickImg(a['coverImage']),
      'description':
          (a['synopsis'] as String?) ?? (a['description'] as String?) ?? '',
      'releaseInfo': ?((start != null && start.length >= 4)
          ? start.substring(0, 4)
          : null),
      'imdbRating': ?_ratingToTen(a['averageRating'] as String?),
    });
  }
}
