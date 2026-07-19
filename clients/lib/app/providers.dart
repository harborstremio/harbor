import 'dart:ui' show PlatformDispatcher;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'anilist_providers.dart';
import 'simkl_providers.dart';
import 'stremio_auth.dart';
import 'trakt_providers.dart';
import '../core/http/json_transport.dart';
import '../core/storage/kv_store.dart';
import '../core/storage/secure_store.dart';
import '../domain/addons/addon_client.dart';
import '../domain/addons/installed_addons_repository.dart';
import '../core/abort_signal.dart';
import '../domain/addons/models.dart';
import '../domain/addons/reorder.dart';
import '../domain/catalog/catalog_browse.dart';
import '../domain/catalog/catalog_row.dart';
import '../domain/catalog/cinemeta.dart';
import '../domain/catalog/cinemeta_catalog.dart';
import '../domain/catalog/cinemeta_details.dart';
import '../domain/catalog/hero_slide.dart';
import '../domain/catalog/movie_catalog.dart';
import '../domain/catalog/rankings.dart';
import '../domain/catalog/show_catalog.dart';
import '../domain/catalog/show_hero.dart';
import '../domain/catalog/streaming.dart';
import '../domain/calendar/calendar.dart';
import '../domain/calendar/calendar_library.dart';
import '../domain/stremio/library_item.dart';
import '../domain/trakt/trakt_types.dart';
import '../domain/catalog/tmdb.dart';
import '../domain/catalog/tmdb_collection.dart';
import '../domain/catalog/tmdb_details.dart';
import '../domain/catalog/rpdb.dart';
import '../domain/catalog/tmdb_home.dart';
import '../domain/catalog/tmdb_ids.dart';
import '../domain/catalog/tmdb_person.dart';
import '../domain/catalog/tmdb_watch.dart';
import '../domain/catalog/tvdb.dart';
import '../domain/detail/detail_customization.dart';
import '../domain/detail/last_season.dart';
import '../domain/library/custom_lists.dart';
import '../domain/library/local_cw.dart';
import '../domain/library/manual_watched.dart';
import '../domain/library/playback_history.dart';
import '../domain/library/season_lock.dart';
import '../domain/library/movie_watched.dart';
import '../domain/library/local_watchlist.dart';
import '../domain/debrid/debrid_http.dart';
import '../domain/debrid/debrid_types.dart';
import '../domain/debrid/registry.dart';
import '../domain/profiles/profiles_repository.dart';
import '../domain/ratings/mdblist.dart';
import '../domain/ratings/mdblist_batch.dart';
import '../domain/ratings/harbor_imdb.dart';
import '../domain/ratings/omdb.dart';
import '../domain/resume/resume_store.dart';
import '../domain/search/recent_searches.dart';
import '../domain/search/search_multi.dart';
import '../domain/settings/settings.dart';
import '../domain/settings/settings_repository.dart';
import '../domain/streams/dio_link_prober.dart';
import '../domain/streams/fetch_streams.dart';
import '../domain/streams/parsed_stream.dart';
import '../domain/streams/parser/parse_stream.dart';
import '../domain/streams/aiostatus.dart';
import '../domain/streams/resolve.dart';
import '../domain/streams/scoring/score_components.dart';
import '../domain/streams/scoring/score_stream.dart';
import '../domain/streams/scoring/scored_stream.dart';
import '../domain/anime/anime_detail.dart' show isAnimeId;
import '../domain/anime/kitsu_client.dart' show KitsuEpisode;
import '../domain/streams/stream_ids.dart';
import '../domain/subtitles/subtitle_autoload.dart';
import '../domain/skip/ad_corpus.dart';
import '../domain/skip/ad_report.dart';
import '../domain/skip/skip_segments.dart';
import '../domain/subtitles/subtitle_search.dart';
import '../domain/onboarding/onboarding_store.dart';

/// The direct JSON HTTP transport. Overridden in tests with a canned transport.
final jsonTransportProvider = Provider<JsonTransport>(
  (ref) => DioJsonTransport(),
);

final addonClientProvider = Provider<AddonClient>(
  (ref) => AddonClient(ref.watch(jsonTransportProvider)),
);

/// The persistent key-value store. Must be overridden at startup (main opens a
/// Hive store) or in tests — there is no silent in-memory fallback in the app.
final kvStoreProvider = Provider<KvStore>(
  (ref) => throw StateError('kvStoreProvider must be overridden'),
);

/// Secure storage for secrets. Defaults to an in-memory store (tests); the app
/// root overrides it with the platform keychain-backed [FlutterSecureStore].
final secureStoreProvider = Provider<SecureStore>((ref) => MemorySecureStore());

final installedAddonsRepoProvider = Provider<InstalledAddonsRepository>(
  (ref) => InstalledAddonsRepository(ref.watch(kvStoreProvider)),
);

final profilesRepoProvider = Provider<ProfilesRepository>(
  (ref) => ProfilesRepository(ref.watch(kvStoreProvider)),
);

final settingsRepoProvider = Provider<SettingsRepository>(
  (ref) => SettingsRepository(
    ref.watch(kvStoreProvider),
    ref.watch(profilesRepoProvider),
    ref.watch(secureStoreProvider),
    deviceUiLanguage: PlatformDispatcher.instance.locale.languageCode,
  ),
);

/// The effective settings, with an [SettingsController.setValue] to persist a
/// single field (used e.g. to store a debrid key).
class SettingsController extends Notifier<Settings> {
  @override
  Settings build() {
    final effective = ref.watch(settingsRepoProvider).loadEffective();
    // Secrets live in the keychain, not the plaintext blob, so merge them in
    // asynchronously once the synchronous load has returned.
    _mergeSecrets();
    return effective;
  }

  Future<void> _mergeSecrets() async {
    final secrets = await ref.read(settingsRepoProvider).loadSecrets();
    if (secrets.isEmpty) return;
    var next = state;
    secrets.forEach((k, v) => next = next.withValue(k, v));
    state = next;
  }

  Future<void> setValue(String key, dynamic value) async {
    final next = state.withValue(key, value);
    await ref.read(settingsRepoProvider).persistEffective(next);
    state = next;
  }

  /// Applies several keys in one persist, so related settings (e.g. the mutually
  /// exclusive play-mode flags) can't race and clobber each other the way two
  /// un-awaited [setValue] calls would.
  Future<void> setValues(Map<String, dynamic> values) async {
    var next = state;
    values.forEach((key, value) => next = next.withValue(key, value));
    await ref.read(settingsRepoProvider).persistEffective(next);
    state = next;
  }
}

final settingsProvider = NotifierProvider<SettingsController, Settings>(
  SettingsController.new,
);

/// The direct debrid HTTP transport (no retry — providers inspect codes).
final debridHttpProvider = Provider<DebridHttp>((ref) => DioDebridHttp());

