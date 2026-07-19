import 'package:meta/meta.dart';

import '../../core/http/json_transport.dart';
import '../addons/models.dart';
import '../catalog/tmdb.dart';
import '../catalog/tmdb_anime.dart';
import '../catalog/tmdb_details.dart';
import 'anime_episode_build.dart';
import 'anime_episode_enrich.dart';
import 'anime_franchise.dart';
import 'anime_kitsu_addon.dart';
import 'anime_mapping.dart';
import 'anizip.dart';
import 'fanart.dart';
import 'kitsu_client.dart';

/// The patch of TMDB-sourced extras layered onto an anime detail after the
/// initial render (logo, wide artwork, richer crew and cast). Ported from
/// `AnimeDetailExtras` (a `Partial<TmdbDetail>`).
class AnimeDetailExtras {
  const AnimeDetailExtras({
    this.logo,
    this.backdrop,
    this.poster,
    this.imdbId,
    this.gallery,
    this.cast,
    this.extraVideos = const [],
    this.crew = const [],
    this.directors = const [],
    this.writers = const [],
    this.creators = const [],
    this.producers = const [],
    this.composer = const [],
    this.cinematography = const [],
    this.editor = const [],
    this.keywords = const [],
  });

  final String? logo;
  final String? backdrop;
  final String? poster;
  final String? imdbId;
  final GalleryImages? gallery;
  final List<CastEntry>? cast;
  final List<ExtraVideo> extraVideos;
  final List<CrewEntry> crew;
  final List<PersonRef> directors;
  final List<PersonRef> writers;
  final List<PersonRef> creators;
  final List<PersonRef> producers;
  final List<PersonRef> composer;
  final List<PersonRef> cinematography;
  final List<PersonRef> editor;
  final List<int> keywords;
}

/// The assembled anime detail: the immediate payload plus the deferred
/// franchise, episode-enrichment and TMDB-extras promises. Ported from
/// `AnimeDetailResult`.
class AnimeDetailResult {
  const AnimeDetailResult({
    required this.detail,
    required this.episodes,
    required this.streamers,
    required this.backdrops,
    required this.franchise,
    required this.enriched,
    required this.extras,
    required this.kitsuId,
    this.imdbId,
  });

  final TmdbDetail detail;
  final List<KitsuEpisode> episodes;
  final List<KitsuStreamer> streamers;
  final List<String> backdrops;
  final Future<List<FranchiseEntry>> franchise;
  final Future<List<KitsuEpisode>> enriched;
  final Future<AnimeDetailExtras> extras;
  final int kitsuId;
  final String? imdbId;
}

/// Applies the deferred [extras] patch onto [detail] — the TMDB logo, wide
/// artwork, richer crew and (fallback) cast that arrive after the initial Kitsu
/// render. Mirrors the web's `{ ...prev, ...patch }`: a field is replaced only
/// when the patch carries a value, so a failed/empty patch leaves the detail
/// untouched.
TmdbDetail applyAnimeExtras(TmdbDetail detail, AnimeDetailExtras extras) {
  List<T> pick<T>(List<T> patch, List<T> base) =>
      patch.isNotEmpty ? patch : base;
  return TmdbDetail(
    kind: detail.kind,
    id: detail.id,
    imdbId: extras.imdbId ?? detail.imdbId,
    title: detail.title,
    originalTitle: detail.originalTitle,
    tagline: detail.tagline,
    overview: detail.overview,
    poster: extras.poster ?? detail.poster,
    backdrop: extras.backdrop ?? detail.backdrop,
    logo: extras.logo ?? detail.logo,
    year: detail.year,
    rating: detail.rating,
    voteCount: detail.voteCount,
    runtime: detail.runtime,
    status: detail.status,
    genres: detail.genres,
    genresRich: detail.genresRich,
    originalLanguage: detail.originalLanguage,
    spokenLanguages: detail.spokenLanguages,
    productionCountries: detail.productionCountries,
    productionCompanies: detail.productionCompanies,
    networks: detail.networks,
    networksRich: detail.networksRich,
    productionCompaniesRich: detail.productionCompaniesRich,
    productionCountriesRich: detail.productionCountriesRich,
    trailerYtId: detail.trailerYtId,
    trailerCandidates: detail.trailerCandidates,
    extraVideos: pick(extras.extraVideos, detail.extraVideos),
    gallery: extras.gallery ?? detail.gallery,
    cast: extras.cast ?? detail.cast,
    crew: pick(extras.crew, detail.crew),
    directors: pick(extras.directors, detail.directors),
    writers: pick(extras.writers, detail.writers),
    creators: pick(extras.creators, detail.creators),
    producers: pick(extras.producers, detail.producers),
    composer: pick(extras.composer, detail.composer),
    cinematography: pick(extras.cinematography, detail.cinematography),
    editor: pick(extras.editor, detail.editor),
    recommendations: detail.recommendations,
    similar: detail.similar,
    collection: detail.collection,
    seasons: detail.seasons,
    numberOfSeasons: detail.numberOfSeasons,
    numberOfEpisodes: detail.numberOfEpisodes,
    keywords: pick(extras.keywords, detail.keywords),
    firstAirDate: detail.firstAirDate,
    lastAirDate: detail.lastAirDate,
    releaseDate: detail.releaseDate,
    lastEpisodeAir: detail.lastEpisodeAir,
    budget: detail.budget,
    revenue: detail.revenue,
    homepage: detail.homepage,
  );
}

