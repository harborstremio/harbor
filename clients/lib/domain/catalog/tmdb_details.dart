import '../addons/models.dart';
import 'tmdb.dart';
import 'tmdb_media.dart';

/// A person reference (id + name), ported from `PersonRef`.
class PersonRef {
  const PersonRef({required this.id, required this.name});
  final int id;
  final String name;
}

/// A cast member, ported from `CastEntry`.
class CastEntry {
  const CastEntry({
    required this.id,
    required this.name,
    required this.character,
    required this.profilePath,
    required this.order,
  });
  final int id;
  final String name;
  final String character;
  final String? profilePath;
  final int order;
}

/// A crew member, ported from `CrewEntry`.
class CrewEntry {
  const CrewEntry({
    required this.id,
    required this.name,
    required this.job,
    required this.department,
    required this.profilePath,
  });
  final int id;
  final String name;
  final String job;
  final String department;
  final String? profilePath;
}

/// A TV season summary, ported from `Season`.
class Season {
  const Season({
    required this.id,
    required this.seasonNumber,
    required this.name,
    required this.overview,
    required this.posterPath,
    required this.episodeCount,
    required this.airDate,
  });
  final int id;
  final int seasonNumber;
  final String name;
  final String overview;
  final String? posterPath;
  final int episodeCount;
  final String? airDate;
}

/// A TV episode, ported from `Episode`.
class Episode {
  const Episode({
    required this.id,
    required this.episodeNumber,
    required this.seasonNumber,
    required this.name,
    required this.overview,
    required this.stillPath,
    required this.airDate,
    required this.runtime,
    required this.voteAverage,
  });
  final int id;
  final int episodeNumber;
  final int seasonNumber;
  final String name;
  final String overview;
  final String? stillPath;
  final String? airDate;
  final int? runtime;
  final num? voteAverage;

  Episode copyWith({
    String? name,
    String? overview,
    String? airDate,
    int? runtime,
  }) => Episode(
    id: id,
    episodeNumber: episodeNumber,
    seasonNumber: seasonNumber,
    name: name ?? this.name,
    overview: overview ?? this.overview,
    stillPath: stillPath,
    airDate: airDate ?? this.airDate,
    runtime: runtime ?? this.runtime,
    voteAverage: voteAverage,
  );
}

/// A non-trailer YouTube video, ported from `ExtraVideo`.
class ExtraVideo {
  const ExtraVideo({
    required this.ytId,
    required this.name,
    required this.type,
  });
  final String ytId;
  final String name;
  final String type;
}

/// The detail media gallery, ported from `GalleryImages`.
class GalleryImages {
  const GalleryImages({
    required this.backdrops,
    required this.posters,
    required this.logos,
  });
  final List<String> backdrops;
  final List<String> posters;
  final List<String> logos;
}

/// The last-aired episode reference for a series.
class LastEpisodeAir {
  const LastEpisodeAir({required this.seasonNumber, required this.airDate});
  final int seasonNumber;
  final String? airDate;
}

/// The full TMDB detail payload, ported 1:1 from `TmdbDetail` in
/// `src/lib/providers/tmdb/tmdb-details.ts` — the core detail-view data source.
class TmdbDetail {
  const TmdbDetail({
    required this.kind,
    required this.id,
    required this.imdbId,
    required this.title,
    required this.originalTitle,
    required this.tagline,
    required this.overview,
    required this.voteCount,
    required this.status,
    required this.genres,
    required this.genresRich,
    required this.originalLanguage,
    required this.spokenLanguages,
    required this.productionCountries,
    required this.productionCompanies,
    required this.networks,
    required this.trailerYtId,
    required this.trailerCandidates,
    required this.extraVideos,
    required this.gallery,
    required this.cast,
    required this.crew,
    required this.directors,
    required this.writers,
    required this.creators,
    required this.producers,
    required this.composer,
    required this.cinematography,
    required this.editor,
    required this.recommendations,
    required this.similar,
    required this.seasons,
    required this.numberOfSeasons,
    required this.numberOfEpisodes,
    required this.keywords,
    this.poster,
    this.backdrop,
    this.logo,
    this.year,
    this.rating,
    this.runtime,
    this.collection,
    this.firstAirDate,
    this.lastAirDate,
    this.releaseDate,
    this.lastEpisodeAir,
    this.budget,
    this.revenue,
    this.homepage,
    this.networksRich = const [],
    this.productionCompaniesRich = const [],
    this.productionCountriesRich = const [],
  });