/// The configured debrid clients, one per non-empty key in rd,tb,ad,pm,dl order.
final debridClientsProvider = Provider<List<DebridStore>>((ref) {
  final s = ref.watch(settingsProvider);
  final keys = DebridKeys(
    rdKey: s.getString('rdKey'),
    tbKey: s.getString('tbKey'),
    adKey: s.getString('adKey'),
    pmKey: s.getString('pmKey'),
    dlKey: s.getString('dlKey'),
  );
  return buildDebridClients(keys, ref.watch(debridHttpProvider));
});

/// HEAD prober used by stream resolution to reject web pages / stub videos.
final linkProberProvider = Provider<LinkProber>((ref) => DioLinkProber());

/// The resume/continue-watching position store (`harbor.resume`).
final resumeStoreProvider = Provider<ResumeStore>(
  (ref) => ResumeStore(ref.watch(kvStoreProvider)),
);

/// Searches subtitles across OpenSubtitles v3 and installed subtitle addons.
final subtitleSearcherProvider = Provider<SubtitleSearcher>(
  (ref) => SubtitleSearcher(ref.watch(jsonTransportProvider)),
);

/// Auto-loads and auto-selects subtitles into the player.
final subtitleAutoloaderProvider = Provider<SubtitleAutoloader>(
  (ref) => SubtitleAutoloader(ref.watch(subtitleSearcherProvider)),
);

/// Fetches/assembles skip-intro segments (TheIntroDB + chapters + ad segments)
/// for the player's skip-pill and auto-skip.
final skipSegmentsFetcherProvider = Provider<SkipSegmentsFetcher>(
  (ref) => SkipSegmentsFetcher(ref.watch(jsonTransportProvider)),
);

/// The signed injected-ad corpus (cached across plays) and the ad-report
/// submitter, for the experimental ad-skip feature.
final adCorpusProvider = Provider<AdCorpus>(
  (ref) => AdCorpus(ref.watch(jsonTransportProvider)),
);
final adReportSubmitterProvider = Provider<AdReportSubmitter>(
  (ref) => AdReportSubmitter(ref.watch(jsonTransportProvider)),
);

/// The debrid-service health reported by an installed AIOStatus add-on (null
/// when none is installed). Drives the Streaming settings health banner.
final aioStatusHealthProvider = FutureProvider<AioStatusSnapshot?>(
  (ref) => fetchAioStatusHealth(
    ref.watch(activeAddonsProvider),
    ref.watch(jsonTransportProvider),
  ),
);

/// The reactive list of installed addons, with install/uninstall actions.
class InstalledAddonsController extends Notifier<List<InstalledAddon>> {
  @override
  List<InstalledAddon> build() => ref.watch(installedAddonsRepoProvider).load();

  /// Install by URL: normalize, fetch the manifest, persist. Returns null on
  /// success or a user-facing error message.
  Future<String?> install(String url, {required int installedAt}) async {
    final repo = ref.read(installedAddonsRepoProvider);
    final normalized = repo.normalizeAddonUrl(url);
    final failure = normalized.failureOrNull;
    if (failure != null) return failure.message;

    final transportUrl = normalized.valueOrNull!;
    final manifest =
        (await ref.read(addonClientProvider).manifest(transportUrl))
            .valueOrNull;
    await repo.install(
      transportUrl,
      manifest: manifest,
      installedAt: installedAt,
    );
    state = repo.load();
    return null;
  }

  Future<void> uninstall(String transportUrl) async {
    final repo = ref.read(installedAddonsRepoProvider);
    await repo.uninstall(transportUrl);
    state = repo.load();
  }

  /// Moves the add-on at [index] by [delta] slots (persisting the new order),
  /// which is the query priority the stream/catalog fetchers read by position.
  Future<void> move(int index, int delta) async {
    final target = index + delta;
    if (index < 0 ||
        index >= state.length ||
        target < 0 ||
        target >= state.length) {
      return;
    }
    final next = [...state];
    next.insert(target, next.removeAt(index));
    await ref.read(installedAddonsRepoProvider).save(next);
    state = next;
  }

  /// Reorders the installed list to follow [urls] (any addon whose url is not in
  /// [urls] keeps its relative place at the end), persisting the new priority.
  /// Mirrors the Organize page's saved order onto the local store.
  Future<void> reorder(List<String> urls) async {
    final next = applyOrderToItems(state, urls, (a) => a.transportUrl);
    await ref.read(installedAddonsRepoProvider).save(next);
    state = next;
  }
}

final installedAddonsProvider =
    NotifierProvider<InstalledAddonsController, List<InstalledAddon>>(
      InstalledAddonsController.new,
    );

/// The reactive set of switched-off add-ons (`harbor.addons.disabled`).
class DisabledAddonsController extends Notifier<Set<String>> {
  InstalledAddonsRepository get _repo => ref.read(installedAddonsRepoProvider);

  @override
  Set<String> build() => _repo.loadDisabled();

  Future<void> toggle(String transportUrl) async =>
      state = await _repo.toggleDisabled(transportUrl);

  Future<void> prune(Set<String> keepTransportUrls) async =>
      state = await _repo.pruneDisabled(keepTransportUrls);
}

final disabledAddonsProvider =
    NotifierProvider<DisabledAddonsController, Set<String>>(
      DisabledAddonsController.new,
    );

/// Installed add-ons minus the disabled ones — the set queried for catalogs,
/// streams and subtitles. The add-ons view still lists every installed add-on.
final activeAddonsProvider = Provider<List<InstalledAddon>>((ref) {
  final installed = ref.watch(installedAddonsProvider);
  final disabled = ref.watch(disabledAddonsProvider);
  if (disabled.isEmpty) return installed;
  return installed.where((a) => !disabled.contains(a.transportUrl)).toList();
});

/// Every browsable catalog across the active add-ons, for the Catalogs view.
final browseCatalogsProvider = Provider<List<BrowseCatalog>>(
  (ref) => listBrowseCatalogs(ref.watch(activeAddonsProvider)),
);

/// A browsable catalog's items (base row, no genre filter). Empty on failure.
final browseCatalogItemsProvider =
    FutureProvider.family<
      List<MetaPreview>,
      ({String base, String type, String id})
    >(
      (ref, k) async =>
          (await ref.watch(addonClientProvider).catalog(k.base, k.type, k.id))
              .valueOrNull ??
          const [],
    );