/// Whether a meta id is an anime-scheme id the [AnimeDetailService] resolves
/// directly (kitsu/mal/anilist/anidb).
bool isAnimeId(String id) =>
    id.startsWith('kitsu:') ||
    id.startsWith('mal:') ||
    id.startsWith('anilist:') ||
    id.startsWith('anidb:');

const _statusLabels = {
  'current': 'Currently Airing',
  'finished': 'Finished Airing',
  'tba': 'TBA',
  'unreleased': 'Unreleased',
  'upcoming': 'Upcoming',
};

const _studioRoleRank = {'studio': 0, 'production': 1, 'licensor': 2};

const _externalSources = [
  ('mal:', 'myanimelist'),
  ('anilist:', 'anilist'),
  ('anidb:', 'anidb'),
];

// The cast resolved for an anime is cached by meta id so a franchise sibling
// that lacks its own cast can borrow it. Module-level, mirroring the source's
// FRANCHISE_CAST_CACHE.
final Map<String, List<CastEntry>> _franchiseCastCache = {};

/// Clears the process-wide franchise cast cache. For tests only.
@visibleForTesting
void resetFranchiseCastCache() => _franchiseCastCache.clear();

final _slugNonAlnum = RegExp(r'[^a-z0-9]+');
final _slugTrim = RegExp(r'^-+|-+$');

/// Assembles the full anime detail for a `kitsu:`/`mal:`/`anilist:`/`anidb:`
/// meta from Kitsu, the anime-kitsu addon, ani.zip, TMDB and fanart. Ported 1:1
/// from `animeDetails` (`anime-detail.ts`).
class AnimeDetailService {
  AnimeDetailService({
    required KitsuClient kitsu,
    required AnimeKitsuAddonClient addon,
    required AnimeMapper mapper,
    required AnimeFranchiseBuilder franchise,
    required AnimeEpisodeEnricher enricher,
    required FanartClient fanart,
    required TmdbClient tmdb,
    required JsonTransport transport,
  }) : _kitsu = kitsu,
       _addon = addon,
       _mapper = mapper,
       _franchise = franchise,
       _enricher = enricher,
       _fanart = fanart,
       _tmdb = tmdb,
       _transport = transport;

  final KitsuClient _kitsu;
  final AnimeKitsuAddonClient _addon;
  final AnimeMapper _mapper;
  final AnimeFranchiseBuilder _franchise;
  final AnimeEpisodeEnricher _enricher;
  final FanartClient _fanart;
  final TmdbClient _tmdb;
  final JsonTransport _transport;

