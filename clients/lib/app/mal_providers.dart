import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/anime/anime_mapping.dart';
import '../domain/mal/mal_auth.dart';
import '../domain/mal/mal_client.dart';
import '../domain/mal/mal_profile.dart';
import '../domain/mal/mal_rails.dart';
import '../domain/mal/mal_session_store.dart';
import '../domain/mal/mal_sync.dart';
import '../domain/mal/mal_types.dart';
import '../domain/mal/mal_watched.dart';
import 'anime_providers.dart';
import 'profiles_providers.dart';
import 'providers.dart';
import 'sync_events.dart';

/// The per-profile MyAnimeList session store (tokens in the keychain).
final malSessionStoreProvider = Provider<MalSessionStore>((ref) {
  return MalSessionStore(
    ref.watch(secureStoreProvider),
    ref.watch(kvStoreProvider),
    profileId: ref.watch(profilesRepoProvider).activeProfileId(),
  );
});

/// The MyAnimeList PKCE authorization flow — exchange a pasted code for a
/// session and refresh an expiring token.
final malAuthProvider = Provider<MalAuth>(
  (ref) => MalAuth(
    transport: ref.watch(jsonTransportProvider),
    store: ref.watch(malSessionStoreProvider),
  ),
);

/// The bearer-authenticated MyAnimeList REST client.
/// A live MAL access token (hydrated + refreshed when expired), null when the
/// account isn't connected. Mirrors `MalAnimeSync._token`.
final malAccessTokenProvider = FutureProvider<String?>((ref) async {
  final store = ref.watch(malSessionStoreProvider);
  await store.ensureHydrated();
  var session = store.read();
  if (session == null) return null;
  if (session.expiresAt <= DateTime.now().millisecondsSinceEpoch) {
    session = await ref.read(malAuthProvider).refreshAccessToken();
  }
  return session?.accessToken;
});

/// The user's MAL anime list grouped into the Anime-tab rails (Watching / Plan /
/// Completed / On Hold / Dropped); empty when not connected. Ports
/// `useMalAnimeRails`.
final malAnimeRailsProvider = FutureProvider<List<MalRail>>((ref) async {
  final token = await ref.watch(malAccessTokenProvider.future);
  if (token == null || token.isEmpty) return const [];
  final entries = await fetchMalAnimeList(ref.watch(malClientProvider), token);
  return buildMalAnimeRails(entries);
});

final malClientProvider = Provider<MalClient>(
  (ref) => MalClient(ref.watch(jsonTransportProvider)),
);

/// The authenticated user's MyAnimeList list entry (status + watched count) for
/// a title — the MAL watched-state source for the anime episode rows, alongside
/// AniList. Null when not connected or the title has no MAL match. An expired
/// access token is refreshed before the read (the web's 401-refresh, proactive).
final malWatchedEntryProvider = FutureProvider.family<MalEntry?, String>((
  ref,
  harborId,
) async {
  if (harborId.isEmpty) return null;
  final store = ref.watch(malSessionStoreProvider);
  await store.ensureHydrated();
  var session = store.read();
  if (session == null) return null;
  if (session.expiresAt <= DateTime.now().millisecondsSinceEpoch) {
    session = await ref.read(malAuthProvider).refreshAccessToken();
    if (session == null) return null;
  }
  final client = ref.watch(malClientProvider);
  final mapper = ref.watch(animeMapperProvider);
  try {
    final malId = await resolveMalMediaId(mapper, harborId);
    if (malId == null) return null;
    final info = await fetchMalListEntry(client, session.accessToken, malId);
    return info?.entry;
  } catch (_) {
    return null;
  }
});

/// Pushes anime watch state to MyAnimeList during playback — the write half of
/// [malWatchedEntryProvider]. The player calls it fire-and-forget when
/// `malAutoSync` is on: [markWatching] once a title is under way, and
/// [syncProgress] once an episode is finished. Ported from `mal/sync.ts`.
class MalAnimeSync {
  MalAnimeSync({
    required this.store,
    required this.auth,
    required this.client,
    required this.mapper,
    this.emit,
  });

  final MalSessionStore store;
  final MalAuth auth;
  final MalClient client;
  final AnimeMapper mapper;

  /// Surfaces a sync event to the player toast.
  final void Function(SyncEvent)? emit;

  /// A live access token (hydrated, refreshed when expired), or null when the
  /// account is not connected.
  Future<String?> _token() async {
    await store.ensureHydrated();
    var session = store.read();
    if (session == null) return null;
    if (session.expiresAt <= DateTime.now().millisecondsSinceEpoch) {
      session = await auth.refreshAccessToken();
    }
    return session?.accessToken;
  }