/// The Home addon catalog rows: each installed addon catalog fetched into a
/// content row (empty rows dropped). Classic Home shows only these; curated Home
/// appends them. Ports the web `loadAddonRows`.
final addonHomeRowsProvider = FutureProvider<List<CatalogRow>>((ref) async {
  final catalogs = ref.watch(browseCatalogsProvider);
  if (catalogs.isEmpty) return const [];
  final client = ref.watch(addonClientProvider);
  // Cap the fan-out so a user with dozens of addons doesn't stall the Home.
  const cap = 40;
  final results = await Future.wait(
    catalogs.take(cap).map((c) async {
      final items =
          (await client.catalog(c.base, c.type, c.id)).valueOrNull ??
          const <MetaPreview>[];
      return (c, items);
    }),
  );
  final rows = <CatalogRow>[];
  for (final (c, items) in results) {
    if (items.isEmpty) continue;
    rows.add(
      CatalogRow(
        title: c.name,
        type: c.type,
        id: c.id,
        items: items,
        key: c.key,
      ),
    );
  }
  return rows;
});

/// The TMDB client, configured from settings (key, language, title-translation).
/// Keyless-safe: without a `tmdbKey` every call returns empty/null and the app
/// stays on the Cinemeta path.
final tmdbClientProvider = Provider<TmdbClient>((ref) {
  final s = ref.watch(settingsProvider);
  final imageLangNames = s.getStringList('tmdbImageLangs');
  return TmdbClient(
    transport: ref.watch(jsonTransportProvider),
    apiKey: s.tmdbKey,
    language: s.getString('tmdbLanguage'),
    imageLang: imageRequestLang(imageLangNames),
    imageLangNames: imageLangNames,
    translateTitles: s.getBool('translateTitles'),
    translateDescriptions: s.getBool('translateDescriptions'),
    posterBaseUrl: s.getString('posterBaseUrl'),
  );
});

/// A resolved TMDB collection by id (cached per id), for the collection detail
/// view. Null without a key or when the id has no collection.
final collectionProvider = FutureProvider.family<TmdbCollection?, int>(
  (ref, id) => fetchTmdbCollection(ref.watch(tmdbClientProvider), id),
);

/// A person's full detail + combined credits by TMDB id, for the person view.
/// Null without a key or when the id is unknown.
final personProvider = FutureProvider.family<PersonDetail?, int>(
  (ref, id) => fetchPerson(ref.watch(tmdbClientProvider), id),
);

/// The library calendar for a month — upcoming releases for everything saved
/// (local watchlist + Stremio library when signed in + Trakt watchlist when
/// connected), resolved via TMDB/Cinemeta/AniZip/TVmaze.
final libraryCalendarProvider =
    FutureProvider.family<List<CalendarItem>, ({int year, int month})>((
      ref,
      ym,
    ) async {
      final local = [
        for (final e in ref.watch(localWatchlistProvider).list())
          SavedCandidate(
            id: e.id,
            type: e.type == 'series' ? 'series' : 'movie',
            name: e.name,
            mtime: e.addedAt,
          ),
      ];
      final authKey = ref.watch(stremioSessionProvider).asData?.value?.authKey;
      var stremio = const <LibraryItem>[];
      if (authKey != null && authKey.isNotEmpty) {
        stremio =
            (await ref.read(stremioApiProvider).library(authKey)).valueOrNull ??
            const [];
      }
      var trakt = const <TraktWatchItem>[];
      if (ref.watch(traktConnectedProvider)) {
        trakt = await ref.read(traktClientProvider).fetchWatchlist();
      }
      final candidates = gatherLibraryCandidates(stremio, local, trakt);
      if (candidates.isEmpty) return const [];
      return resolveSavedCalendar(
        candidates,
        ym.year,
        ym.month,
        tmdb: ref.watch(tmdbClientProvider),
        addon: ref.watch(addonClientProvider),
        transport: ref.watch(jsonTransportProvider),
        now: DateTime.now(),
      );
    });

/// The TMDB release calendar for a month (family: `(year, month)`, month 1-12),
/// deduped and sorted by date. Empty without a TMDB key.
final calendarMonthProvider =
    FutureProvider.family<List<CalendarItem>, ({int year, int month})>((
      ref,
      ym,
    ) {
      final (start, end) = monthRange(ym.year, ym.month);
      return fetchCalendarRange(
        ref.watch(tmdbClientProvider),
        start: start,
        end: end,
      );
    });

/// The department top-100 popularity rankings, powering the "Top N" badges on
/// the person view and cast cards. Null without a key.
final rankingsProvider = FutureProvider<RankMaps?>(
  (ref) => fetchPopularRankings(ref.watch(tmdbClientProvider)),
);

/// The streaming providers a title is available on in the user's region, for
/// the detail view's "Watch on" rail. Empty without a key.
final watchProvidersProvider =
    FutureProvider.family<List<WatchProvider>, ({String type, int id})>(
      (ref, key) => tmdbWatchProviders(
        ref.watch(tmdbClientProvider),
        key.type,
        key.id,
        ref.watch(settingsProvider).region,
      ),
    );

/// The Movies-tab catalog (hero + curated rows), ported from the `movies.tsx`
/// build: the keyed TMDB movie catalog (falling back to Cinemeta if it yields
/// nothing), else the keyless Cinemeta movie catalog.
final movieCatalogProvider = FutureProvider<CinemetaHome>((ref) async {
  final tmdb = ref.watch(tmdbClientProvider);
  if (tmdb.hasKey) {
    final built = await fetchMovieCatalog(
      tmdb,
      region: ref.watch(settingsProvider).region,
    );
    if (built.rows.isNotEmpty) return built;
  }
  return fetchCinemetaMovieCatalog(ref.watch(addonClientProvider));
});

/// The Shows-tab catalog (hero + curated rows), ported from the `shows.tsx`
/// build: the keyed TMDB show catalog + the seed-shuffled show hero (falling
/// back to Cinemeta if the rows are empty), else the keyless Cinemeta catalog.
final showCatalogProvider = FutureProvider<CinemetaHome>((ref) async {
  final tmdb = ref.watch(tmdbClientProvider);
  if (tmdb.hasKey) {
    final built = await fetchShowCatalog(tmdb);
    if (built.rows.isNotEmpty) {
      final hero = await buildShowHero(tmdb);
      return CinemetaHome(rows: built.rows, hero: hero);
    }
  }
  return fetchCinemetaShowCatalog(ref.watch(addonClientProvider));
});

List<HeroSlide> _catalogHeroSlides(List<MetaPreview> pool) {
  final seen = <String>{};
  final out = <HeroSlide>[];
  for (final m in pool) {
    if (m.background == null || !seen.add(m.id)) continue;
    out.add(
      HeroSlide(
        meta: Meta(m.json),
        rankLabel: m.type == 'series' ? 'TV' : 'Movies',
        rankPosition: out.length + 1,
      ),
    );
    if (out.length >= 4) break;
  }
  return out;
}

/// The Movies-catalog hero carousel slides (from the catalog's hero pool).
final movieCatalogHeroProvider = FutureProvider<List<HeroSlide>>(
  (ref) async =>
      _catalogHeroSlides((await ref.watch(movieCatalogProvider.future)).hero),
);

