import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/calendar/calendar.dart';
import '../domain/calendar/calendar_anticipated.dart';
import '../domain/calendar/calendar_trakt.dart';
import '../domain/catalog/catalog_row.dart';
import '../domain/trakt/trakt_client.dart';
import '../domain/trakt/trakt_home_rows.dart';
import '../domain/trakt/trakt_config.dart';
import '../domain/trakt/trakt_device_auth.dart';
import '../domain/trakt/trakt_ids.dart';
import '../domain/trakt/trakt_session_store.dart';
import '../domain/trakt/trakt_types.dart';
import 'providers.dart';

/// The Trakt OAuth session store for the active profile (keychain-backed).
final traktSessionStoreProvider = Provider<TraktSessionStore>((ref) {
  final profileId = ref.watch(profilesRepoProvider).activeProfileId();
  return TraktSessionStore(
    ref.watch(secureStoreProvider),
    ref.watch(kvStoreProvider),
    profileId: profileId,
  );
});

/// Completes once the keychain session has been read into the store's cache, so
/// the synchronous session reads reflect the stored session. Watched by the
/// connected/username providers so they re-evaluate after hydration.
final traktSessionReadyProvider = FutureProvider<void>(
  (ref) => ref.watch(traktSessionStoreProvider).ensureHydrated(),
);

/// The authenticated Trakt API client (token refresh through Harbor's proxy).
final traktClientProvider = Provider<TraktClient>(
  (ref) => TraktClient(
    ref.watch(jsonTransportProvider),
    ref.watch(traktSessionStoreProvider),
  ),
);

/// Whether Trakt is connected for the active profile. Falls back to the
/// settings token fields (`traktAccessToken`/…) when no session is stored yet,
/// persisting a session derived from them so later reads are direct.
final traktConnectedProvider = Provider<bool>((ref) {
  // Re-evaluate once the keychain session is hydrated into the store's cache.
  ref.watch(traktSessionReadyProvider);
  final store = ref.watch(traktSessionStoreProvider);
  final stored = store.read();
  if (stored != null) return store.isAuthenticated();

  final s = ref.watch(settingsProvider);
  final session = TraktSessionStore.sessionFromSettings(
    accessToken: s.getString('traktAccessToken'),
    refreshToken: s.getString('traktRefreshToken'),
    expiresAtMs: s.getInt('traktExpiresAt'),
    username: s.getString('traktUsername'),
    nowMs: DateTime.now().millisecondsSinceEpoch,
  );
  if (session == null) return false;
  store.write(session); // fire-and-forget: persist for subsequent reads
  final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  return nowSec <
      session.createdAt + session.expiresIn + traktRefreshThresholdSec;
});

/// The Trakt username for the connected account, or null.
final traktUsernameProvider = Provider<String?>((ref) {
  ref.watch(traktSessionReadyProvider);
  return ref.watch(traktSessionStoreProvider).read()?.username;
});

/// The Trakt calendar (upcoming episodes + movies, Cinemeta-hydrated) for a
/// month (family: `(year, month)`, month 1-12).
final traktCalendarProvider =
    FutureProvider.family<List<CalendarItem>, ({int year, int month})>((
      ref,
      ym,
    ) {
      return fetchTraktCalendar(
        ref.watch(traktClientProvider),
        ref.watch(addonClientProvider),
        year: ym.year,
        month: ym.month,
        now: DateTime.now(),
      );
    });

/// The Trakt Home rails (watchlist, up-next, movie/show recommendations),
/// hydrated to metas — the Trakt slice of the Home body. Empty when Trakt is not
/// connected; rebuilds when the TMDB key changes (hydration depends on it),
/// matching the web home effect deps `[traktConnected, settings.tmdbKey]`.
final traktHomeRowsProvider = FutureProvider<List<CatalogRow>>((ref) async {
  if (!ref.watch(traktConnectedProvider)) return const [];
  ref.watch(settingsProvider.select((s) => s.tmdbKey));
  final builder = TraktHomeRowsBuilder(
    client: ref.watch(traktClientProvider),
    tmdb: ref.watch(tmdbClientProvider),
    addon: ref.watch(addonClientProvider),
    todayIso: calendarIso(DateTime.now()),
  );
  return builder.build();
});