  Future<void> markWatching(String harborId, String title) async {
    try {
      final token = await _token();
      if (token == null) return;
      final malId = await resolveMalMediaId(mapper, harborId);
      if (malId == null) return;
      final marked = await markMalWatching(
        client: client,
        accessToken: token,
        malId: malId,
      );
      if (marked) {
        emit?.call(
          SyncEvent(
            tracker: SyncTracker.mal,
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
      final malId = await resolveMalMediaId(mapper, harborId);
      if (malId == null) return;
      final outcome = await syncMalProgress(
        client: client,
        accessToken: token,
        malId: malId,
        episode: episode,
        onStart: () => emit?.call(
          SyncEvent(
            tracker: SyncTracker.mal,
            kind: SyncKind.syncing,
            title: title,
            episode: episode,
          ),
        ),
      );
      final kind = switch (outcome) {
        MalSyncOutcome.synced => SyncKind.synced,
        MalSyncOutcome.failed => SyncKind.error,
        MalSyncOutcome.upToDate => null,
      };
      if (kind != null) {
        emit?.call(
          SyncEvent(
            tracker: SyncTracker.mal,
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

final malAnimeSyncProvider = Provider<MalAnimeSync>(
  (ref) => MalAnimeSync(
    store: ref.watch(malSessionStoreProvider),
    auth: ref.watch(malAuthProvider),
    client: ref.watch(malClientProvider),
    mapper: ref.watch(animeMapperProvider),
    emit: (e) => ref.read(syncEventsProvider.notifier).emit(e),
  ),
);

/// The MyAnimeList settings connect flow state.
sealed class MalConnectState {
  const MalConnectState();
}

/// Not connected — offer the connect button.
class MalConnectIdle extends MalConnectState {
  const MalConnectIdle();
}

/// The authorize page was opened; awaiting the pasted code.
class MalConnectAwaitingCode extends MalConnectState {
  const MalConnectAwaitingCode();
}

/// Exchanging the pasted code.
class MalConnectSubmitting extends MalConnectState {
  const MalConnectSubmitting();
}

/// The exchange failed; [message] is user-facing.
class MalConnectError extends MalConnectState {
  const MalConnectError(this.message);
  final String message;
}

/// Connected as [session].
class MalConnectDone extends MalConnectState {
  const MalConnectDone(this.session);
  final MalSession session;
}

/// Drives the MyAnimeList settings connect UI: hydrate the stored session,
/// reveal the paste field, exchange the code, and disconnect.
class MalConnectController extends Notifier<MalConnectState> {
  @override
  MalConnectState build() {
    final store = ref.watch(malSessionStoreProvider);
    _hydrate(store);
    return const MalConnectIdle();
  }

  Future<void> _hydrate(MalSessionStore store) async {
    await store.ensureHydrated();
    final s = store.read();
    if (s != null && state is MalConnectIdle) {
      state = MalConnectDone(s);
    }
  }

  /// The authorize URL to open in a browser.
  String authorizeUrl() => ref.read(malAuthProvider).buildAuthorizeUrl();

  /// Reveals the paste field after the authorize page has been opened.
  void awaitCode() => state = const MalConnectAwaitingCode();

  /// Exchanges [pastedCode] for a session.
  Future<void> submitCode(String pastedCode) async {
    state = const MalConnectSubmitting();
    try {
      final session = await ref
          .read(malAuthProvider)
          .completeAuthorization(pastedCode);
      state = MalConnectDone(session);
    } on MalAuthException catch (e) {
      state = MalConnectError(e.message);
    } catch (_) {
      state = const MalConnectError(
        'Could not connect to MyAnimeList. Try again.',
      );
    }
  }

  /// Returns to the idle (offer-connect) state.
  void cancel() => state = const MalConnectIdle();

  Future<void> disconnect() async {
    await ref.read(malAuthProvider).signOut();
    state = const MalConnectIdle();
  }
}

final malConnectProvider =
    NotifierProvider<MalConnectController, MalConnectState>(
      MalConnectController.new,
    );

/// The connected MyAnimeList user's profile picture (`/users/@me`), or null.
/// Web `fetchMalAvatar`. Backs the "Use MyAnimeList avatar" setting.
final malAvatarProvider = FutureProvider<String?>((ref) async {
  final state = ref.watch(malConnectProvider);
  if (state is! MalConnectDone) return null;
  return fetchMalAvatar(
    ref.watch(malClientProvider),
    state.session.accessToken,
  );
});

/// The inputs of the MAL avatar-mirror effect, bundled so a listener refires on
/// the flag, the MAL avatar, or a profile SWITCH. Keyed on the active profile's
/// id, NOT its avatar — see [AnilistAvatarSync]: two avatar effects keyed on the
/// avatar would ping-pong when both are on. The listener reads the fresh profile
/// avatar for its no-op guard.
typedef MalAvatarSync = ({bool on, String? avatar, String? activeId});
final malAvatarSyncProvider = Provider<MalAvatarSync>(
  (ref) => (
    on: ref.watch(settingsProvider).getBool('useMalAvatar'),
    avatar: ref.watch(malAvatarProvider).asData?.value,
    activeId: ref.watch(activeProfileProvider)?.id,
  ),
);