  Future<AnimeDetailResult?> details(
    MetaPreview meta, {
    required String tvdbKey,
    required String fanartKey,
  }) async {
    var resolvedId = parseKitsuId(meta.id);
    if (resolvedId == null) {
      for (final (prefix, source) in _externalSources) {
        if (meta.id.startsWith(prefix)) {
          final n = int.tryParse(meta.id.substring(prefix.length));
          if (n != null) {
            resolvedId = await _orNull(_mapper.externalToKitsu(source, n));
          }
          break;
        }
      }
    }
    if (resolvedId == null) return null;
    final kitsuId = resolvedId;

    final animeF = _kitsu.kitsuAnime(kitsuId);
    final addonF = _orNull(_addon.meta('kitsu:$kitsuId'));
    final anime = await animeF;
    final addonMeta = await addonF;
    if (anime == null) return null;

    final franchiseFuture = _orEmptyFranchise(_franchise.build(kitsuId, anime));

    final effectiveSlugs = anime.genreSlugs.isNotEmpty
        ? anime.genreSlugs
        : [
            for (final g in anime.genres)
              if (_slugify(g).isNotEmpty) _slugify(g),
          ];

    final epF = _kitsu.kitsuEpisodes(kitsuId, 100);
    final charF = _kitsu.kitsuCharacters(kitsuId, 30);
    final relF = _kitsu.kitsuRelated(kitsuId);
    final studioF = _kitsu.kitsuStudios(kitsuId);
    final streamF = _kitsu.kitsuStreamingLinks(kitsuId);
    final similarF = effectiveSlugs.isNotEmpty
        ? _kitsu.kitsuSimilarByGenres(effectiveSlugs, kitsuId, 34)
        : Future.value(const <MetaPreview>[]);
    final aniZipF = _orNull(aniZipByKitsu(_transport, kitsuId));
    final kitsuRawEpisodes = await epF;
    final characters = await charF;
    final related = await relF;
    final studios = await studioF;
    final streamers = await streamF;
    final genreSimilar = await similarF;
    final aniZip = await aniZipF;

    final episodes = buildKitsuEpisodes(addonMeta, kitsuRawEpisodes);
    mergeAniZipEpisodes(episodes, aniZip);

    var seriesImdb = aniZip?.mappings?.imdbId ?? _firstEpisodeImdb(episodes);
    seriesImdb ??= await _orNull(_mapper.kitsuToImdb(kitsuId));

    if (seriesImdb != null && seriesImdb.startsWith('tt')) {
      for (final ep in episodes) {
        final abs = ep.absoluteNumber ?? ep.number;
        ep.thumbnailFallback =
            'https://episodes.metahub.space/$seriesImdb/1/$abs/w780.jpg';
      }
    }

    final kind = anime.subtype == 'movie' ? 'movie' : 'tv';

    final cast = <CastEntry>[
      for (var i = 0; i < characters.length; i++)
        CastEntry(
          id: characters[i].id,
          name: characters[i].name,
          character:
              characters[i].voiceActor ??
              (characters[i].role == 'main' ? 'Main' : 'Supporting'),
          profilePath: characters[i].image,
          order: i,
        ),
    ];
    final castKeys = [meta.id, 'kitsu:$kitsuId'];
    if (cast.isNotEmpty) {
      for (final k in castKeys) {
        _franchiseCastCache[k] = cast;
      }
    }

    final franchiseIds = <String>{
      meta.id,
      'kitsu:$kitsuId',
      for (final r in related) r.meta.id,
    };
    final similarPool = <MetaPreview>[];
    final poolSeen = <String>{};
    for (final m in genreSimilar) {
      if (franchiseIds.contains(m.id) || poolSeen.contains(m.id)) continue;
      poolSeen.add(m.id);
      similarPool.add(m);
    }
    final moreLikeThis = similarPool.take(14).toList();
    final youMightLike = similarPool.skip(14).take(14).toList();

    final sortedStudios = [...studios]
      ..sort(
        (a, b) => (_studioRoleRank[a.role] ?? 9).compareTo(
          _studioRoleRank[b.role] ?? 9,
        ),
      );
    final productionCompanies = _unique([
      for (final s in sortedStudios) s.name,
    ]);
    final networks = _unique([for (final s in streamers) s.service]);

    final detail = _buildDetail(
      kind: kind,
      anime: anime,
      meta: meta,
      addonMeta: addonMeta,
      productionCompanies: productionCompanies,
      networks: networks,
      cast: cast,
      moreLikeThis: moreLikeThis,
      youMightLike: youMightLike,
    );

    final enrichFuture = _enrichEpisodes(
      episodes,
      kitsuId,
      seriesImdb,
      tvdbKey,
    );
    final extrasFuture = _buildExtras(
      anime: anime,
      addonMeta: addonMeta,
      kitsuId: kitsuId,
      kind: kind,
      fanartKey: fanartKey,
      cast: cast,
      castKeys: castKeys,
    );
    final franchiseResult = _franchiseWithLogo(franchiseFuture, extrasFuture);

    return AnimeDetailResult(
      detail: detail,
      episodes: episodes,
      streamers: streamers,
      backdrops: anime.backdrop != null ? [anime.backdrop!] : const [],
      imdbId: addonMeta?.imdbId,
      franchise: franchiseResult,
      enriched: enrichFuture,
      extras: extrasFuture,
      kitsuId: kitsuId,
    );
  }