/// The anticipated (most-listed unreleased) calendar for a month. Public data —
/// no Trakt connection required.
final anticipatedCalendarProvider =
    FutureProvider.family<List<CalendarItem>, ({int year, int month})>((
      ref,
      ym,
    ) {
      return fetchAnticipatedCalendar(
        ref.watch(traktClientProvider),
        ref.watch(addonClientProvider),
        year: ym.year,
        month: ym.month,
      );
    });

/// The device-code sign-in flow driver.
final traktDeviceAuthProvider = Provider<TraktDeviceAuth>(
  (ref) => TraktDeviceAuth(ref.watch(jsonTransportProvider)),
);

/// The progress of the Trakt device-code connect flow.
sealed class TraktConnectState {
  const TraktConnectState();
}

class TraktConnectIdle extends TraktConnectState {
  const TraktConnectIdle();
}

class TraktConnectStarting extends TraktConnectState {
  const TraktConnectStarting();
}

/// A code is showing; the user must enter it at [verificationUrl].
class TraktConnectPending extends TraktConnectState {
  const TraktConnectPending(this.userCode, this.verificationUrl);
  final String userCode;
  final String verificationUrl;
}

class TraktConnectError extends TraktConnectState {
  const TraktConnectError(this.message);
  final String message;
}

class TraktConnectDone extends TraktConnectState {
  const TraktConnectDone(this.username);
  final String? username;
}

/// Drives Trakt device-code sign-in: request a code, poll until the user
/// authorizes, then store the session (with its username). Ported from the web
/// `pollForToken`/`completeAuthorization`.
class TraktConnectController extends Notifier<TraktConnectState> {
  Timer? _timer;
  TraktDeviceCode? _device;
  int _intervalSec = 5;
  int _startedMs = 0;

  @override
  TraktConnectState build() {
    ref.onDispose(() => _timer?.cancel());
    return const TraktConnectIdle();
  }

  Future<void> start() async {
    _timer?.cancel();
    state = const TraktConnectStarting();
    try {
      final device = await ref
          .read(traktDeviceAuthProvider)
          .requestDeviceCode();
      _device = device;
      _intervalSec = device.pollIntervalSec > 0 ? device.pollIntervalSec : 5;
      _startedMs = DateTime.now().millisecondsSinceEpoch;
      state = TraktConnectPending(device.userCode, device.verificationUrl);
      _scheduleTimer();
    } catch (_) {
      state = const TraktConnectError('Could not start Trakt sign-in.');
    }
  }

  void _scheduleTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(Duration(seconds: _intervalSec), (_) => pollOnce());
  }

  /// One poll step (also driven by the timer) — visible for testing.
  Future<void> pollOnce() async {
    final device = _device;
    if (device == null || state is! TraktConnectPending) return;
    final elapsedSec =
        (DateTime.now().millisecondsSinceEpoch - _startedMs) / 1000;
    if (elapsedSec >= device.expiresIn) {
      _timer?.cancel();
      state = const TraktConnectError('The code expired. Please try again.');
      return;
    }
    final result = await ref
        .read(traktDeviceAuthProvider)
        .pollOnce(device.deviceCode);
    switch (result) {
      case TraktPollAuthorized(:final session):
        _timer?.cancel();
        final finalized = await _complete(session);
        state = TraktConnectDone(finalized.username);
      case TraktPollPending():
        break;
      case TraktPollSlowDown():
        _intervalSec += 5;
        _scheduleTimer();
      case TraktPollExpired():
        _timer?.cancel();
        state = const TraktConnectError('The code expired. Please try again.');
      case TraktPollDenied():
        _timer?.cancel();
        state = const TraktConnectError('Sign-in was denied.');
      case TraktPollError(:final message):
        _timer?.cancel();
        state = TraktConnectError(message);
    }
  }

  /// Stores the session, then fetches and attaches the username.
  Future<TraktSession> _complete(TraktSession session) async {
    final store = ref.read(traktSessionStoreProvider);
    await store.write(session); // store first so the client can authenticate
    final me = await ref.read(traktClientProvider).getUserMe();
    final finalized = TraktSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      createdAt: session.createdAt,
      expiresIn: session.expiresIn,
      username: me?.username,
    );
    await store.write(finalized);
    ref.invalidate(traktConnectedProvider);
    ref.invalidate(traktUsernameProvider);
    // Pull the account's watchlist into the local one (additive).
    await ref.read(traktSyncProvider).pullWatchlist();
    return finalized;
  }

  void cancel() {
    _timer?.cancel();
    state = const TraktConnectIdle();
  }

  /// Signs out of Trakt: clears the stored session for the active profile.
  Future<void> disconnect() async {
    _timer?.cancel();
    await ref.read(traktSessionStoreProvider).write(null);
    state = const TraktConnectIdle();
    ref.invalidate(traktConnectedProvider);
    ref.invalidate(traktUsernameProvider);
  }
}