/// The Shows-catalog hero carousel slides.
final showCatalogHeroProvider = FutureProvider<List<HeroSlide>>(
  (ref) async =>
      _catalogHeroSlides((await ref.watch(showCatalogProvider.future)).hero),
);

/// The episodes of a TMDB series season, for the detail season/episode grid.
final seasonEpisodesProvider =
    FutureProvider.family<List<Episode>, ({int tvId, int season})>(
      (ref, arg) => tmdbSeasonEpisodes(
        ref.watch(tmdbClientProvider),
        arg.tvId,
        arg.season,
      ),
    );

/// One episode's full TMDB detail (guest stars, crew, stills, imdb id) — the
/// data behind the episode-detail page. Null without a TMDB key.
final episodeDetailProvider =
    FutureProvider.family<
      EpisodeDetail?,
      ({int tvId, int season, int episode})
    >(
      (ref, arg) => fetchEpisodeDetail(
        ref.watch(tmdbClientProvider),
        arg.tvId,
        arg.season,
        arg.episode,
      ),
    );

/// The OMDB score store (KvStore-backed cache + persisted daily budget).
final omdbStoreProvider = Provider<OmdbStore>(
  (ref) =>
      OmdbStore(ref.watch(kvStoreProvider), ref.watch(jsonTransportProvider)),
);

/// The MDBList cross-site score store.
final mdblistStoreProvider = Provider<MdblistStore>(
  (ref) => MdblistStore(ref.watch(jsonTransportProvider)),
);

/// The batched poster-card MDBList score store (KvStore-backed cache, one POST
/// per debounced window across every visible card).
final mdblistBatchStoreProvider = Provider<MdblistBatchStore>(
  (ref) => MdblistBatchStore(
    ref.watch(jsonTransportProvider),
    ref.watch(kvStoreProvider),
  ),
);

/// The batched cross-site scores for a poster card, keyed by imdb id + kind
/// (`movie` / `show`). Null without an `mdblistKey`. Ports the web
/// `useMdblistCardScores`: the id is queued, debounced, and resolved by the
/// next batch flush (or served immediately from the TTL cache).
final mdblistCardScoresProvider = FutureProvider.autoDispose
    .family<CardScores?, ({String imdbId, String kind})>((ref, arg) {
      // Depend only on the key, not the whole Settings object — otherwise every
      // unrelated settings mutation re-runs this family for each visible card.
      final key = ref.watch(settingsProvider.select((s) => s.mdblistKey));
      if (key.isEmpty) return Future<CardScores?>.value(null);
      return ref
          .watch(mdblistBatchStoreProvider)
          .request(key, arg.imdbId, arg.kind);
    });

/// The combined OMDB + MDBList scores for a detail hero, keyed by imdb id +
/// media type (`movie` / `show`). Empty without an imdb id or the relevant keys.
class DetailRatings {
  const DetailRatings({this.omdb, this.mdblist});
  final OmdbScores? omdb;
  final MdblistScores? mdblist;
}

/// The fresh IMDb rating for a `tt…` id from the Harbor IMDb service — the
/// highest-priority source for the detail hero's primary IMDb rating.
final harborImdbRatingProvider = FutureProvider.family<double?, String>(
  (ref, tt) => harborImdbTitle(ref.watch(jsonTransportProvider), tt),
);

/// Fresh per-episode IMDb ratings for a series (keyed `"season:episode"`) — the
/// preferred rating on the detail season/episode grid.
final harborImdbEpisodesProvider =
    FutureProvider.family<Map<String, double>, String>(
      (ref, seriesTt) =>
          harborImdbEpisodes(ref.watch(jsonTransportProvider), seriesTt),
    );

/// The parental-guide categories for a `tt…` id from the Harbor IMDb service —
/// the source for the detail view's content-advisory section.
final harborImdbParentalProvider =
    FutureProvider.family<List<ParentalCategory>, String>(
      (ref, tt) => harborImdbParental(ref.watch(jsonTransportProvider), tt),
    );

/// OMDB per-episode IMDb ratings for a season (keyed by episode number) — the
/// fallback after Harbor IMDb on the season/episode grid. Empty without a key.
final omdbSeasonRatingsProvider =
    FutureProvider.family<Map<int, double>, ({String imdbId, int season})>((
      ref,
      arg,
    ) {
      final s = ref.watch(settingsProvider);
      return ref
          .watch(omdbStoreProvider)
          .seasonRatings(s.omdbKey, arg.imdbId, arg.season);
    });

/// The TheTVDB client (token cached for the session). Gated by `tvdbKey`.
final tvdbClientProvider = Provider<TvdbClient>(
  (ref) => TvdbClient(ref.watch(jsonTransportProvider)),
);

/// A series' TVDB id resolved from its imdb id (cached per series). Null without
/// a `tvdbKey`.
final tvdbSeriesIdProvider = FutureProvider.family<int?, String>((ref, imdbId) {
  final key = ref.watch(settingsProvider).getString('tvdbKey');
  if (key.isEmpty) return Future.value(null);
  return ref.watch(tvdbClientProvider).seriesByImdb(key, imdbId);
});

/// TVDB per-season episodes (keyed by episode number) for enriching the season
/// grid's overview/runtime/name/air-date. Empty without a `tvdbKey`.
final tvdbSeasonEpisodesProvider =
    FutureProvider.family<Map<int, TvdbEpisode>, ({String imdbId, int season})>(
      (ref, arg) async {
        final key = ref.watch(settingsProvider).getString('tvdbKey');
        if (key.isEmpty) return const {};
        final seriesId = await ref.watch(
          tvdbSeriesIdProvider(arg.imdbId).future,
        );
        if (seriesId == null) return const {};
        final eps = await ref
            .watch(tvdbClientProvider)
            .episodes(key, seriesId, arg.season);
        return {for (final e in eps) e.number: e};
      },
    );

final detailRatingsProvider =
    FutureProvider.family<DetailRatings, ({String? imdbId, String mediaType})>((
      ref,
      arg,
    ) async {
      final imdbId = arg.imdbId;
      if (imdbId == null) return const DetailRatings();
      final s = ref.watch(settingsProvider);
      final omdb = await ref
          .watch(omdbStoreProvider)
          .scores(
            s.omdbKey,
            imdbId,
            type: arg.mediaType == 'show' ? 'series' : null,
          );
      final mdblist = await ref
          .watch(mdblistStoreProvider)
          .scores(s.mdblistKey, imdbId, type: arg.mediaType);
      return DetailRatings(omdb: omdb, mdblist: mdblist);
    });

/// The rich detail payload for a meta, ported from the `detail.tsx` build:
/// TMDB details when a key is set (falling back to the Cinemeta-shaped detail if
/// TMDB has nothing), else the keyless Cinemeta detail. Null when neither source
/// can resolve the id.
final detailProvider =
    FutureProvider.family<TmdbDetail?, ({String type, String id})>((
      ref,
      arg,
    ) async {
      final meta = MetaPreview({'id': arg.id, 'type': arg.type, 'name': ''});
      final tmdb = ref.watch(tmdbClientProvider);
      if (tmdb.hasKey) {
        final d = await fetchTmdbDetails(tmdb, meta);
        if (d != null) return d;
      }
      return fetchCinemetaDetails(ref.watch(addonClientProvider), meta);
    });