  final String kind; // movie | tv
  final int id;
  final String? imdbId;
  final String title;
  final String originalTitle;
  final String tagline;
  final String overview;
  final String? poster;
  final String? backdrop;
  final String? logo;
  final String? year;
  final String? rating;
  final int voteCount;
  final String? runtime;
  final String status;
  final List<String> genres;
  final List<({int id, String name})> genresRich;
  final String originalLanguage;
  final List<String> spokenLanguages;
  final List<String> productionCountries;
  final List<String> productionCompanies;
  final List<String> networks;

  /// The id-carrying variants (TMDB only; empty for Cinemeta), so the info-block
  /// chips can open the corresponding browse filter — the `(id, name)` /
  /// `(iso, name)` counterparts of the display-name lists above.
  final List<({int id, String name})> networksRich;
  final List<({int id, String name})> productionCompaniesRich;
  final List<({String iso, String name})> productionCountriesRich;
  final String? trailerYtId;
  final List<String> trailerCandidates;
  final List<ExtraVideo> extraVideos;
  final GalleryImages gallery;
  final List<CastEntry> cast;
  final List<CrewEntry> crew;
  final List<PersonRef> directors;
  final List<PersonRef> writers;
  final List<PersonRef> creators;
  final List<PersonRef> producers;
  final List<PersonRef> composer;
  final List<PersonRef> cinematography;
  final List<PersonRef> editor;
  final List<MetaPreview> recommendations;
  final List<MetaPreview> similar;
  final ({int id, String name})? collection;
  final List<Season> seasons;
  final int numberOfSeasons;
  final int numberOfEpisodes;
  final List<int> keywords;
  final String? firstAirDate;
  final String? lastAirDate;
  final String? releaseDate;
  final LastEpisodeAir? lastEpisodeAir;
  final int? budget;
  final int? revenue;
  final String? homepage;
}

const _writerJobs = {
  'Writer',
  'Screenplay',
  'Story',
  'Teleplay',
  'Author',
  'Novel',
  'Original Story',
  'Original Series Creator',
};
const _producerJobs = {'Producer', 'Executive Producer'};

List<String> _urlsFromImages(List? entries, String size, int max) {
  if (entries == null || entries.isEmpty) return const [];
  final sorted = entries.whereType<Map>().toList();
  stableSort(
    sorted,
    (a, b) => ((b['vote_average'] as num?) ?? 0).compareTo(
      (a['vote_average'] as num?) ?? 0,
    ),
  );
  final seen = <String>{};
  final out = <String>[];
  for (final e in sorted) {
    final path = e['file_path'] as String?;
    if (path == null || !seen.add(path)) continue;
    out.add('$tmdbImg/$size$path');
    if (out.length >= max) break;
  }
  return out;
}

GalleryImages _buildGallery(Map? images, String? heroLogo) => GalleryImages(
  backdrops: _urlsFromImages(images?['backdrops'] as List?, 'w780', 24),
  posters: _urlsFromImages(images?['posters'] as List?, 'w342', 24),
  logos: _urlsFromImages(
    images?['logos'] as List?,
    'w500',
    12,
  ).where((u) => u != heroLogo).toList(),
);

List<PersonRef> _uniqByName(Iterable<Map> entries) {
  final seen = <String>{};
  final out = <PersonRef>[];
  for (final e in entries) {
    final name = (e['name'] ?? '').toString();
    if (!seen.add(name)) continue;
    out.add(PersonRef(id: (e['id'] as num?)?.toInt() ?? 0, name: name));
  }
  return out;
}

/// The first non-empty stringified value, matching JS `a || b || …` chaining
/// (an empty string falls through, unlike `??`).
String _firstNonEmpty(List<Object?> values) {
  for (final v in values) {
    final s = v?.toString() ?? '';
    if (s.isNotEmpty) return s;
  }
  return '';
}

/// The first four chars of a date, matching JS `String.slice(0, 4)` (safe on
/// strings shorter than four chars, unlike `substring`).
String? _year4(Object? a, Object? b) {
  final s = (a ?? b) as String?;
  if (s == null || s.isEmpty) return null;
  return s.length >= 4 ? s.substring(0, 4) : s;
}

List<Map<String, dynamic>> _mapList(Object? v) => (v as List? ?? const [])
    .whereType<Map>()
    .map((e) => e.cast<String, dynamic>())
    .toList();

