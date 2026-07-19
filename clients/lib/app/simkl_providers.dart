import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/calendar/calendar.dart';
import '../domain/calendar/calendar_library.dart';
import '../domain/calendar/calendar_simkl.dart';
import '../domain/catalog/catalog_row.dart';
import '../domain/library/local_cw.dart';
import '../domain/simkl/simkl_client.dart';
import '../domain/simkl/simkl_device_auth.dart';
import '../domain/simkl/simkl_home_rows.dart';
import '../domain/simkl/simkl_ids.dart';
import '../domain/simkl/simkl_session_store.dart';
import '../domain/simkl/simkl_types.dart';
import 'profiles_providers.dart';
import 'providers.dart';

/// In-progress Simkl playback sessions as external Continue-Watching entries
/// (`external: 'simkl'`), merged into the Home CW shelf so a title you're
/// mid-way through on Simkl surfaces here. Empty when Simkl is disconnected or
/// the fetch fails. Ports the web `simklCw` state fed by `fetchSimklPlaybackItems`.
final simklPlaybackProvider = FutureProvider<List<LocalCwEntry>>((ref) async {
  if (!ref.watch(simklConnectedProvider)) return const [];
  final items = await ref.watch(simklClientProvider).fetchPlaybackItems();
  // Seed the local resume store from the Simkl offset (web
  // `fetchSimklPlaybackItems` side effect) — without this a Simkl-only title
  // plays from 0 since the player reads position only from the resume store.
  // Guarded so a newer local resume is never clobbered.
  final resume = ref.read(resumeStoreProvider);
  for (final e in items) {
    if (resume.readResumeMs(e.id, e.season, e.episode) <= 0) {
      await resume.saveResumeMs(e.id, e.positionMs, e.season, e.episode);
    }
  }
  return items;
});

/// The Simkl session store for the active profile (keychain-backed).
final simklSessionStoreProvider = Provider<SimklSessionStore>((ref) {
  final profileId = ref.watch(profilesRepoProvider).activeProfileId();
  return SimklSessionStore(
    ref.watch(secureStoreProvider),
    ref.watch(kvStoreProvider),
    profileId: profileId,
  );
});

/// Completes once the keychain session has been read into the store's cache, so
/// the synchronous session reads reflect the stored session.
final simklSessionReadyProvider = FutureProvider<void>(
  (ref) => ref.watch(simklSessionStoreProvider).ensureHydrated(),
);

/// The Simkl API client.
final simklClientProvider = Provider<SimklClient>(
  (ref) => SimklClient(
    ref.watch(jsonTransportProvider),
    ref.watch(simklSessionStoreProvider),
  ),
);

/// Whether Simkl is connected for the active profile.
final simklConnectedProvider = Provider<bool>((ref) {
  ref.watch(simklSessionReadyProvider);
  return ref.watch(simklSessionStoreProvider).isAuthenticated();
});

/// The Simkl username for the connected account, or null.
final simklUsernameProvider = Provider<String?>((ref) {
  ref.watch(simklSessionReadyProvider);
  return ref.watch(simklSessionStoreProvider).read()?.username;
});

/// The detail-page Simkl list state for a title ([type] + harbor [id]): the
/// resolved Simkl target, whether it is a movie (drives the status order), and
/// the user's current list status (null when unset). All null when Simkl isn't
/// connected or the id can't be resolved — which self-hides the SimklAddButton.
/// Ports the web button's resolveSimklTarget + loadSimklStatusMap effect. A bare
/// `tt` id defaults to a movie target, so a series detail corrects it to a show.
final simklListEntryProvider =
    FutureProvider.family<
      ({SimklTarget? target, bool movie, String? status}),
      ({String type, String id})
    >((ref, key) async {
      const empty = (target: null, movie: false, status: null);
      if (!ref.watch(simklConnectedProvider)) return empty;
      var target = stremioIdToSimklTarget(key.id).target;
      if (target == null) return empty;
      if (target is SimklMovieTarget && key.type == 'series') {
        target = SimklShowTarget(target.ids);
      }
      final movie = target is SimklMovieTarget;
      final map = await ref.watch(simklClientProvider).fetchListStatusMap();
      var status = map[key.id];
      if (status == null) {
        final mal = simklTargetIds(target).mal;
        if (mal != null) status = map['mal:$mal'];
      }
      return (target: target, movie: movie, status: status);
    });

