import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/addons/models.dart';
import '../domain/anilist/anilist_auth.dart';
import '../domain/anilist/anilist_client.dart';
import '../domain/anilist/anilist_relations.dart';
import '../domain/anilist/anilist_session_store.dart';
import '../domain/anilist/anilist_sync.dart';
import '../domain/anilist/anilist_types.dart';
import '../domain/anilist/anilist_threads.dart';
import '../domain/anilist/anilist_watched.dart';
import '../domain/anime/anime_detail.dart';
import '../domain/anime/anime_franchise.dart';
import '../domain/anime/anime_mapping.dart';
import '../domain/anime/kitsu_client.dart';
import 'sync_events.dart';
import '../domain/catalog/tmdb_details.dart';
import 'anime_providers.dart';
import 'profiles_providers.dart';
import 'providers.dart';

/// The AniList GraphQL client — the shared HTTP layer behind AniList franchise
/// relations and the AniList tracker.
final anilistClientProvider = Provider<AnilistClient>(
  (ref) => AnilistClient(ref.watch(jsonTransportProvider)),
);

/// The per-profile AniList session store (access token in the keychain).
final anilistSessionStoreProvider = Provider<AnilistSessionStore>((ref) {
  return AnilistSessionStore(
    ref.watch(secureStoreProvider),
    ref.watch(kvStoreProvider),
    profileId: ref.watch(profilesRepoProvider).activeProfileId(),
  );
});

/// The AniList PIN authorization flow — exchange a pasted code for a session.
final anilistAuthProvider = Provider<AnilistAuth>(
  (ref) => AnilistAuth(
    transport: ref.watch(jsonTransportProvider),
    client: ref.watch(anilistClientProvider),
    store: ref.watch(anilistSessionStoreProvider),
  ),
);

/// The AniList settings connect flow state.
sealed class AnilistConnectState {
  const AnilistConnectState();
}

/// Not connected — offer the connect button.
class AnilistConnectIdle extends AnilistConnectState {
  const AnilistConnectIdle();
}

/// The authorize page was opened; awaiting the pasted code.
class AnilistConnectAwaitingCode extends AnilistConnectState {
  const AnilistConnectAwaitingCode();
}

/// Exchanging the pasted code.
class AnilistConnectSubmitting extends AnilistConnectState {
  const AnilistConnectSubmitting();
}

/// The exchange failed; [message] is user-facing.
class AnilistConnectError extends AnilistConnectState {
  const AnilistConnectError(this.message);
  final String message;
}

/// Connected as [session].
class AnilistConnectDone extends AnilistConnectState {
  const AnilistConnectDone(this.session);
  final AnilistSession session;
}

/// Drives the AniList settings connect UI: hydrate the stored session, reveal
/// the paste field, exchange the code, and disconnect. Ported from the AniList
/// settings connect behaviour.
class AnilistConnectController extends Notifier<AnilistConnectState> {
  @override
  AnilistConnectState build() {
    final store = ref.watch(anilistSessionStoreProvider);
    _hydrate(store);
    return const AnilistConnectIdle();
  }

  Future<void> _hydrate(AnilistSessionStore store) async {
    await store.ensureHydrated();
    final s = store.read();
    if (s != null && state is AnilistConnectIdle) {
      state = AnilistConnectDone(s);
    }
  }

  /// The authorize URL to open in a browser.
  String authorizeUrl() => ref.read(anilistAuthProvider).buildAuthorizeUrl();

  /// Reveals the paste field after the authorize page has been opened.
  void awaitCode() => state = const AnilistConnectAwaitingCode();

  /// Exchanges [pastedCode] for a session.
  Future<void> submitCode(String pastedCode) async {
    state = const AnilistConnectSubmitting();
    try {
      final session = await ref
          .read(anilistAuthProvider)
          .completeAuthorization(pastedCode);
      state = AnilistConnectDone(session);
    } on AnilistAuthException catch (e) {
      state = AnilistConnectError(e.message);
    } catch (_) {
      state = const AnilistConnectError(
        'Could not connect to AniList. Try again.',
      );
    }
  }

  /// Returns to the idle (offer-connect) state.
  void cancel() => state = const AnilistConnectIdle();

  Future<void> disconnect() async {
    await ref.read(anilistAuthProvider).signOut();
    state = const AnilistConnectIdle();
  }
}

final anilistConnectProvider =
    NotifierProvider<AnilistConnectController, AnilistConnectState>(
      AnilistConnectController.new,
    );