/// Fetches a title's raw TMDB image assets (`{kind}/{id}/images`) filtered to
/// the effective image languages, ported from `fetchMovieAssets`.
Future<Map<String, dynamic>?> fetchMovieAssets(
  TmdbClient client,
  String metaId, {
  String? originalLang,
}) async {
  final match = RegExp(r'^tmdb:(movie|tv):(\d+)$').firstMatch(metaId);
  if (match == null || !client.hasKey) return null;
  return client.get('${match.group(1)}/${match.group(2)}/images', {
    'include_image_language': imageLangParam(
      client.imageLangNames,
      originalLang: originalLang,
    ),
  });
}

/// The best localized logo URL for a `tmdb:{movie,tv}:{id}` title, ported from
/// `tmdbLogo`: fetches the title's image assets and picks the highest-ranked
/// logo for the effective image languages. Null without a key, for a non-TMDB
/// id, or when the title has no logo.
Future<String?> tmdbLogo(
  TmdbClient client,
  String metaId, {
  String? originalLang,
}) async {
  final data = await fetchMovieAssets(
    client,
    metaId,
    originalLang: originalLang,
  );
  if (data == null) return null;
  return pickLogo(
    _mapList(data['logos']),
    client.imageLangNames,
    originalLang: originalLang,
  );
}