  TmdbDetail _buildDetail({
    required String kind,
    required KitsuAnimeDetail anime,
    required MetaPreview meta,
    required AnimeKitsuMeta? addonMeta,
    required List<String> productionCompanies,
    required List<String> networks,
    required List<CastEntry> cast,
    required List<MetaPreview> moreLikeThis,
    required List<MetaPreview> youMightLike,
  }) {
    final status = anime.status;
    return TmdbDetail(
      kind: kind,
      id: anime.id,
      imdbId: addonMeta?.imdbId,
      title: anime.title,
      originalTitle: anime.title,
      tagline: '',
      overview: anime.synopsis,
      poster: anime.poster,
      backdrop: anime.backdrop,
      year: anime.year,
      rating: meta.imdbRating?.toString() ?? anime.rating,
      voteCount: anime.popularityRank ?? 0,
      runtime: anime.episodeLength != null ? '${anime.episodeLength}m' : null,
      status: status != null ? (_statusLabels[status] ?? status) : '',
      genres: anime.genres,
      genresRich: const [],
      originalLanguage: 'ja',
      spokenLanguages: const ['Japanese'],
      productionCountries: const ['Japan'],
      productionCompanies: productionCompanies,
      networks: networks,
      trailerYtId: anime.trailerYtId,
      trailerCandidates: anime.trailerYtId != null
          ? [anime.trailerYtId!]
          : const [],
      extraVideos: const [],
      gallery: GalleryImages(
        backdrops: anime.backdrop != null ? [anime.backdrop!] : const [],
        posters: const [],
        logos: const [],
      ),
      cast: cast,
      crew: const [],
      directors: const [],
      writers: const [],
      creators: const [],
      producers: const [],
      composer: const [],
      cinematography: const [],
      editor: const [],
      recommendations: moreLikeThis,
      similar: youMightLike,
      seasons: const [],
      numberOfSeasons: kind == 'tv' ? 1 : 0,
      numberOfEpisodes: anime.episodeCount ?? 0,
      keywords: const [],
      firstAirDate: anime.startDate,
      lastAirDate: anime.endDate,
    );
  }

  Future<List<KitsuEpisode>> _enrichEpisodes(
    List<KitsuEpisode> episodes,
    int kitsuId,
    String? imdbId,
    String tvdbKey,
  ) async {
    try {
      await _enricher.enrich(
        episodes,
        kitsuId: kitsuId,
        imdbId: imdbId,
        tvdbKey: tvdbKey,
      );
    } catch (_) {
      // Best-effort; return the episodes as they are.
    }
    return episodes;
  }