/// The connected AniList user's avatar (from the session), or null. Web
/// `useAnilist().avatar`. Backs the "Use my AniList avatar" setting.
final anilistAvatarProvider = Provider<String?>((ref) {
  final state = ref.watch(anilistConnectProvider);
  return state is AnilistConnectDone ? state.session.avatar : null;
});

/// The detail-page AniList list-entry state for [harborId]: the resolved AniList
/// media id, the user's current list status (null when unset), and the entry id
/// (needed to remove it). All null when AniList isn't connected or the title
/// can't be resolved — which self-hides the AddToAnilistButton. Ports the web
/// button's resolve + fetchListEntry effect.
final anilistListEntryProvider =
    FutureProvider.family<
      ({int? mediaId, String? status, int? entryId}),
      String
    >((ref, harborId) async {
      const empty = (mediaId: null, status: null, entryId: null);
      if (ref.watch(anilistConnectProvider) is! AnilistConnectDone) {
        return empty;
      }
      final token = ref.watch(anilistSessionStoreProvider).read()?.accessToken;
      if (token == null || token.isEmpty) return empty;
      final client = ref.watch(anilistClientProvider);
      final mediaId = await resolveAnilistMediaId(
        ref.watch(animeMapperProvider),
        client,
        harborId,
      );
      if (mediaId == null) return empty;
      try {
        final info = await fetchAnilistListEntry(client, token, mediaId);
        return (
          mediaId: mediaId,
          status: info?.entry?.status,
          entryId: info?.entry?.id,
        );
      } catch (_) {
        return (mediaId: mediaId, status: null, entryId: null);
      }
    });

/// The inputs of the AniList avatar-mirror effect, bundled so a listener refires
/// on the flag, the AniList avatar, or a profile SWITCH. It deliberately keys on
/// the active profile's id, NOT its avatar: keying on the avatar would refire
/// whenever *another* avatar effect (e.g. MalAvatarSync) rewrites the current
/// profile, and the two would ping-pong forever. The listener reads the fresh
/// profile avatar for its no-op guard.
typedef AnilistAvatarSync = ({bool on, String? avatar, String? activeId});
final anilistAvatarSyncProvider = Provider<AnilistAvatarSync>(
  (ref) => (
    on: ref.watch(settingsProvider).getBool('useAnilistAvatar'),
    avatar: ref.watch(anilistAvatarProvider),
    activeId: ref.watch(activeProfileProvider)?.id,
  ),
);

/// The forum threads for a detail title — resolves the harbor id to an AniList
/// media id, then fetches the first page. A null [mediaId] means the title has
/// no AniList match (the section self-hides). Backs the `showAnilistComments`
/// detail section.
typedef AnilistThreadsResult = ({
  int? mediaId,
  List<AnilistThread> threads,
  bool hasNextPage,
});

final anilistThreadsProvider =
    FutureProvider.family<AnilistThreadsResult, String>((ref, harborId) async {
      final mapper = ref.watch(animeMapperProvider);
      final client = ref.watch(anilistClientProvider);
      final mediaId = await resolveAnilistMediaId(mapper, client, harborId);
      if (mediaId == null) {
        return (
          mediaId: null,
          threads: const <AnilistThread>[],
          hasNextPage: false,
        );
      }
      final token = ref.watch(anilistSessionStoreProvider).read()?.accessToken;
      try {
        final page = await fetchAnilistThreads(
          client,
          mediaId,
          accessToken: token,
        );
        return (
          mediaId: mediaId,
          threads: page.threads,
          hasNextPage: page.hasNextPage,
        );
      } on AnilistApiError {
        return (
          mediaId: mediaId,
          threads: const <AnilistThread>[],
          hasNextPage: false,
        );
      }
    });

/// The comments inside a single AniList thread (lazily, when a thread is
/// opened).
final anilistThreadCommentsProvider =
    FutureProvider.family<List<AnilistThreadComment>, int>((
      ref,
      threadId,
    ) async {
      final client = ref.watch(anilistClientProvider);
      final token = ref.watch(anilistSessionStoreProvider).read()?.accessToken;
      try {
        return await fetchAnilistThreadComments(
          client,
          threadId,
          accessToken: token,
        );
      } on AnilistApiError {
        return const [];
      }
    });

/// The authenticated user's AniList list entry (status + progress) for a title —
/// the watched-state source for the anime episode rows. Null when not connected
/// or the title has no AniList match.
final anilistWatchedEntryProvider =
    FutureProvider.family<AnilistEntry?, String>((ref, harborId) async {
      if (harborId.isEmpty) return null;
      final store = ref.watch(anilistSessionStoreProvider);
      await store.ensureHydrated();
      final session = store.read();
      if (session == null) return null;
      final client = ref.watch(anilistClientProvider);
      final mapper = ref.watch(animeMapperProvider);
      try {
        final mediaId = await resolveAnilistMediaId(mapper, client, harborId);
        if (mediaId == null) return null;
        final info = await fetchAnilistListEntry(
          client,
          session.accessToken,
          mediaId,
        );
        return info?.entry;
      } catch (_) {
        return null;
      }
    });