/// Assembles the full [TmdbDetail] for a meta, ported 1:1 from `tmdbDetails`:
/// resolves the TMDB id (`tmdb:*` prefixes or an `tt…` find), fetches the record
/// with credits/images/videos/keywords/translations appended, and maps cast,
/// crew roles, seasons, gallery, trailers, recommendations and the localized
/// logo/poster. Returns null without a key or when the id cannot be resolved.
Future<TmdbDetail?> fetchTmdbDetails(
  TmdbClient client,
  MetaPreview meta,
) async {
  if (!client.hasKey) return null;

  String kind;
  String id;
  final metaId = meta.id;
  if (metaId.startsWith('tmdb:movie:')) {
    kind = 'movie';
    id = metaId.substring('tmdb:movie:'.length);
  } else if (metaId.startsWith('tmdb:tv:')) {
    kind = 'tv';
    id = metaId.substring('tmdb:tv:'.length);
  } else if (metaId.startsWith('tt')) {
    final find = await client.get('find/$metaId', {
      'external_source': 'imdb_id',
    });
    if (find == null) return null;
    final movieHit = (find['movie_results'] as List?)?.firstOrNull;
    final tvHit = (find['tv_results'] as List?)?.firstOrNull;
    if (meta.type == 'movie' && movieHit is Map) {
      kind = 'movie';
      id = '${movieHit['id']}';
    } else if (meta.type == 'series' && tvHit is Map) {
      kind = 'tv';
      id = '${tvHit['id']}';
    } else {
      return null;
    }
  } else {
    return null;
  }

  final metaLang = client.language.isNotEmpty ? client.language : 'en';
  final raw = await client.get('$kind/$id', {
    'append_to_response':
        'credits,aggregate_credits,recommendations,similar,videos,external_ids,images,keywords,translations',
    'language': metaLang,
    'include_image_language': imageLangParam(client.imageLangNames),
  });
  if (raw == null) return null;

  final images = raw['images'] as Map?;
  final origLang = raw['original_language'] is String
      ? raw['original_language'] as String
      : '';
  var logo = pickLogo(
    _mapList(images?['logos']),
    client.imageLangNames,
    originalLang: origLang,
  );
  var posterSource = images?['posters'] as List?;
  if (logo == null &&
      origLang.isNotEmpty &&
      !imageLangParam(client.imageLangNames).split(',').contains(origLang)) {
    final assets = await fetchMovieAssets(
      client,
      'tmdb:$kind:$id',
      originalLang: origLang,
    );
    if (assets != null) {
      logo = pickLogo(
        _mapList(assets['logos']),
        client.imageLangNames,
        originalLang: origLang,
      );
      posterSource = (assets['posters'] as List?) ?? posterSource;
    }
  }

  final rawKeywords =
      (raw['keywords'] as Map?)?['keywords'] ??
      (raw['keywords'] as Map?)?['results'] ??
      const [];
  final keywords = (rawKeywords as List)
      .map((k) => (k as Map?)?['id'])
      .whereType<num>()
      .map((n) => n.toInt())
      .toList();

  final videos = _mapList((raw['videos'] as Map?)?['results']);
  final trailerCandidates = pickTrailers(videos);
  final trailerYtId = trailerCandidates.firstOrNull;
  final candidateSet = trailerCandidates.toSet();
  final extraVideos = videos
      .where((v) => v['site'] == 'YouTube' && !candidateSet.contains(v['key']))
      .take(12)
      .map(
        (v) => ExtraVideo(
          ytId: (v['key'] ?? '').toString(),
          name: (v['name'] ?? v['type'] ?? '').toString(),
          type: (v['type'] ?? '').toString(),
        ),
      )
      .toList();

  final gallery = _buildGallery(images, logo);

  final aggCast = _mapList((raw['aggregate_credits'] as Map?)?['cast']);
  final flatCast = _mapList((raw['credits'] as Map?)?['cast']);
  final castSrc = aggCast.isNotEmpty ? aggCast : flatCast;
  final cast = castSrc.map((c) {
    final roles = c['roles'] as List?;
    final character =
        c['character']?.toString() ??
        (roles != null && roles.isNotEmpty
            ? roles
                  .whereType<Map>()
                  .map((r) => r['character'])
                  .where((x) => x != null && '$x'.isNotEmpty)
                  .join(', ')
            : '');
    return CastEntry(
      id: (c['id'] as num?)?.toInt() ?? 0,
      name: (c['name'] ?? '').toString(),
      character: character,
      profilePath: c['profile_path'] as String?,
      order: (c['order'] as num?)?.toInt() ?? 999,
    );
  }).toList();

  final aggCrew = _mapList((raw['aggregate_credits'] as Map?)?['crew']);
  final flatCrew = _mapList((raw['credits'] as Map?)?['crew']);
  final crewSrc = aggCrew.isNotEmpty ? aggCrew : flatCrew;
  final crew = crewSrc
      .map(
        (c) => CrewEntry(
          id: (c['id'] as num?)?.toInt() ?? 0,
          name: (c['name'] ?? '').toString(),
          job: (c['job'] ?? (c['jobs'] as List?)?.firstOrNull?['job'] ?? '')
              .toString(),
          department: (c['department'] ?? '').toString(),
          profilePath: c['profile_path'] as String?,
        ),
      )
      .toList();

  List<String> jobsOf(Map c) {
    final jobs = c['jobs'] as List?;
    if (jobs != null && jobs.isNotEmpty) {
      return jobs
          .whereType<Map>()
          .map((j) => j['job']?.toString())
          .whereType<String>()
          .where((s) => s.isNotEmpty)
          .toList();
    }
    final job = c['job']?.toString();
    return job != null && job.isNotEmpty ? [job] : const [];
  }

  List<PersonRef> byJob(bool Function(String) test) =>
      _uniqByName(crewSrc.where((c) => jobsOf(c).any(test)));

  final directors = byJob((j) => j == 'Director');
  final writers = byJob(_writerJobs.contains);
  final producers = byJob(_producerJobs.contains);
  final composer = byJob((j) => j == 'Original Music Composer' || j == 'Music');
  final cinematography = byJob(
    (j) => j == 'Director of Photography' || j == 'Cinematography',
  );
  final editor = byJob((j) => j == 'Editor');
  final creators = _mapList(raw['created_by'])
      .map(
        (c) => PersonRef(
          id: (c['id'] as num?)?.toInt() ?? 0,
          name: (c['name'] ?? '').toString(),
        ),
      )
      .toList();

  MetaPreview toMeta(Map r) => MetaPreview({
    'id': kind == 'movie' ? 'tmdb:movie:${r['id']}' : 'tmdb:tv:${r['id']}',
    'type': kind == 'movie' ? 'movie' : 'series',
    'name': _firstNonEmpty([r['title'], r['name']]),
    if (r['poster_path'] != null) 'poster': '$tmdbImg/w342${r['poster_path']}',
    if (r['backdrop_path'] != null)
      'background': '$tmdbImg/w780${r['backdrop_path']}',
    if (r['overview'] != null) 'description': r['overview'],
    if (_year4(r['release_date'], r['first_air_date']) != null)
      'releaseInfo': _year4(r['release_date'], r['first_air_date']),
    if ((r['release_date'] ?? r['first_air_date']) != null)
      'releaseDate': r['release_date'] ?? r['first_air_date'],
    if (((r['vote_average'] as num?) ?? 0) > 0)
      'imdbRating': (r['vote_average'] as num).toStringAsFixed(1),
  });

  final recommendations = _mapList(
    (raw['recommendations'] as Map?)?['results'],
  ).map(toMeta).toList();
  final similar = _mapList(
    (raw['similar'] as Map?)?['results'],
  ).map(toMeta).toList();

  final seasons =
      _mapList(raw['seasons'])
          .where(
            (s) =>
                ((s['season_number'] as num?) ?? 0) > 0 &&
                ((s['episode_count'] as num?) ?? 0) > 0,
          )
          .toList()
        ..sort(
          (a, b) => ((a['season_number'] as num?) ?? 0).compareTo(
            (b['season_number'] as num?) ?? 0,
          ),
        );
  final seasonList = seasons
      .map(
        (s) => Season(
          id: (s['id'] as num?)?.toInt() ?? 0,
          seasonNumber: (s['season_number'] as num?)?.toInt() ?? 0,
          name: (s['name'] ?? '').toString(),
          overview: (s['overview'] ?? '').toString(),
          posterPath: s['poster_path'] as String?,
          episodeCount: (s['episode_count'] as num?)?.toInt() ?? 0,
          airDate: s['air_date'] as String?,
        ),
      )
      .toList();

  String? runtime;
  if (kind == 'movie') {
    final rt = raw['runtime'] as num?;
    runtime = (rt != null && rt > 0) ? '$rt min' : null;
  } else {
    final ert = (raw['episode_run_time'] as List?)?.firstOrNull as num?;
    final ns = raw['number_of_seasons'] as num?;
    if (ert != null && ert > 0) {
      runtime = '$ert min episodes';
    } else if (ns != null && ns > 0) {
      runtime = '$ns season${ns == 1 ? '' : 's'}';
    }
  }

  var overview = (raw['overview'] ?? '').toString();
  var tagline = (raw['tagline'] ?? '').toString();
  if (!client.translateDescriptions) {
    final translations = _mapList(
      (raw['translations'] as Map?)?['translations'],
    );
    final enData = translations.firstWhere(
      (t) => t['iso_639_1'] == 'en',
      orElse: () => const {},
    )['data'];
    if (enData is Map) {
      if ((enData['overview'] as String?)?.isNotEmpty ?? false) {
        overview = enData['overview'] as String;
      }
      if ((enData['tagline'] as String?)?.isNotEmpty ?? false) {
        tagline = enData['tagline'] as String;
      }
    }
  }

  var finalPosterPath = raw['poster_path'] as String?;
  if (client.posterBaseUrl.isEmpty &&
      posterSource != null &&
      posterSource.isNotEmpty) {
    final posters = posterSource.whereType<Map>().toList();
    stableSort(posters, (a, b) {
      final byLang =
          imageLangRank(
            b['iso_639_1'] as String?,
            client.imageLangNames,
            originalLang: origLang,
          ) -
          imageLangRank(
            a['iso_639_1'] as String?,
            client.imageLangNames,
            originalLang: origLang,
          );
      if (byLang != 0) return byLang;
      return ((b['vote_average'] as num?) ?? 0).compareTo(
        (a['vote_average'] as num?) ?? 0,
      );
    });
    final best = posters.firstOrNull;
    if (best != null) finalPosterPath = best['file_path'] as String?;
  }

  final belongs = raw['belongs_to_collection'];
  final releaseYear =
      ((raw['release_date'] ?? raw['first_air_date']) as String?);
  final lastEp = raw['last_episode_to_air'] as Map?;

  return TmdbDetail(
    kind: kind,
    id: (raw['id'] as num?)?.toInt() ?? int.tryParse(id) ?? 0,
    imdbId: (raw['external_ids'] as Map?)?['imdb_id'] as String?,
    title: client.translateTitles
        ? _firstNonEmpty([raw['title'], raw['name']])
        : _firstNonEmpty([
            raw['original_title'],
            raw['original_name'],
            raw['title'],
            raw['name'],
          ]),
    originalTitle: (raw['original_title'] ?? raw['original_name'] ?? '')
        .toString(),
    tagline: tagline,
    overview: overview,
    poster: finalPosterPath != null ? '$tmdbImg/w342$finalPosterPath' : null,
    backdrop: raw['backdrop_path'] != null
        ? '$tmdbImg/original${raw['backdrop_path']}'
        : null,
    logo: logo,
    year: (releaseYear != null && releaseYear.length >= 4)
        ? releaseYear.substring(0, 4)
        : null,
    rating: ((raw['vote_average'] as num?) ?? 0) > 0
        ? (raw['vote_average'] as num).toStringAsFixed(1)
        : null,
    voteCount: (raw['vote_count'] as num?)?.toInt() ?? 0,
    runtime: runtime,
    status: (raw['status'] ?? '').toString(),
    genres: _mapList(
      raw['genres'],
    ).map((g) => (g['name'] ?? '').toString()).toList(),
    genresRich: _mapList(raw['genres'])
        .where((g) => g['id'] is num && g['name'] != null)
        .map((g) => (id: (g['id'] as num).toInt(), name: g['name'].toString()))
        .toList(),
    originalLanguage: (raw['original_language'] ?? '').toString().toUpperCase(),
    spokenLanguages: _mapList(
      raw['spoken_languages'],
    ).map((l) => (l['english_name'] ?? l['name'] ?? '').toString()).toList(),
    productionCountries: _mapList(
      raw['production_countries'],
    ).map((c) => (c['name'] ?? '').toString()).toList(),
    productionCompanies: _mapList(
      raw['production_companies'],
    ).map((c) => (c['name'] ?? '').toString()).toList(),
    networks: _mapList(
      raw['networks'],
    ).map((n) => (n['name'] ?? '').toString()).toList(),
    networksRich: [
      for (final n in _mapList(raw['networks']))
        if (n['id'] is num && (n['name'] ?? '').toString().isNotEmpty)
          (id: (n['id'] as num).toInt(), name: n['name'].toString()),
    ],
    productionCompaniesRich: [
      for (final c in _mapList(raw['production_companies']))
        if (c['id'] is num && (c['name'] ?? '').toString().isNotEmpty)
          (id: (c['id'] as num).toInt(), name: c['name'].toString()),
    ],
    productionCountriesRich: [
      for (final c in _mapList(raw['production_countries']))
        if ((c['iso_3166_1'] ?? '').toString().isNotEmpty &&
            (c['name'] ?? '').toString().isNotEmpty)
          (iso: c['iso_3166_1'].toString(), name: c['name'].toString()),
    ],
    trailerYtId: trailerYtId,
    trailerCandidates: trailerCandidates,
    extraVideos: extraVideos,
    gallery: gallery,
    cast: cast,
    crew: crew,
    directors: directors,
    writers: writers,
    creators: creators,
    producers: producers,
    composer: composer,
    cinematography: cinematography,
    editor: editor,
    recommendations: recommendations,
    similar: similar,
    collection: belongs is Map
        ? (
            id: (belongs['id'] as num?)?.toInt() ?? 0,
            name: (belongs['name'] ?? '').toString(),
          )
        : null,
    seasons: seasonList,
    numberOfSeasons: (raw['number_of_seasons'] as num?)?.toInt() ?? 0,
    numberOfEpisodes: (raw['number_of_episodes'] as num?)?.toInt() ?? 0,
    keywords: keywords,
    firstAirDate: raw['first_air_date'] as String?,
    lastAirDate: raw['last_air_date'] as String?,
    releaseDate: raw['release_date'] as String?,
    lastEpisodeAir: lastEp != null
        ? LastEpisodeAir(
            seasonNumber: (lastEp['season_number'] as num?)?.toInt() ?? 0,
            airDate: lastEp['air_date'] as String?,
          )
        : null,
    budget: (raw['budget'] as num?)?.toInt(),
    revenue: (raw['revenue'] as num?)?.toInt(),
    homepage: raw['homepage'] as String?,
  );
}