/// The lazily-resolved backdrop + film count + healed id for a Home collection
/// card: the curated id is tried first, then a name search heals a stale/unknown
/// (id `0`) entry — ported from `CollectionCard`'s resolve effect.
class CollectionCardData {
  const CollectionCardData({
    required this.resolvedId,
    this.backdrop,
    this.count,
  });
  final int resolvedId;
  final String? backdrop;
  final int? count;
}

final collectionCardProvider =
    FutureProvider.family<CollectionCardData, ({int id, String name})>((
      ref,
      arg,
    ) async {
      final client = ref.watch(tmdbClientProvider);
      var c = arg.id > 0 ? await fetchTmdbCollection(client, arg.id) : null;
      if (c == null ||
          (arg.id <= 0 && !collectionNameMatches(c.name, arg.name))) {
        final healed = await tmdbSearchCollectionId(client, arg.name);
        if (healed != null && healed != arg.id) {
          c = await fetchTmdbCollection(client, healed);
        }
      }
      if (c == null) return CollectionCardData(resolvedId: arg.id);
      return CollectionCardData(
        resolvedId: c.id,
        backdrop: c.backdrop,
        count: c.parts.length,
      );
    });

/// The enabled streaming services in canonical order — the Home "Your
/// Streaming" rail. Gated on a TMDB key (the discover rows are keyed), matching
/// the web's `enabledServices` memo.
final enabledStreamingServicesProvider = Provider<List<String>>((ref) {
  final s = ref.watch(settingsProvider);
  if (s.tmdbKey.isEmpty) return const [];
  final enabled = s.getMap('streaming');
  return [
    for (final id in kServiceOrder)
      if (enabled[id] == true) id,
  ];
});

/// The pure keyless Home builder (Cinemeta rows + hero pool). Consumed by
/// [homeContentProvider] as the no-key / TMDB-empty fallback.
final cinemetaHomeProvider = FutureProvider<CinemetaHome>(
  (ref) => fetchCinemetaHome(ref.watch(addonClientProvider)),
);

/// The Home content source, ported from the `home.tsx` build effect: classic
/// mode builds no content rows (addon rows only); otherwise a `tmdbKey` selects
/// the keyed TMDB Home, falling back to Cinemeta when TMDB yields nothing, and a
/// missing key uses Cinemeta directly.
final homeContentProvider = FutureProvider<CinemetaHome>((ref) async {
  final s = ref.watch(settingsProvider);
  if (s.getString('homeMode') == 'classic') {
    return const CinemetaHome(rows: [], hero: []);
  }
  final tmdb = ref.watch(tmdbClientProvider);
  if (tmdb.hasKey) {
    final built = await fetchTmdbHome(tmdb, region: s.region);
    if (built.rows.isNotEmpty) return built;
  }
  return fetchCinemetaHome(ref.watch(addonClientProvider));
});

/// The hero-carousel slides: the deduped hero pool (max 4) with its trending
/// rank. Cinemeta pool metas are hydrated to their full meta (background / logo
/// / runtime); TMDB pool metas already carry a backdrop, so they are used as-is
/// (their logo layers in with the TMDB images provider).
final heroSlidesProvider = FutureProvider<List<HeroSlide>>((ref) async {
  final home = await ref.watch(homeContentProvider.future);
  final client = ref.watch(addonClientProvider);
  final seen = <String>{};
  final pool = home.hero.where((m) => seen.add(m.id)).take(4).toList();
  final metas = await Future.wait(
    pool.map((m) async {
      // TMDB metas (and any pool meta that already carries a backdrop) are rich
      // enough to render; Cinemeta ids are hydrated for background/logo/runtime.
      if (m.id.startsWith('tmdb:') || m.background != null) {
        return Meta(m.json);
      }
      final r = await client.meta(cinemetaBase, m.type, m.id);
      return r.valueOrNull ?? Meta(m.json);
    }),
  );
  final slides = <HeroSlide>[];
  for (final meta in metas) {
    slides.add(
      HeroSlide(
        meta: meta,
        rankLabel: meta.type == 'series' ? 'TV' : 'Movies',
        rankPosition: slides.length + 1,
      ),
    );
  }
  return slides;
});

/// The onboarding-nudge dismissal store (`harbor.onboarding.dismissed.v1`).
final onboardingStoreProvider = Provider<OnboardingStore>(
  (ref) => OnboardingStore(ref.watch(kvStoreProvider)),
);

/// The set of dismissed onboarding-nudge keys, with a [dismiss] action. Ported
/// from the web `useOnboarding`.
class OnboardingController extends Notifier<Set<String>> {
  @override
  Set<String> build() => ref.watch(onboardingStoreProvider).dismissed();

  Future<void> dismiss(String key) async {
    await ref.read(onboardingStoreProvider).dismiss(key);
    state = ref.read(onboardingStoreProvider).dismissed();
  }
}

final onboardingDismissedProvider =
    NotifierProvider<OnboardingController, Set<String>>(
      OnboardingController.new,
    );

/// The local watchlist store (`harbor.watchlist.v1`).
final localWatchlistProvider = Provider<LocalWatchlist>(
  (ref) => LocalWatchlist(ref.watch(kvStoreProvider)),
);

/// The local continue-watching store (`harbor.localcw.v1`).
final localCwStoreProvider = Provider<LocalCwStore>(
  (ref) => LocalCwStore(ref.watch(kvStoreProvider)),
);

/// The playback-history store (`harbor.playback-history.v1`).
final playbackHistoryStoreProvider = Provider<PlaybackHistoryStore>(
  (ref) => PlaybackHistoryStore(ref.watch(kvStoreProvider)),
);

/// The per-season source-lock store (`harbor.season-lock.v1`).
final seasonLockStoreProvider = Provider<SeasonLockStore>(
  (ref) => SeasonLockStore(ref.watch(kvStoreProvider)),
);

/// The recently-played watched set, refreshed when the player records playback.
/// Feeds the Home `hideWatchedInCatalogs` filter.
class RecentlyPlayedController extends Notifier<WatchedSet> {
  @override
  WatchedSet build() => ref.read(playbackHistoryStoreProvider).recentlyPlayed();

  void refresh() =>
      state = ref.read(playbackHistoryStoreProvider).recentlyPlayed();
}

final recentlyPlayedProvider =
    NotifierProvider<RecentlyPlayedController, WatchedSet>(
      RecentlyPlayedController.new,
    );