/// The Simkl Home rails (watching TV, plan-to-watch movies/shows) — the Simkl
/// slice of the Home body. Empty when Simkl is not connected or the master
/// `simklHomeRailsEnabled` is off; rebuilds when the connection, that toggle,
/// the granular filters, or the TMDB key change (the web home effect deps).
final simklHomeRowsProvider = FutureProvider<List<CatalogRow>>((ref) async {
  if (!ref.watch(simklConnectedProvider)) return const [];
  // Depend only on the fields that shape the rails (like the web effect deps) so
  // an unrelated setting edit never re-hits the Simkl API. A stable signature
  // over `simklHomeRailsEnabled`, the TMDB key, and the granular filters.
  final (enabled, trending, _) = ref.watch(
    settingsProvider.select((s) {
      final f = s.getMap('simklGranularFilters');
      String flags(String g) {
        final m = f[g];
        return m is Map ? '${m['watching']},${m['plantowatch']}' : '';
      }

      return (
        s.getBool('simklHomeRailsEnabled'),
        s.getBool('simklTrendingRailEnabled'),
        '${s.tmdbKey}|${flags('movies')}|${flags('shows')}|${flags('anime')}',
      );
    }),
  );
  if (!enabled) return const [];
  final builder = SimklHomeRowsBuilder(
    client: ref.watch(simklClientProvider),
    tmdb: ref.watch(tmdbClientProvider),
    addon: ref.watch(addonClientProvider),
    transport: ref.watch(jsonTransportProvider),
    trendingEnabled: trending,
    filters: SimklGranularFilters.fromMap(
      ref.read(settingsProvider).getMap('simklGranularFilters'),
    ),
  );
  return builder.build();
});

/// The personal Simkl calendar for a month — upcoming releases for the account's
/// plan-to-watch + watching lists, resolved via the shared calendar engine.
/// Empty when Simkl isn't connected. Ports `fetchSimklCalendar`.
final simklCalendarProvider =
    FutureProvider.family<List<CalendarItem>, ({int year, int month})>((
      ref,
      ym,
    ) async {
      if (!ref.watch(simklConnectedProvider)) return const [];
      final client = ref.watch(simklClientProvider);
      final lists = await Future.wait([
        client.fetchWatchlist(),
        client.fetchWatching(),
      ]);
      final byId = <String, SavedCandidate>{};
      for (final item in [...lists[0], ...lists[1]]) {
        final id = item.libraryId;
        if (id == null || byId.containsKey(id)) continue;
        byId[id] = SavedCandidate(
          id: id,
          type: item.stremioType,
          name: item.title,
        );
      }
      if (byId.isEmpty) return const [];
      return resolveSavedCalendar(
        byId.values.toList(),
        ym.year,
        ym.month,
        tmdb: ref.watch(tmdbClientProvider),
        addon: ref.watch(addonClientProvider),
        transport: ref.watch(jsonTransportProvider),
        now: DateTime.now(),
      );
    });

/// The Simkl "premieres" calendar for a month (family: `(year, month)`), from
/// the public Simkl CDN. No account required.
final simklPremieresCalendarProvider =
    FutureProvider.family<List<CalendarItem>, ({int year, int month})>((
      ref,
      ym,
    ) {
      return fetchSimklPremieresCalendar(
        ref.watch(jsonTransportProvider),
        year: ym.year,
        month: ym.month,
      );
    });

/// The PIN sign-in flow driver.
final simklDeviceAuthProvider = Provider<SimklDeviceAuth>(
  (ref) => SimklDeviceAuth(ref.watch(simklClientProvider)),
);

/// The progress of the Simkl PIN connect flow.
sealed class SimklConnectState {
  const SimklConnectState();
}

class SimklConnectIdle extends SimklConnectState {
  const SimklConnectIdle();
}

class SimklConnectStarting extends SimklConnectState {
  const SimklConnectStarting();
}

/// A PIN is showing; the user must enter it at [verificationUrl].
class SimklConnectPending extends SimklConnectState {
  const SimklConnectPending(this.userCode, this.verificationUrl);
  final String userCode;
  final String verificationUrl;
}

class SimklConnectError extends SimklConnectState {
  const SimklConnectError(this.message);
  final String message;
}

class SimklConnectDone extends SimklConnectState {
  const SimklConnectDone(this.username);
  final String? username;
}

/// Drives Simkl PIN sign-in: request a PIN, poll until the user enters it, then
/// store the session (with its username). Ported from the web `pollForToken`/
/// `completeAuthorization`.
class SimklConnectController extends Notifier<SimklConnectState> {
  Timer? _timer;
  SimklPin? _pin;
  int _startedMs = 0;

  @override
  SimklConnectState build() {
    ref.onDispose(() => _timer?.cancel());
    return const SimklConnectIdle();
  }

  Future<void> start() async {
    _timer?.cancel();
    state = const SimklConnectStarting();
    try {
      final pin = await ref.read(simklDeviceAuthProvider).requestPin();
      _pin = pin;
      _startedMs = DateTime.now().millisecondsSinceEpoch;
      state = SimklConnectPending(pin.userCode, pin.verificationUrl);
      final interval = pin.pollIntervalSec > 0 ? pin.pollIntervalSec : 5;
      _timer = Timer.periodic(Duration(seconds: interval), (_) => pollOnce());
    } catch (_) {
      state = const SimklConnectError('Could not start Simkl sign-in.');
    }
  }

