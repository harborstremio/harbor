import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/addons/models.dart';
import '../domain/auth/auth_repository.dart';
import '../domain/library/local_cw.dart';
import '../domain/stremio/library_item.dart';
import '../domain/stremio/library_write.dart';
import '../domain/stremio/stremio_api.dart';
import '../domain/stremio/stremio_link_api.dart';
import '../domain/stremio/stremio_watched.dart';
import 'providers.dart';

/// Stremio API (`api.strem.io`) — login / getUser / addon collection.
final stremioApiProvider = Provider<StremioApi>(
  (ref) => StremioApi(ref.watch(jsonTransportProvider)),
);

/// Stremio Link (device-code sign-in) API.
final stremioLinkApiProvider = Provider<StremioLinkApi>(
  (ref) => StremioLinkApi(ref.watch(jsonTransportProvider)),
);

/// Persists the Stremio session (authKey secret) in secure storage.
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    ref.watch(secureStoreProvider),
    ref.watch(profilesRepoProvider),
  ),
);

/// The active Stremio session (`null` when signed out), with sign-in/out.
class StremioSessionController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() =>
      ref.watch(authRepositoryProvider).readActiveSession();

  Future<void> signIn(AuthSession session) async {
    final id = ref.read(profilesRepoProvider).stremioSourceProfileId();
    await ref.read(authRepositoryProvider).writeSession(id, session);
    state = AsyncData(session);
    await _pullLibrary(session.authKey);
    await _pullAddons(session.authKey);
  }

  /// Re-pulls the Stremio library and merges fresh in-progress items into the
  /// continue-watching shelf, keeping it current across devices — the web home
  /// refreshes the library on window focus / visibility / a 30s poll, whereas a
  /// returning native user (session restored, not freshly signed in) would
  /// otherwise never re-pull. Awaits the restored session first; a no-op when
  /// signed out. The merge is additive, so local progress is never clobbered.
  Future<void> refreshLibrary() async {
    if (_refreshing) return;
    _refreshing = true;
    try {
      final session = await future;
      final key = session?.authKey;
      if (key != null) await _pullLibrary(key);
    } catch (_) {
      // A failed refresh leaves the last-known CW in place.
    } finally {
      _refreshing = false;
    }
  }

  bool _refreshing = false;

  /// Pulls the Stremio add-on collection on sign-in and merges any new add-ons
  /// into the installed set (additive), so a signed-in user's add-ons provide
  /// catalogs and streams. Manifests ride in the collection, so no refetch.
  Future<void> _pullAddons(String authKey) async {
    final result = await ref
        .read(stremioApiProvider)
        .addonCollectionGet(authKey);
    final addons = result.when(ok: (l) => l, err: (_) => const <dynamic>[]);
    if (addons.isEmpty) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    final parsed = <InstalledAddon>[];
    for (final a in addons) {
      if (a is! Map) continue;
      final transportUrl = a['transportUrl']?.toString();
      if (transportUrl == null || transportUrl.isEmpty) continue;
      final manifest = a['manifest'] is Map
          ? Manifest((a['manifest'] as Map).cast<String, dynamic>())
          : null;
      parsed.add(
        InstalledAddon(
          id: (manifest?.id.isNotEmpty ?? false) ? manifest!.id : transportUrl,
          transportUrl: transportUrl,
          installedAt: now,
          manifest: manifest,
        ),
      );
    }
    final before = ref.read(installedAddonsRepoProvider).load().length;
    final merged = await ref.read(installedAddonsRepoProvider).merge(parsed);
    if (merged.length != before) ref.invalidate(installedAddonsProvider);
  }

  /// Pulls the Stremio library on sign-in and merges its watchlist entries into
  /// the local watchlist (additive — never removes local saves).
  Future<void> _pullLibrary(String authKey) async {
    final result = await ref.read(stremioApiProvider).library(authKey);
    final items = result.when(ok: (l) => l, err: (_) => const <LibraryItem>[]);
    if (items.isEmpty) return;
    final bookmarkedOnly = ref
        .read(settingsProvider)
        .getBool('libraryBookmarkedOnly');
    final store = ref.read(localWatchlistProvider);
    var added = false;
    for (final it in items) {
      final keep = bookmarkedOnly ? it.bookmarked : it.inWatchlist;
      if (!keep || it.id.isEmpty || store.contains(it.id)) continue;
      await store.toggle(
        id: it.id,
        type: it.type,
        name: it.name,
        poster: it.poster,
      );
      added = true;
    }
    if (added) ref.invalidate(watchlistProvider);
    await _mergeContinueWatching(items);
  }

  /// Merges the Stremio library's in-progress items into the local
  /// continue-watching store (additive; leaves local progress untouched). The
  /// store drops finished items itself.
  Future<void> _mergeContinueWatching(List<LibraryItem> items) async {
    final cw = ref.read(localCwStoreProvider);
    final have = {for (final e in cw.list()) e.id};
    final now = DateTime.now().millisecondsSinceEpoch;
    var added = false;
    for (final it in items) {
      final st = it.state;
      if (st == null ||
          !it.inProgress ||
          it.id.isEmpty ||
          have.contains(it.id)) {
        continue;
      }
      await cw.save(
        LocalCwEntry(
          id: it.id,
          type: it.type,
          name: it.name,
          poster: it.poster,
          background: it.background,
          season: st.season,
          episode: st.episode,
          videoId: st.videoId,
          positionMs: st.timeOffset,
          durationMs: st.duration,
          t: now,
        ),
      );
      added = true;
    }
    if (added) ref.read(continueWatchingProvider.notifier).refresh();
  }

  Future<void> signOut() async {
    final key = state.value?.authKey;
    if (key != null) {
      await ref.read(stremioApiProvider).logout(key);
    }
    final id = ref.read(profilesRepoProvider).stremioSourceProfileId();
    await ref.read(authRepositoryProvider).clear(id);
    state = const AsyncData(null);
  }
}