/// Pushes anime watch state to AniList during playback — the write half of
/// [anilistWatchedEntryProvider]. The player calls it fire-and-forget when
/// `anilistAutoSync` is on: [markWatching] once a title is under way, and
/// [syncProgress] once an episode is finished. Ported from `anilist/sync.ts`.
/// AniList access tokens are long-lived, so no refresh is needed.
class AnilistAnimeSync {
  AnilistAnimeSync({
    required this.store,
    required this.client,
    required this.mapper,
    this.emit,
  });

  final AnilistSessionStore store;
  final AnilistClient client;
  final AnimeMapper mapper;

  /// Surfaces a sync event to the player toast.
  final void Function(SyncEvent)? emit;

  Future<String?> _token() async {
    await store.ensureHydrated();
    return store.read()?.accessToken;
  }

  Future<void> markWatching(String harborId, String title) async {
    try {
      final token = await _token();
      if (token == null) return;
      final mediaId = await resolveAnilistMediaId(mapper, client, harborId);
      if (mediaId == null) return;
      final marked = await markAnilistWatching(
        client: client,
        accessToken: token,
        mediaId: mediaId,
      );
      if (marked) {
        emit?.call(
          SyncEvent(
            tracker: SyncTracker.anilist,
            kind: SyncKind.watching,
            title: title,
          ),
        );
      }
    } catch (_) {
      // A sync failure is silent — playback is unaffected.
    }
  }

  Future<void> syncProgress({
    required String harborId,
    required int episode,
    required String title,
  }) async {
    try {
      final token = await _token();
      if (token == null) return;
      final mediaId = await resolveAnilistMediaId(mapper, client, harborId);
      if (mediaId == null) return;
      final outcome = await syncAnilistProgress(
        client: client,
        accessToken: token,
        mediaId: mediaId,
        episode: episode,
        onStart: () => emit?.call(
          SyncEvent(
            tracker: SyncTracker.anilist,
            kind: SyncKind.syncing,
            title: title,
            episode: episode,
          ),
        ),
      );
      final kind = switch (outcome) {
        AnilistSyncOutcome.synced => SyncKind.synced,
        AnilistSyncOutcome.failed => SyncKind.error,
        AnilistSyncOutcome.upToDate => null,
      };
      if (kind != null) {
        emit?.call(
          SyncEvent(
            tracker: SyncTracker.anilist,
            kind: kind,
            title: title,
            episode: episode,
          ),
        );
      }
    } catch (_) {
      // A sync failure is silent — playback is unaffected.
    }
  }
}

final anilistAnimeSyncProvider = Provider<AnilistAnimeSync>(
  (ref) => AnilistAnimeSync(
    store: ref.watch(anilistSessionStoreProvider),
    client: ref.watch(anilistClientProvider),
    mapper: ref.watch(animeMapperProvider),
    emit: (e) => ref.read(syncEventsProvider.notifier).emit(e),
  ),
);

/// The AniList franchise relation walker — assembles an anime's sequels,
/// prequels, parents and side stories for the detail page's franchise strip.
final anilistRelationsProvider = Provider<AnilistRelations>(
  (ref) => AnilistRelations(
    ref.watch(anilistClientProvider),
    ref.watch(animeMapperProvider),
  ),
);

/// The anime franchise builder — merges Kitsu related-media relations with
/// AniList franchise relations into an ordered franchise for the detail page.
final animeFranchiseBuilderProvider = Provider<AnimeFranchiseBuilder>(
  (ref) => AnimeFranchiseBuilder(
    ref.watch(kitsuClientProvider),
    ref.watch(anilistRelationsProvider),
  ),
);

/// The anime detail service — assembles the full anime detail (TMDB-shaped
/// payload, episodes, streamers, franchise, enrichment and TMDB extras) for a
/// Kitsu/MAL/AniList/AniDB meta.
final animeDetailServiceProvider = Provider<AnimeDetailService>(
  (ref) => AnimeDetailService(
    kitsu: ref.watch(kitsuClientProvider),
    addon: ref.watch(animeKitsuAddonClientProvider),
    mapper: ref.watch(animeMapperProvider),
    franchise: ref.watch(animeFranchiseBuilderProvider),
    enricher: ref.watch(animeEpisodeEnricherProvider),
    fanart: ref.watch(fanartClientProvider),
    tmdb: ref.watch(tmdbClientProvider),
    transport: ref.watch(jsonTransportProvider),
  ),
);