  /// One poll step (also driven by the timer) — visible for testing.
  Future<void> pollOnce() async {
    final pin = _pin;
    if (pin == null || state is! SimklConnectPending) return;
    final elapsedSec =
        (DateTime.now().millisecondsSinceEpoch - _startedMs) / 1000;
    if (elapsedSec >= pin.expiresIn) {
      _timer?.cancel();
      state = const SimklConnectError('The PIN expired. Please try again.');
      return;
    }
    final result = await ref
        .read(simklDeviceAuthProvider)
        .pollOnce(pin.userCode);
    switch (result) {
      case SimklPollAuthorized(:final session):
        _timer?.cancel();
        final finalized = await _complete(session);
        state = SimklConnectDone(finalized.username);
      case SimklPollPending():
        break;
    }
  }

  Future<SimklSession> _complete(SimklSession session) async {
    final store = ref.read(simklSessionStoreProvider);
    await store.write(session); // store first so the client can authenticate
    final username = await ref
        .read(simklClientProvider)
        .fetchUsername(session.accessToken);
    final finalized = SimklSession(
      accessToken: session.accessToken,
      username: username,
    );
    await store.write(finalized);
    ref.invalidate(simklConnectedProvider);
    ref.invalidate(simklUsernameProvider);
    // Pull the account's plan-to-watch list into the local one (additive).
    await ref.read(simklSyncProvider).pullWatchlist();
    return finalized;
  }

  void cancel() {
    _timer?.cancel();
    state = const SimklConnectIdle();
  }

  /// Signs out of Simkl: clears the stored session for the active profile.
  Future<void> disconnect() async {
    _timer?.cancel();
    await ref.read(simklSessionStoreProvider).write(null);
    state = const SimklConnectIdle();
    ref.invalidate(simklConnectedProvider);
    ref.invalidate(simklUsernameProvider);
  }
}

final simklConnectProvider =
    NotifierProvider<SimklConnectController, SimklConnectState>(
      SimklConnectController.new,
    );

/// The connected Simkl user's avatar (`/users/settings` → `user.avatar`), or
/// null. Web `fetchSimklAvatar`. Backs the "Use my Simkl avatar" setting.
final simklAvatarProvider = FutureProvider<String?>((ref) async {
  if (!ref.watch(simklConnectedProvider)) return null;
  return ref.watch(simklClientProvider).fetchAvatar();
});

/// The inputs of the Simkl avatar-mirror effect, keyed on the active profile's
/// id (not avatar) so it never ping-pongs with the other tracker mirrors — see
/// [AnilistAvatarSync]. Mirrors the deps of web `SimklAvatarSync`.
typedef SimklAvatarSync = ({bool on, String? avatar, String? activeId});
final simklAvatarSyncProvider = Provider<SimklAvatarSync>(
  (ref) => (
    on: ref.watch(settingsProvider).getBool('useSimklAvatar'),
    avatar: ref.watch(simklAvatarProvider).asData?.value,
    activeId: ref.watch(activeProfileProvider)?.id,
  ),
);

/// Fans watchlist and mark-watched changes out to the connected Simkl account,
/// alongside the local, Stremio and Trakt writes. No-op when Simkl is not
/// connected or the id doesn't map to a Simkl target (kitsu anime, or an
/// addon-local id). Best-effort. Ports the web `syncWithSimkl`/`addToHistory`.
class SimklSync {
  SimklSync(this._ref);

  final Ref _ref;

  /// Mirrors a local watchlist add/remove to Simkl's plan-to-watch list.
  Future<void> pushWatchlist({
    required String metaId,
    required bool added,
  }) async {
    if (!_ref.read(simklConnectedProvider)) return;
    final target = stremioIdToSimklTarget(metaId).target;
    if (target == null) return;
    final client = _ref.read(simklClientProvider);
    try {
      if (added) {
        await client.addToWatchlist(target);
      } else {
        await client.removeFromWatchlist(target);
      }
    } catch (_) {
      // Best-effort — local + Stremio remain authoritative.
    }
  }

  /// Pulls the Simkl plan-to-watch list into the local watchlist on connect
  /// (additive — never removes local saves), the read counterpart to
  /// [pushWatchlist].
  Future<void> pullWatchlist() async {
    if (!_ref.read(simklConnectedProvider)) return;
    final items = await _ref.read(simklClientProvider).fetchWatchlist();
    if (items.isEmpty) return;
    final store = _ref.read(localWatchlistProvider);
    var added = false;
    for (final it in items) {
      final id = it.stremioId;
      if (id == null || id.isEmpty || store.contains(id)) continue;
      await store.toggle(id: id, type: it.stremioType, name: it.title);
      added = true;
    }
    if (added) _ref.invalidate(watchlistProvider);
  }

  /// Records a movie as watched in Simkl's history.
  Future<void> pushMovieWatched({String? imdbId, int? tmdbId}) async {
    if (!_ref.read(simklConnectedProvider)) return;
    final ids = SimklIds(
      imdb: (imdbId != null && imdbId.isNotEmpty) ? imdbId : null,
      tmdb: tmdbId,
    );
    if (ids.isEmpty) return;
    try {
      await _ref.read(simklClientProvider).addToHistory(SimklMovieTarget(ids));
    } catch (_) {
      // Best-effort.
    }
  }
}

final simklSyncProvider = Provider<SimklSync>(SimklSync.new);