final stremioSessionProvider =
    AsyncNotifierProvider<StremioSessionController, AuthSession?>(
      StremioSessionController.new,
    );

/// The device-code sign-in flow's progress.
sealed class LinkState {
  const LinkState();
}

class LinkIdle extends LinkState {
  const LinkIdle();
}

class LinkStarting extends LinkState {
  const LinkStarting();
}

/// A code is showing; the phone must enter it. Polling in the background.
class LinkPending extends LinkState {
  const LinkPending(this.code, this.link);
  final String code;
  final String? link;
}

class LinkError extends LinkState {
  const LinkError(this.message);
  final String message;
}

class LinkDone extends LinkState {
  const LinkDone();
}

/// Drives the TV device-code sign-in: `create` a code, poll `read` until the
/// phone confirms, then sign in and store the session. Ported from the web
/// Stremio Link flow.
class StremioLinkController extends Notifier<LinkState> {
  Timer? _timer;

  @override
  LinkState build() {
    ref.onDispose(() => _timer?.cancel());
    return const LinkIdle();
  }

  static const pollInterval = Duration(seconds: 2);

  /// Requests a fresh code and begins polling for confirmation.
  Future<void> start() async {
    _timer?.cancel();
    state = const LinkStarting();
    final res = await ref.read(stremioLinkApiProvider).create();
    res.when(
      ok: (code) {
        state = LinkPending(code.code, code.link);
        _timer = Timer.periodic(pollInterval, (_) => pollOnce());
      },
      err: (f) => state = LinkError(f.message),
    );
  }

  /// One poll step (also driven by the timer) — visible for testing.
  Future<void> pollOnce() async {
    final s = state;
    if (s is! LinkPending) return;
    final res = await ref.read(stremioLinkApiProvider).read(s.code);
    await res.when(
      ok: (key) async {
        if (key == null) return; // still pending
        _timer?.cancel();
        final session = await ref.read(stremioApiProvider).signInWithKey(key);
        await session.when(
          ok: (sess) async {
            await ref.read(stremioSessionProvider.notifier).signIn(sess);
            state = const LinkDone();
          },
          err: (f) async => state = LinkError(f.message),
        );
      },
      err: (f) async {
        _timer?.cancel();
        state = LinkError(f.message);
      },
    );
  }

  void cancel() {
    _timer?.cancel();
    state = const LinkIdle();
  }
}

final stremioLinkProvider = NotifierProvider<StremioLinkController, LinkState>(
  StremioLinkController.new,
);

/// Pushes local watchlist changes up to the signed-in Stremio account so edits
/// made here reach the cloud library (the reverse of `_pullLibrary`). No-op
/// when signed out or for ids the cloud won't accept; best-effort — the local
/// watchlist stays the source of truth if the write fails. Ports the web
/// `syncWithStremio`.
class StremioWatchlistSync {
  StremioWatchlistSync(this._ref);