final traktConnectProvider =
    NotifierProvider<TraktConnectController, TraktConnectState>(
      TraktConnectController.new,
    );

/// Fans watchlist and mark-watched changes out to the connected Trakt account,
/// alongside the local + Stremio writes. No-op when Trakt is not connected or
/// the id doesn't map to a Trakt target (anime without an IMDb mapping, or an
/// addon-local id). Best-effort. Ports the web `syncWithTrakt`/`pushWatched`.
class TraktSync {
  TraktSync(this._ref);

  final Ref _ref;

  /// Mirrors a local watchlist add/remove to Trakt's watchlist.
  Future<void> pushWatchlist({
    required String metaId,
    required bool added,
  }) async {
    if (!_ref.read(traktConnectedProvider)) return;
    final target = stremioIdToTraktTarget(metaId).target;
    if (target == null) return;
    final client = _ref.read(traktClientProvider);
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

  /// Pulls the Trakt watchlist into the local watchlist on connect (additive —
  /// never removes local saves), the read counterpart to [pushWatchlist].
  Future<void> pullWatchlist() async {
    if (!_ref.read(traktConnectedProvider)) return;
    final items = await _ref.read(traktClientProvider).fetchWatchlist();
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

  /// Records a movie as watched in Trakt's history.
  Future<void> pushMovieWatched({String? imdbId, int? tmdbId}) async {
    if (!_ref.read(traktConnectedProvider)) return;
    final ids = TraktIds(
      imdb: (imdbId != null && imdbId.isNotEmpty) ? imdbId : null,
      tmdb: tmdbId,
    );
    if (ids.isEmpty) return;
    try {
      await _ref.read(traktClientProvider).pushWatched(TraktMovieTarget(ids));
    } catch (_) {
      // Best-effort.
    }
  }
}

final traktSyncProvider = Provider<TraktSync>(TraktSync.new);

/// Public Trakt comments for a title/episode, for the detail-page comments
/// section (gated on the `showTraktComments` setting).
typedef TraktCommentsKey = ({
  String type,
  String id,
  int? season,
  int? episode,
});

final traktCommentsProvider =
    FutureProvider.family<List<TraktComment>, TraktCommentsKey>((ref, key) {
      return ref
          .watch(traktClientProvider)
          .fetchComments(
            type: key.type,
            id: key.id,
            season: key.season,
            episode: key.episode,
          );
    });

/// The signed-in Trakt user's profile picture (`/users/me` →
/// `images.avatar.full`), or null when disconnected or the account has none.
/// Backs the "Use my Trakt avatar" setting. Web `fetchTraktAvatar`.
final traktAvatarProvider = FutureProvider<String?>((ref) async {
  if (!ref.watch(traktConnectedProvider)) return null;
  final me = await ref.watch(traktClientProvider).getUserMe();
  return me?.avatar;
});