/// The in-session set of Continue-Watching ids the viewer dismissed. An
/// advanced/resurfaced card's id is NOT in the local CW store, so clearing that
/// store can't remove it — this set does, and the advance/resurface engine
/// consults it so a dismissed card stays gone. Ports the web in-memory
/// `cw-dismiss` set (cleared on restart, like web's).
class CwDismissedController extends Notifier<Set<String>> {
  @override
  Set<String> build() => const {};

  void dismiss(String id) => state = {...state, id};
}

final cwDismissedProvider =
    NotifierProvider<CwDismissedController, Set<String>>(
      CwDismissedController.new,
    );

/// The reactive continue-watching list, with a dismiss action. Merges Stremio +
/// Simkl CW once those tracker providers land; local CW is the current source.
class ContinueWatchingController extends Notifier<List<LocalCwEntry>> {
  List<LocalCwEntry> _merged({required bool read}) {
    final store = read
        ? ref.read(localCwStoreProvider)
        : ref.watch(localCwStoreProvider);
    // Simkl in-progress sessions (external:'simkl') fold in. The aggregate keeps
    // the most-recent entry per id/name (timestamp sort, first-wins), matching
    // web `cwSortKey` — so on differing timestamps the newer wins regardless of
    // source, not "local always wins".
    final simkl =
        (read
                ? ref.read(simklPlaybackProvider)
                : ref.watch(simklPlaybackProvider))
            .value ??
        const <LocalCwEntry>[];
    // A dismissed id is suppressed here too (not just in the resurface pass), so
    // dismissing a merged Simkl card actually removes it and it does not come
    // straight back — the card isn't in the local store for `clear` to drop.
    final dismissed = read
        ? ref.read(cwDismissedProvider)
        : ref.watch(cwDismissedProvider);
    final merged = [
      for (final e in [...store.list(), ...simkl])
        if (!dismissed.contains(e.id)) e,
    ];
    return continueWatchingAggregate(merged);
  }

  List<LocalCwEntry> _current() => _merged(read: true);

  @override
  List<LocalCwEntry> build() => _merged(read: false);

  Future<void> dismiss(String id) async {
    // Clear a genuine local entry AND record the id as dismissed so a synthetic
    // advanced/resurfaced card (never in the store) is removed and does not come
    // straight back on the next engine rebuild.
    await ref.read(localCwStoreProvider).clear(id);
    ref.read(cwDismissedProvider.notifier).dismiss(id);
    state = _current();
  }

  void refresh() => state = _current();
}

final continueWatchingProvider =
    NotifierProvider<ContinueWatchingController, List<LocalCwEntry>>(
      ContinueWatchingController.new,
    );

/// The persisted detail rail layout store (`harbor.detailLayout`).
final detailCustomizationStoreProvider = Provider<DetailCustomizationStore>(
  (ref) => DetailCustomizationStore(ref.watch(kvStoreProvider)),
);

/// The per-series last-viewed season memory (`harbor.lastseason.v1`).
final lastSeasonStoreProvider = Provider<LastSeasonStore>(
  (ref) => LastSeasonStore(ref.watch(kvStoreProvider)),
);

/// The reactive detail rail layout (order + hidden), with move/hide/reset.
class DetailCustomizationController extends Notifier<DetailCustomization> {
  @override
  DetailCustomization build() =>
      ref.watch(detailCustomizationStoreProvider).load();

  DetailCustomizationStore get _store =>
      ref.read(detailCustomizationStoreProvider);

  Future<void> _persist(DetailCustomization c) async {
    await _store.save(c);
    state = c;
  }

  Future<void> move(List<String> available, String key, int delta) =>
      _persist(moveSection(state, available, key, delta));

  Future<void> toggleHidden(String key) =>
      _persist(toggleSectionHidden(state, key));

  Future<void> reset() => _persist(const DetailCustomization());
}

final detailCustomizationProvider =
    NotifierProvider<DetailCustomizationController, DetailCustomization>(
      DetailCustomizationController.new,
    );

/// The local custom-lists store (`harbor.customlists.v1`).
final customListsStoreProvider = Provider<CustomListsStore>(
  (ref) => CustomListsStore(ref.watch(kvStoreProvider)),
);

/// The reactive custom lists (most-recent-first), with create/toggle/rename/
/// delete actions that re-read the store.
class CustomListsController extends Notifier<List<CustomList>> {
  @override
  List<CustomList> build() => ref.watch(customListsStoreProvider).readLists();

  CustomListsStore get _store => ref.read(customListsStoreProvider);
  void _refresh() => state = _store.readLists();

  Future<String?> create(String name) async {
    final id = await _store.createList(name);
    _refresh();
    return id;
  }

  Future<bool> toggle(
    String listId,
    String itemId, {
    String? type,
    String? name,
    String? poster,
  }) async {
    final nowIn = await _store.toggleInList(
      listId,
      itemId,
      type: type,
      name: name,
      poster: poster,
    );
    _refresh();
    return nowIn;
  }

  Future<void> addTo(
    String listId,
    String itemId, {
    String? type,
    String? name,
    String? poster,
  }) async {
    await _store.addToList(
      listId,
      itemId,
      type: type,
      name: name,
      poster: poster,
    );
    _refresh();
  }

  Future<void> rename(String id, String name) async {
    await _store.renameList(id, name);
    _refresh();
  }

  Future<void> remove(String id) async {
    await _store.deleteList(id);
    _refresh();
  }
}

final customListsProvider =
    NotifierProvider<CustomListsController, List<CustomList>>(
      CustomListsController.new,
    );

/// The reactive set of watchlisted ids, with a toggle action.
class WatchlistController extends Notifier<Set<String>> {
  @override
  Set<String> build() =>
      ref.watch(localWatchlistProvider).list().map((e) => e.id).toSet();

  Future<void> toggle({
    required String id,
    String? type,
    String? name,
    String? poster,
  }) async {
    final added = await ref
        .read(localWatchlistProvider)
        .toggle(id: id, type: type, name: name, poster: poster);
    state = ref.read(localWatchlistProvider).list().map((e) => e.id).toSet();
    await ref
        .read(stremioWatchlistSyncProvider)
        .push(id: id, type: type, name: name, poster: poster, added: added);
    await ref.read(traktSyncProvider).pushWatchlist(metaId: id, added: added);
    await ref.read(simklSyncProvider).pushWatchlist(metaId: id, added: added);
  }
}

final watchlistProvider = NotifierProvider<WatchlistController, Set<String>>(
  WatchlistController.new,
);

/// The local Favorites store (`harbor.favorites.v1`) — the web `useMediaFavorites`
/// list. Local-only (no tracker fan-out), unlike the watchlist.
final localFavoritesProvider = Provider<LocalWatchlist>(
  (ref) => LocalWatchlist(
    ref.watch(kvStoreProvider),
    storageKey: 'harbor.favorites.v1',
  ),
);