  final Ref _ref;

  Future<void> push({
    required String id,
    String? type,
    String? name,
    String? poster,
    required bool added,
  }) async {
    final authKey = _ref.read(stremioSessionProvider).asData?.value?.authKey;
    if (authKey == null || authKey.isEmpty) return;
    final writeId = cloudWriteId(id, null, false);
    if (writeId == null) return;
    final api = _ref.read(stremioApiProvider);
    final nowIso = DateTime.now().toUtc().toIso8601String();
    try {
      if (added) {
        await api.saveBookmark(
          authKey,
          writeId,
          type: type,
          name: name,
          poster: poster,
          nowIso: nowIso,
        );
      } else {
        await api.removeBookmark(authKey, writeId, nowIso: nowIso);
      }
    } catch (_) {
      // Best-effort — the local watchlist is authoritative offline.
    }
  }
}

final stremioWatchlistSyncProvider = Provider<StremioWatchlistSync>(
  StremioWatchlistSync.new,
);

/// Writes continue-watching progress up to the Stremio account for a single
/// playback session. Ports `writeWithFreshBase` from `use-stremio-sync.ts`:
/// each write re-reads the account item so `timesWatched`/`flaggedWatched`
/// accumulate correctly, and skips when another device has a newer, further-
/// ahead position for the same video (the mtime anti-clobber guard). Mid-play
/// ticks are throttled to the 30s cloud cadence; forced writes (pause, ended,
/// teardown) always go through.
class StremioCwWriter {
  StremioCwWriter({
    required this.api,
    required this.authKey,
    required this.canonicalId,
    required DateTime Function() clock,
  }) : _clock = clock,
       _sessionStartMs = clock().millisecondsSinceEpoch;

  final StremioApi api;
  final String authKey;
  final String canonicalId;
  final DateTime Function() _clock;
  final int _sessionStartMs;

  static const _tickMinGapMs = 30000;

  final Set<String> _writtenMtimes = {};
  Map<String, dynamic>? _base;
  bool _wroteOnce = false;
  int _lastWriteMs = 0;

  Future<void> write(CwWriteInput input, {required bool force}) async {
    if (input.positionSec < cwMinPositionSec || input.durationSec <= 0) return;
    final nowMs = _clock().millisecondsSinceEpoch;
    if (!force && _lastWriteMs != 0 && nowMs - _lastWriteMs < _tickMinGapMs) {
      return;
    }
    final fresh = (force || !_wroteOnce)
        ? await api.libraryGetOne(authKey, canonicalId)
        : null;
    if (fresh != null) _base = fresh;
    final base = fresh ?? _base;

    final remoteMtimeStr = base?['_mtime'] is String
        ? base!['_mtime'] as String
        : '';
    final remoteMtime = DateTime.tryParse(
      remoteMtimeStr,
    )?.millisecondsSinceEpoch;
    final st = base?['state'] is Map
        ? (base!['state'] as Map)
        : const <dynamic, dynamic>{};
    final remoteMs = st['timeOffset'] is num
        ? (st['timeOffset'] as num).toInt()
        : 0;
    final remoteVid = st['video_id'] is String
        ? st['video_id'] as String
        : canonicalId;
    final ourMs = (input.positionSec * 1000).floor();
    if (!_writtenMtimes.contains(remoteMtimeStr) &&
        remoteVid == input.videoId &&
        remoteMtime != null &&
        remoteMtime > _sessionStartMs &&
        remoteMs > ourMs + 60000) {
      return;
    }

    final nowIso = _clock().toUtc().toIso8601String();
    final item = buildCwLibraryWrite(base: base, input: input, nowIso: nowIso);
    if (item == null) return;
    _lastWriteMs = nowMs;
    final res = await api.datastorePut(authKey, [item]);
    res.when(
      ok: (_) {
        _writtenMtimes.add(nowIso);
        _base = item;
        _wroteOnce = true;
      },
      err: (_) {},
    );
  }
}

/// Mints a [StremioCwWriter] for a playback session, or null when signed out or
/// the id isn't cloud-writable (an addon-local id the Stremio library rejects).
class StremioCwSync {
  StremioCwSync(this._ref);

  final Ref _ref;