/// Fetches a TV season's episodes, ported from `tmdbSeasonEpisodes`.
Future<List<Episode>> tmdbSeasonEpisodes(
  TmdbClient client,
  int tvId,
  int seasonNumber,
) async {
  if (!client.hasKey) return const [];
  final metaLang = client.language.isNotEmpty ? client.language : 'en';
  final data = await client.get('tv/$tvId/season/$seasonNumber', {
    'language': metaLang,
  });
  final episodes = _mapList(data?['episodes']);
  return episodes
      .map(
        (e) => Episode(
          id: (e['id'] as num?)?.toInt() ?? 0,
          episodeNumber: (e['episode_number'] as num?)?.toInt() ?? 0,
          seasonNumber: (e['season_number'] as num?)?.toInt() ?? 0,
          name: (e['name'] ?? '').toString(),
          overview: (e['overview'] ?? '').toString(),
          stillPath: e['still_path'] as String?,
          airDate: e['air_date'] as String?,
          runtime: (e['runtime'] as num?)?.toInt(),
          voteAverage: e['vote_average'] as num?,
        ),
      )
      .toList();
}

/// A single episode's full TMDB detail: the base fields plus the merged
/// cast + guest stars, crew, stills, and imdb id. Ports the shape of
/// `tmdb-episode-details.ts` `EpisodeDetail`.
class EpisodeDetail {
  const EpisodeDetail({
    required this.id,
    required this.episodeNumber,
    required this.seasonNumber,
    required this.name,
    required this.overview,
    required this.stillPath,
    required this.airDate,
    required this.runtime,
    required this.voteAverage,
    required this.voteCount,
    required this.imdbId,
    required this.guestStars,
    required this.crew,
    required this.stills,
  });