/// The assembled anime detail for a Kitsu/MAL/AniList/AniDB meta — the detail
/// page's data source for anime, read by the detail view when [isAnimeId].
final animeDetailProvider =
    FutureProvider.family<AnimeDetailResult?, ({String type, String id})>((
      ref,
      arg,
    ) {
      final settings = ref.watch(settingsProvider);
      return ref
          .watch(animeDetailServiceProvider)
          .details(
            MetaPreview({'id': arg.id, 'type': arg.type, 'name': ''}),
            tvdbKey: settings.getString('tvdbKey'),
            fanartKey: settings.getString('fanartKey'),
          );
    });

/// The anime detail with its deferred TMDB/fanart extras applied — the logo,
/// wide artwork and richer crew/cast that arrive after the initial Kitsu
/// payload. Resolves after [animeDetailProvider], so the detail view can show
/// the base detail first and swap this in when the extras land.
final animeMergedDetailProvider =
    FutureProvider.family<TmdbDetail?, ({String type, String id})>((
      ref,
      arg,
    ) async {
      final result = await ref.watch(animeDetailProvider(arg).future);
      if (result == null) return null;
      final extras = await result.extras;
      return applyAnimeExtras(result.detail, extras);
    });

/// The resolved anime franchise (seasons, movies and side stories) for a meta —
/// the detail page's season picker source. Empty when the meta is not an
/// assembled anime.
final animeFranchiseProvider =
    FutureProvider.family<List<FranchiseEntry>, ({String type, String id})>((
      ref,
      arg,
    ) async {
      final result = await ref.watch(animeDetailProvider(arg).future);
      if (result == null) return const [];
      return result.franchise;
    });

/// The enriched anime episodes for a meta — the episode list on the detail page,
/// with filler flags, IMDb ratings and thumbnails resolved. Empty when the meta
/// is not an assembled anime.
final animeEnrichedEpisodesProvider =
    FutureProvider.family<List<KitsuEpisode>, ({String type, String id})>((
      ref,
      arg,
    ) async {
      final result = await ref.watch(animeDetailProvider(arg).future);
      if (result == null) return const [];
      return result.enriched;
    });

/// Parses a leading four-digit year (>1900), else 0. Ported from `parseYear`.
int parseDetailYear(String? v) {
  if (v == null) return 0;
  final head = v.length >= 4 ? v.substring(0, 4) : v;
  final n = int.tryParse(head);
  return (n != null && n > 1900) ? n : 0;
}

/// Resolves a non-anime `tt…`/`tmdb:tv:` title to its Kitsu id when it is really
/// a Japanese anime: map the id, then sanity-check the year so a wrong match is
/// rejected. Null when the id is already an anime scheme, has no mapping, has no
/// year yet (re-resolves once the year loads), or the years are more than three
/// apart. Ported from the `detectedKitsu` resolution in the detail view.
final detectedAnimeKitsuIdProvider =
    FutureProvider.family<int?, ({String id, String? imdbId, String? year})>((
      ref,
      arg,
    ) async {
      if (isAnimeId(arg.id)) return null;
      final mapper = ref.watch(animeMapperProvider);
      int? k;
      if (arg.id.startsWith('tmdb:tv:')) {
        final tmdbId = int.tryParse(arg.id.substring(8));
        if (tmdbId != null) k = await _guard(mapper.tmdbTvToKitsu(tmdbId));
      }
      if (k == null) {
        final imdb = arg.id.startsWith('tt')
            ? arg.id
            : (arg.imdbId != null && arg.imdbId!.startsWith('tt')
                  ? arg.imdbId
                  : null);
        if (imdb != null) k = await _guard(mapper.imdbToKitsu(imdb));
      }
      if (k == null) return null;

      // Year verdict: without a show year, wait (re-resolves via the key); with
      // one, accept unless the Kitsu year is more than three years off.
      final showYear = parseDetailYear(arg.year);
      if (showYear == 0) return null;
      final ka = await _guard(ref.watch(kitsuClientProvider).kitsuAnime(k));
      final animeYear = parseDetailYear(ka?.year);
      if (animeYear == 0) return k;
      return (animeYear - showYear).abs() <= 3 ? k : null;
    });

Future<T?> _guard<T>(Future<T?> f) async {
  try {
    return await f;
  } catch (_) {
    return null;
  }
}