  Future<AnimeDetailExtras> _buildExtras({
    required KitsuAnimeDetail anime,
    required AnimeKitsuMeta? addonMeta,
    required int kitsuId,
    required String kind,
    required String fanartKey,
    required List<CastEntry> cast,
    required List<String> castKeys,
  }) async {
    try {
      final tmdbHitF = _tmdb.hasKey
          ? _orNull(tmdbAnimeLogo(_tmdb, anime.title, anime.year, kind))
          : Future<TmdbAnimeArt?>.value(null);
      final tvdbIdF = (fanartKey.isNotEmpty && kind == 'tv')
          ? _orNull(_mapper.kitsuToTvdb(kitsuId))
          : Future<int?>.value(null);
      final tmdbHit = await tmdbHitF;
      final tvdbId = await tvdbIdF;

      String? logo;
      var backdrop = anime.backdrop;
      var poster = anime.poster;
      var backdrops = anime.backdrop != null ? [anime.backdrop!] : <String>[];
      if (tmdbHit != null) {
        if (tmdbHit.logo != null) logo = tmdbHit.logo;
        final b = tmdbHit.backdrop;
        if (b != null) {
          backdrop = b;
          backdrops = [b];
        }
      }

      final Future<FanartArt?> fanartF;
      if (fanartKey.isNotEmpty && kind == 'movie' && tmdbHit?.tmdbId != null) {
        fanartF = _orNull(_fanart.movie(fanartKey, tmdbHit!.tmdbId!));
      } else if (fanartKey.isNotEmpty && kind == 'tv' && tvdbId != null) {
        fanartF = _orNull(_fanart.tv(fanartKey, tvdbId));
      } else {
        fanartF = Future.value(null);
      }
      final tmdbFullF = (_tmdb.hasKey && tmdbHit?.tmdbId != null)
          ? _orNull(
              fetchTmdbDetails(
                _tmdb,
                MetaPreview({
                  'id':
                      'tmdb:${kind == 'movie' ? 'movie' : 'tv'}:${tmdbHit!.tmdbId}',
                  'type': kind == 'movie' ? 'movie' : 'series',
                  'name': anime.title,
                }),
              ),
            )
          : Future<TmdbDetail?>.value(null);
      final fa = await fanartF;
      final fullRaw = await tmdbFullF;

      if (fa != null) {
        if (fa.logo != null) logo = fa.logo;
        if (fa.backdrops.isNotEmpty) {
          backdrop = fa.backdrops.first;
          backdrops = fa.backdrops;
        }
        if (fa.poster != null) poster = fa.poster;
      }

      TmdbDetail? tmdbFull;
      if (fullRaw != null) {
        final ay = num.tryParse(anime.year ?? '');
        final ty = num.tryParse(fullRaw.year ?? '');
        if (ay == null || ty == null || (ty - ay).abs() <= 1) {
          tmdbFull = fullRaw;
        }
      }

      List<CastEntry>? patchCast;
      if (cast.isEmpty) {
        List<CastEntry>? fallback;
        for (final k in castKeys) {
          final c = _franchiseCastCache[k];
          if (c != null && c.isNotEmpty) {
            fallback = c;
            break;
          }
        }
        if (fallback == null && (tmdbFull?.cast.isNotEmpty ?? false)) {
          fallback = tmdbFull!.cast;
          for (final k in castKeys) {
            _franchiseCastCache[k] = tmdbFull.cast;
          }
        }
        patchCast = fallback;
      }

      return AnimeDetailExtras(
        logo: logo,
        backdrop: backdrop,
        poster: poster,
        imdbId: addonMeta?.imdbId ?? tmdbFull?.imdbId,
        extraVideos: tmdbFull?.extraVideos ?? const [],
        gallery: GalleryImages(
          backdrops: _unique([...backdrops, ...?tmdbFull?.gallery.backdrops]),
          posters: tmdbFull?.gallery.posters ?? const [],
          logos: tmdbFull?.gallery.logos ?? const [],
        ),
        crew: tmdbFull?.crew ?? const [],
        directors: tmdbFull?.directors ?? const [],
        writers: tmdbFull?.writers ?? const [],
        creators: tmdbFull?.creators ?? const [],
        producers: tmdbFull?.producers ?? const [],
        composer: tmdbFull?.composer ?? const [],
        cinematography: tmdbFull?.cinematography ?? const [],
        editor: tmdbFull?.editor ?? const [],
        keywords: tmdbFull?.keywords ?? const [],
        cast: patchCast,
      );
    } catch (_) {
      return const AnimeDetailExtras();
    }
  }

  Future<List<FranchiseEntry>> _franchiseWithLogo(
    Future<List<FranchiseEntry>> franchiseF,
    Future<AnimeDetailExtras> extrasF,
  ) async {
    final franchise = await franchiseF;
    final extras = await extrasF;
    final logo = extras.logo;
    if (logo != null) {
      for (final f in franchise) {
        f.logo ??= logo;
      }
    }
    return franchise;
  }

  String _slugify(String s) => s
      .toLowerCase()
      .trim()
      .replaceAll(_slugNonAlnum, '-')
      .replaceAll(_slugTrim, '');

  static String? _firstEpisodeImdb(List<KitsuEpisode> episodes) {
    for (final e in episodes) {
      if (e.imdbId != null) return e.imdbId;
    }
    return null;
  }

  static List<String> _unique(List<String> items) => items.toSet().toList();

  static Future<T?> _orNull<T>(Future<T?> f) async {
    try {
      return await f;
    } catch (_) {
      return null;
    }
  }

  static Future<List<FranchiseEntry>> _orEmptyFranchise(
    Future<List<FranchiseEntry>> f,
  ) async {
    try {
      return await f;
    } catch (_) {
      return const [];
    }
  }
}