  StremioCwWriter? session(
    String metaId, {
    String? imdbId,
    bool imdbVerified = false,
  }) {
    final authKey = _ref.read(stremioSessionProvider).asData?.value?.authKey;
    if (authKey == null || authKey.isEmpty) return null;
    final cid = cloudWriteId(metaId, imdbId, imdbVerified);
    if (cid == null) return null;
    return StremioCwWriter(
      api: _ref.read(stremioApiProvider),
      authKey: authKey,
      canonicalId: cid,
      clock: DateTime.now,
    );
  }
}

final stremioCwSyncProvider = Provider<StremioCwSync>(StremioCwSync.new);

/// Pushes a "mark watched" up to the Stremio account so the watched flag
/// reaches the cloud library (the counterpart to the continue-watching write).
/// No-op when signed out or for non-cloud ids; best-effort. Ports the Stremio
/// half of `markMovieWatched` from the web `mark-watched.ts`.
class StremioWatchedSync {
  StremioWatchedSync(this._ref);

  final Ref _ref;

  Future<void> pushMovie({
    required String metaId,
    String? imdbId,
    required bool watched,
    String? name,
    String? poster,
    String? background,
    String type = 'movie',
  }) async {
    final authKey = _ref.read(stremioSessionProvider).asData?.value?.authKey;
    if (authKey == null || authKey.isEmpty) return;
    final imdb = imdbId ?? (metaId.startsWith('tt') ? metaId : null);
    final cid = cloudWriteId(metaId, imdb, imdb != null);
    if (cid == null) return;
    final api = _ref.read(stremioApiProvider);
    final nowIso = DateTime.now().toUtc().toIso8601String();
    try {
      await api.markMovieWatched(
        cid,
        authKey: authKey,
        metaName: name ?? '',
        metaPoster: poster,
        metaBackground: background,
        metaType: type,
        watched: watched,
        nowIso: nowIso,
      );
    } catch (_) {
      // Best-effort — the local watched flag is authoritative offline.
    }
  }

  /// Pushes a series' watched-episode state up to the account's `state.watched`
  /// bitmap. Merges the account's prior watched set (decoded from the base) with
  /// the local [manual] tri-state (`"season:episode"` → true/false/null), so
  /// episodes the viewer never touched keep the cloud's value. No-op when
  /// unchanged, signed out, anime, or the id isn't cloud-writable. Ports the
  /// Stremio half of the web detail series-watched effect.
  Future<void> pushEpisodes({
    required String metaId,
    String? imdbId,
    required String name,
    String? poster,
    String? background,
    required List<WatchedVideo> videos,
    required Map<String, bool?> manual,
  }) async {
    final authKey = _ref.read(stremioSessionProvider).asData?.value?.authKey;
    if (authKey == null || authKey.isEmpty) return;
    if (videos.isEmpty) return;
    // Anime uses a different id/video alignment and is synced elsewhere.
    if (RegExp(r'^(kitsu|mal|anilist|anidb):').hasMatch(metaId)) return;
    final imdb = imdbId ?? (metaId.startsWith('tt') ? metaId : null);
    final cid = cloudWriteId(metaId, imdb, imdb != null);
    if (cid == null) return;
    final api = _ref.read(stremioApiProvider);
    try {
      final base = await api.libraryGetOne(authKey, cid);
      final priorField = (base?['state'] as Map?)?['watched'];
      final prior = decodeWatchedEpisodes(
        priorField is String ? priorField : null,
        videos,
      );
      final merged = {...prior};
      for (final v in videos) {
        if (v.season == null || v.episode == null) continue;
        final k = '${v.season}:${v.episode}';
        final m = manual[k];
        if (m == true) {
          merged.add(k);
        } else if (m == false) {
          merged.remove(k);
        }
      }
      final unchanged =
          merged.length == prior.length && merged.every(prior.contains);
      if (unchanged) return;
      final field = encodeWatchedEpisodes(merged, videos);
      if (field == null) return;
      final item = buildEpisodesWatchedWrite(
        base: base,
        canonicalId: cid,
        metaName: name,
        metaPoster: poster,
        metaBackground: background,
        watchedField: field,
        nowIso: DateTime.now().toUtc().toIso8601String(),
      );
      if (item == null) return;
      await api.datastorePut(authKey, [item]);
    } catch (_) {
      // Best-effort — local manual-watched is authoritative offline.
    }
  }
}

final stremioWatchedSyncProvider = Provider<StremioWatchedSync>(
  StremioWatchedSync.new,
);