  final int id;
  final int episodeNumber;
  final int seasonNumber;
  final String name;
  final String overview;
  final String? stillPath;
  final String? airDate;
  final int? runtime;
  final num? voteAverage;
  final int voteCount;
  final String? imdbId;

  /// Regular cast then guest stars, de-duped by person id and sorted by order.
  final List<CastEntry> guestStars;
  final List<CrewEntry> crew;

  /// Still image file paths (at most 12), in TMDB order.
  final List<String> stills;
}

/// Fetches one episode's full detail (credits + images + external ids), merging
/// cast with guest stars. Ports `tmdbEpisodeDetail`; null without a key or on a
/// missing episode.
Future<EpisodeDetail?> fetchEpisodeDetail(
  TmdbClient client,
  int tvId,
  int seasonNumber,
  int episodeNumber,
) async {
  if (!client.hasKey) return null;
  final metaLang = client.language.isNotEmpty ? client.language : 'en';
  final data = await client.get(
    'tv/$tvId/season/$seasonNumber/episode/$episodeNumber',
    {'append_to_response': 'credits,images,external_ids', 'language': metaLang},
  );
  if (data == null) return null;

  final credits =
      (data['credits'] as Map?)?.cast<String, dynamic>() ?? const {};
  final seen = <int>{};
  final guestStars = <CastEntry>[];
  void push(Map<String, dynamic> m) {
    final id = (m['id'] as num?)?.toInt();
    if (id == null || seen.contains(id)) return;
    seen.add(id);
    guestStars.add(
      CastEntry(
        id: id,
        name: (m['name'] ?? '').toString(),
        character: (m['character'] ?? '').toString(),
        profilePath: m['profile_path'] as String?,
        order: (m['order'] as num?)?.toInt() ?? 9999,
      ),
    );
  }

  for (final c in _mapList(credits['cast'])) {
    push(c);
  }
  for (final c in _mapList(credits['guest_stars'])) {
    push(c);
  }
  guestStars.sort((a, b) => a.order.compareTo(b.order));

  final crew = _mapList(credits['crew'])
      .map(
        (m) => CrewEntry(
          id: (m['id'] as num?)?.toInt() ?? 0,
          name: (m['name'] ?? '').toString(),
          job: (m['job'] ?? '').toString(),
          department: (m['department'] ?? '').toString(),
          profilePath: m['profile_path'] as String?,
        ),
      )
      .toList();

  final images = (data['images'] as Map?)?.cast<String, dynamic>() ?? const {};
  final stills = _mapList(images['stills'])
      .take(12)
      .map((m) => (m['file_path'] ?? '').toString())
      .where((s) => s.isNotEmpty)
      .toList();

  final ext = (data['external_ids'] as Map?)?.cast<String, dynamic>();

  return EpisodeDetail(
    id: (data['id'] as num?)?.toInt() ?? 0,
    episodeNumber: (data['episode_number'] as num?)?.toInt() ?? 0,
    seasonNumber: (data['season_number'] as num?)?.toInt() ?? 0,
    name: (data['name'] ?? '').toString(),
    overview: (data['overview'] ?? '').toString(),
    stillPath: data['still_path'] as String?,
    airDate: data['air_date'] as String?,
    runtime: (data['runtime'] as num?)?.toInt(),
    voteAverage: data['vote_average'] as num?,
    voteCount: (data['vote_count'] as num?)?.toInt() ?? 0,
    imdbId: ext?['imdb_id'] as String?,
    guestStars: guestStars,
    crew: crew,
    stills: stills,
  );
}