/// The reactive set of favorited ids, with a local toggle.
class FavoritesController extends Notifier<Set<String>> {
  @override
  Set<String> build() =>
      ref.watch(localFavoritesProvider).list().map((e) => e.id).toSet();

  Future<void> toggle({
    required String id,
    String? type,
    String? name,
    String? poster,
  }) async {
    await ref
        .read(localFavoritesProvider)
        .toggle(id: id, type: type, name: name, poster: poster);
    state = ref.read(localFavoritesProvider).list().map((e) => e.id).toSet();
  }
}

final mediaFavoritesProvider =
    NotifierProvider<FavoritesController, Set<String>>(FavoritesController.new);

/// The favorited titles as metas, newest first — the Home "Favorites" row.
final favoritesMetasProvider = Provider<List<MetaPreview>>((ref) {
  ref.watch(mediaFavoritesProvider); // rebuild when the set changes
  return ref
      .read(localFavoritesProvider)
      .list()
      .map(
        (e) => MetaPreview.fromJson({
          'id': e.id,
          'type': e.type,
          'name': e.name,
          if (e.poster != null) 'poster': e.poster,
        }),
      )
      .toList();
});

/// The movie mark-watched store (`harbor.moviewatched.v1`).
final movieWatchedStoreProvider = Provider<MovieWatchedStore>(
  (ref) => MovieWatchedStore(ref.watch(kvStoreProvider)),
);

/// The reactive set of movie ids marked watched from the detail view.
class MovieWatchedController extends Notifier<Set<String>> {
  MovieWatchedStore get _store => ref.read(movieWatchedStoreProvider);

  @override
  Set<String> build() => _store.load();

  Future<void> mark(
    String metaId, {
    String? imdbId,
    int? tmdbId,
    String? name,
    String? poster,
    String? background,
  }) async {
    state = await _store.set(metaId, true);
    await ref
        .read(stremioWatchedSyncProvider)
        .pushMovie(
          metaId: metaId,
          imdbId: imdbId,
          watched: true,
          name: name,
          poster: poster,
          background: background,
        );
    await ref
        .read(traktSyncProvider)
        .pushMovieWatched(imdbId: imdbId, tmdbId: tmdbId);
    await ref
        .read(simklSyncProvider)
        .pushMovieWatched(imdbId: imdbId, tmdbId: tmdbId);
  }
}

final movieWatchedProvider =
    NotifierProvider<MovieWatchedController, Set<String>>(
      MovieWatchedController.new,
    );

/// The manual episode-watched store (`harbor.manualwatched.v1`).
final manualWatchedStoreProvider = Provider<ManualWatchedStore>(
  (ref) => ManualWatchedStore(ref.watch(kvStoreProvider)),
);

/// The reactive set of watched-episode keys, with a mark action used by the
/// player when a series episode finishes and by the season grid's check.
class ManualWatchedController extends Notifier<Set<String>> {
  ManualWatchedStore get _store => ref.read(manualWatchedStoreProvider);

  @override
  Set<String> build() => _store.loadWatched();

  Future<void> mark(String metaId, int season, int episode) async {
    state = await _store.set(metaId, season, episode, true);
  }

  /// Sets one episode's watched state (the context-menu mark/unmark actions).
  Future<void> setWatched(
    String metaId,
    int season,
    int episode,
    bool watched,
  ) async {
    state = await _store.set(metaId, season, episode, watched);
  }

  /// Marks many episodes at once — the "mark watched up to here" action.
  Future<void> markMany(
    String metaId,
    List<(int season, int episode)> episodes,
    bool watched,
  ) async {
    state = await _store.setMany(metaId, episodes, watched);
  }
}

final manualWatchedProvider =
    NotifierProvider<ManualWatchedController, Set<String>>(
      ManualWatchedController.new,
    );

/// The watchlisted titles as poster metas (most-recently-added first) for the
/// Home "My Watchlist" rail. Entries already carry name/poster, so no fetch is
/// needed — ported from the local-watchlist Home row.
final watchlistMetasProvider = Provider<List<MetaPreview>>((ref) {
  ref.watch(watchlistProvider); // rebuild when the set changes
  return ref
      .read(localWatchlistProvider)
      .list()
      .map(
        (e) => MetaPreview.fromJson({
          'id': e.id,
          'type': e.type,
          'name': e.name,
          if (e.poster != null) 'poster': e.poster,
        }),
      )
      .toList();
});

/// Whether the search overlay is open. Search is an overlay (like the web
/// `SearchProvider.open`), not a nav frame — so there is one search field, and
/// tapping outside / Escape / Back closes it. [open]/[close]/[toggle] are the
/// only entry points; the shell renders the overlay while true.
class SearchOpenController extends Notifier<bool> {
  @override
  bool build() => false;
  void open() => state = true;
  void close() => state = false;
  void toggle() => state = !state;
}

final searchOpenProvider = NotifierProvider<SearchOpenController, bool>(
  SearchOpenController.new,
);

/// The current search query (set on submit).
class SearchQueryController extends Notifier<String> {
  @override
  String build() => '';
  void set(String query) => state = query;
}

final searchQueryProvider = NotifierProvider<SearchQueryController, String>(
  SearchQueryController.new,
);

/// The reactive recent-search list (`harbor.search.recent`), newest first.
class RecentSearchesController extends Notifier<List<String>> {
  RecentSearchesStore get _store =>
      RecentSearchesStore(ref.read(kvStoreProvider));

  @override
  List<String> build() => _store.load();

  Future<void> record(String query) async => state = await _store.record(query);
  Future<void> remove(String query) async => state = await _store.remove(query);
  Future<void> clear() async => state = await _store.clear();
}

final recentSearchesProvider =
    NotifierProvider<RecentSearchesController, List<String>>(
      RecentSearchesController.new,
    );

/// The grouped search results for the current query: the keyed TMDB
/// multi-search (movies/series/people/top-match/intent) merged with Cinemeta's
/// movie + series hits, ported from the search-context assembly. Keyless, the
/// TMDB half contributes only the intent and Cinemeta fills the two lists.
final searchResultsProvider = FutureProvider<SearchResults>((ref) async {
  final query = ref.watch(searchQueryProvider);
  final (tmdb, cine) = await (
    searchTmdbMulti(ref.watch(tmdbClientProvider), query),
    searchCinemeta(ref.watch(addonClientProvider), query),
  ).wait;
  return SearchResults(
    query: tmdb.query,
    topMatch: tmdb.topMatch,
    people: tmdb.people,
    movies: mergeMetas(tmdb.movies, cine.movies),
    series: mergeMetas(tmdb.series, cine.series),
    intent: tmdb.intent,
  );
});

/// The full meta (detail page) for a (type, id) from Cinemeta.
final metaProvider = FutureProvider.family<Meta?, ({String type, String id})>((
  ref,
  key,
) async {
  final result = await ref
      .watch(addonClientProvider)
      .meta(cinemetaBase, key.type, key.id);
  return result.when(
    ok: (meta) => meta,
    err: (failure) => throw Exception(failure.message),
  );
});

/// Fetches streams from installed addons and annotates their origin.
final addonStreamFetcherProvider = Provider<AddonStreamFetcher>(
  (ref) => AddonStreamFetcher(ref.watch(jsonTransportProvider)),
);

/// The IMDb `tt…` id for a meta id (TMDB `external_ids` lookup), used to give
/// imdb-keyed stream addons a usable id for TMDB-sourced titles. Null without a
/// key or for ids that don't resolve.
final imdbIdProvider = FutureProvider.family<String?, String>(
  (ref, metaId) => tmdbImdbId(ref.watch(tmdbClientProvider), metaId),
);

/// The ordered poster-URL candidates for a card, ported from `usePosterChain`:
/// the RPDB URL (resolving the complementary imdb/tmdb id when the configured
/// host needs it) first, then the raw poster as the on-error fallback. Without
/// an RPDB key or custom poster base this is just the raw poster.
final rpdbPosterProvider = FutureProvider.autoDispose
    .family<List<String>, ({String metaId, String? rawPoster, String type})>((
      ref,
      arg,
    ) async {
      final s = ref.watch(settingsProvider);
      final key = s.rpdbKey;
      final base = s.getString('posterBaseUrl');
      final client = ref.watch(tmdbClientProvider);

      String? altId;
      if (needsImdbForPoster(key, arg.metaId, posterBase: base)) {
        altId = await tmdbImdbId(client, arg.metaId);
      } else if (needsTmdbForPoster(key, arg.metaId, posterBase: base)) {
        altId = await tmdbIdFromImdb(client, arg.metaId, type: arg.type);
      }

      final primary = rpdbPoster(
        key,
        arg.metaId,
        fallback: arg.rawPoster,
        altId: altId,
        posterBase: base,
      );
      final out = <String>[];
      final seen = <String>{};
      for (final u in [primary, arg.rawPoster]) {
        if (u != null && u.isNotEmpty && seen.add(u)) out.add(u);
      }
      return out;
    });

/// A play-picker request: a content (type, id) and, for series, the episode.
typedef PickerKey = ({String type, String id, int? season, int? episode});

/// The ranked play-picker for a title: fetch → parse → cache-check across the
/// configured debrids → score → rank across all installed stream addons. With no
/// debrid keys the cache-check step is skipped and scoring runs the "no debrid"
/// path.
final streamPickerProvider = FutureProvider.family<RankedPicker, PickerKey>((
  ref,
  key,
) async {
  final addons = ref.watch(activeAddonsProvider);
  final fetcher = ref.watch(addonStreamFetcherProvider);
  final debrids = ref.watch(debridClientsProvider);
  StreamEpisode? episode;
  if (key.season != null && key.episode != null) {
    if (isAnimeId(key.id)) {
      // For anime, carry the episode's stream id and imdb mapping from the
      // assembled detail so imdb-only addons and the kitsu addon both resolve
      // it — the base `kitsu:<id>:<ep>` alone only reaches anime-aware addons.
      final eps = await ref.watch(
        animeEnrichedEpisodesProvider((type: key.type, id: key.id)).future,
      );
      KitsuEpisode? match;
      for (final ep in eps) {
        if (ep.number == key.episode) {
          match = ep;
          break;
        }
      }
      episode = StreamEpisode(
        season: key.season!,
        episode: key.episode!,
        kitsuStreamId: match?.streamId,
        imdbId: match?.imdbId,
        imdbSeason: match?.imdbSeason,
        imdbEpisode: match?.imdbEpisode,
      );
    } else {
      episode = StreamEpisode(season: key.season!, episode: key.episode!);
    }
  }
  // Resolve the imdb id (passing through `tt…`, looking up `tmdb:*`) so
  // imdb-keyed addons get a usable id for TMDB-sourced titles.
  final imdbId = await ref.watch(imdbIdProvider(key.id).future);
  final ids = buildStreamIds(key.id, episode: episode, imdbId: imdbId);
  final items = await fetcher.fetch(
    addons,
    StreamRequest(type: key.type, ids: ids),
  );
  final parsed = items.map(parseStream).toList();

  await _applyDebridCache(parsed, debrids);

  // debridClientsProvider already watches settings, so this provider re-ranks
  // on any settings change; read the fields we score/sort by from it.
  final settings = ref.watch(settingsProvider);
  final opts = ScoreOptions(
    mediaKind: key.type == 'series' ? MediaKind.series : MediaKind.movie,
    activeDebrids: debridSlugs(debrids),
    preferredLanguages: settings.getStringList('preferredLanguages'),
  );
  final now = DateTime.now();
  final corpus = computeCorpusStats(parsed, opts, now);
  final scored = parsed
      .map((p) => scoreStream(p, opts, corpus: corpus, now: now))
      .toList();
  // streamSort: "addon" respects each addon's own priority/return order (the
  // default); any other value sorts purely by score.
  final respectAddonOrder = settings.getString('streamSort') == 'addon';
  return rankAndPick(
    scored,
    opts.activeDebrids,
    respectAddonOrder: respectAddonOrder,
  );
});

/// Cache-checks every stream's info-hash against each configured debrid and
/// marks the parsed streams cached where the debrid reports availability.
Future<void> _applyDebridCache(
  List<ParsedStream> parsed,
  List<DebridStore> debrids,
) async {
  if (debrids.isEmpty) return;
  final hashes = parsed
      .map((p) => p.infoHash)
      .whereType<String>()
      .map((h) => h.toLowerCase())
      .toSet()
      .toList();
  if (hashes.isEmpty) return;
  final signal = AbortSignal();
  // Check every configured debrid concurrently — a sequential await per debrid
  // stacks their round-trips onto the pre-play wait, delaying instant play.
  final results = await Future.wait(
    debrids.map((d) => d.cacheCheck(hashes, signal)),
  );
  for (final (i, r) in results.indexed) {
    if (r is! DebridOk<CacheMap>) continue;
    final cachedMap = r.data;
    final slug = debrids[i].slug;
    for (final p in parsed) {
      final h = p.infoHash?.toLowerCase();
      if (h != null && cachedMap[h] == true) p.cached[slug] = true;
    }
  }
}

/// Resolves a picked stream to a playable link (direct / debrid / P2P).
final resolveStreamProvider = FutureProvider.autoDispose
    .family<ResolveResult, ({ParsedStream stream, bool committed})>((
      ref,
      arg,
    ) async {
      final debrids = ref.watch(debridClientsProvider);
      final prober = ref.watch(linkProberProvider);
      return resolveStream(
        arg.stream,
        debrids,
        AbortSignal(),
        userCommitted: arg.committed,
        prober: prober,
      );
    });
