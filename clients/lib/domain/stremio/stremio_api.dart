import '../../core/http/json_transport.dart';
import '../../core/result.dart';
import '../auth/auth_repository.dart';
import 'library_item.dart';
import 'library_write.dart';
import 'stremio_user.dart';

/// The Stremio account API (`https://api.strem.io/api`). Every call is a POST
/// with a JSON body and a `{ result, error }` envelope; an `error` becomes an
/// [Err] with the message and code, never a thrown/swallowed failure.
class StremioApi {
  StremioApi(this._t, {this.base = 'https://api.strem.io/api'});

  final JsonTransport _t;
  final String base;

  Future<Result<T>> _call<T>(
    String method,
    Map<String, dynamic> body,
    T Function(dynamic result) map,
  ) async {
    try {
      final res = await _t.postJson('$base/$method', body: body);
      final data = res.data;
      if (data is Map) {
        final error = data['error'];
        if (error != null) {
          final msg = error is Map
              ? (error['message']?.toString() ?? 'Request failed')
              : error.toString();
          final code = error is Map ? (error['code'] as num?)?.toInt() : null;
          return Err(Failure(msg, code: code));
        }
        if (data.containsKey('result')) return Ok(map(data['result']));
      }
      return Err(
        Failure('Malformed response from $method (HTTP ${res.statusCode})'),
      );
    } on TransportException catch (e) {
      return Err(Failure(e.message, cause: e));
    }
  }

  Future<Result<AuthSession>> login(String email, String password) => _call(
    'login',
    {'email': email, 'password': password, 'facebook': false},
    (r) => AuthSession(
      authKey: (r as Map)['authKey'] as String,
      user: StremioUser.fromJson((r['user'] as Map).cast<String, dynamic>()),
    ),
  );

  Future<Result<StremioUser>> getUser(String authKey) => _call('getUser', {
    'authKey': authKey,
  }, (r) => StremioUser.fromJson((r as Map).cast<String, dynamic>()));

  Future<Result<void>> logout(String authKey) =>
      _call('logout', {'authKey': authKey}, (_) {});

  /// The library-item ids and their hashes (`datastoreMeta`).
  Future<Result<List<String>>> datastoreMeta(
    String authKey, {
    String collection = 'libraryItem',
  }) => _call('datastoreMeta', {'authKey': authKey, 'collection': collection}, (
    r,
  ) {
    if (r is! List) return const <String>[];
    return [
      for (final e in r)
        if (e is List && e.isNotEmpty) e.first.toString(),
    ];
  });

  /// Fetches library items by id (`datastoreGet`).
  Future<Result<List<LibraryItem>>> datastoreGet(
    String authKey,
    List<String> ids, {
    String collection = 'libraryItem',
  }) => _call(
    'datastoreGet',
    {'authKey': authKey, 'collection': collection, 'ids': ids, 'all': true},
    (r) {
      if (r is! List) return const <LibraryItem>[];
      return [
        for (final e in r)
          if (e is Map) LibraryItem.fromJson(e.cast<String, dynamic>()),
      ];
    },
  );

  /// Fetches library items by id as their raw, untouched maps, so a write can
  /// round-trip every field the server sent (`datastorePut` spreads the
  /// original object). The typed [datastoreGet] is lossy and unsafe for writes.
  Future<Result<List<Map<String, dynamic>>>> datastoreGetRaw(
    String authKey,
    List<String> ids, {
    String collection = 'libraryItem',
    bool all = false,
  }) => _call(
    'datastoreGet',
    {'authKey': authKey, 'collection': collection, 'ids': ids, 'all': all},
    (r) {
      if (r is! List) return const <Map<String, dynamic>>[];
      return [
        for (final e in r)
          if (e is Map) e.cast<String, dynamic>(),
      ];
    },
  );

  /// Writes library-item [changes] back to the account (`datastorePut`).
  Future<Result<void>> datastorePut(
    String authKey,
    List<Map<String, dynamic>> changes, {
    String collection = 'libraryItem',
  }) => _call('datastorePut', {
    'authKey': authKey,
    'collection': collection,
    'changes': changes,
  }, (_) {});

  /// Saves (or un-removes) a watchlist bookmark on the account. Ports the web
  /// `saveStremioBookmark`: an existing item is re-put with its removed/temp
  /// flags cleared; a new one gets a full library-item skeleton. Best-effort —
  /// a failed read/write is swallowed (the local watchlist is the source of
  /// truth); [nowIso] is the caller's clock for `_ctime`/`_mtime`.
  Future<void> saveBookmark(
    String authKey,
    String id, {
    String? type,
    String? name,
    String? poster,
    required String nowIso,
  }) async {
    final existing = await libraryGetOne(authKey, id);
    if (existing != null) {
      await datastorePut(authKey, [
        {...existing, 'removed': false, 'temp': false, '_mtime': nowIso},
      ]);
      return;
    }
    final kind = (type == 'series' || type == 'tv' || type == 'channel')
        ? 'series'
        : 'movie';
    await datastorePut(authKey, [
      {
        '_id': id,
        'name': name ?? '',
        'type': kind,
        'poster': poster,
        'posterShape': 'poster',
        'removed': false,
        'temp': false,
        '_ctime': nowIso,
        '_mtime': nowIso,
        'state': {
          'lastWatched': null,
          'timeWatched': 0,
          'timeOffset': 0,
          'overallTimeWatched': 0,
          'timesWatched': 0,
          'flaggedWatched': 0,
          'duration': 0,
          'video_id': null,
          'watched': null,
          'lastVidReleased': null,
          'noNotif': false,
        },
        'behaviorHints': {
          'defaultVideoId': null,
          'featuredVideoId': null,
          'hasScheduledVideos': false,
        },
      },
    ]);
  }

  /// Removes a watchlist bookmark on the account. Ports the web
  /// `removeStremioBookmark`: the item is re-put `removed: true`, keeping it as
  /// `temp` (so continue-watching survives) when it has playback progress.
  /// No-op when the account never had the item. Best-effort.
  Future<void> removeBookmark(
    String authKey,
    String id, {
    required String nowIso,
  }) async {
    final existing = await libraryGetOne(authKey, id);
    if (existing == null) return;
    final state = existing['state'];
    final hasProgress =
        state is Map &&
        (((state['timeOffset'] as num?) ?? 0) > 0 ||
            ((state['flaggedWatched'] as num?) ?? 0) > 0);
    await datastorePut(authKey, [
      {...existing, 'removed': true, 'temp': hasProgress, '_mtime': nowIso},
    ]);
  }

  /// Flags a movie watched (or not) on the account, preserving all prior state
  /// and landing a real bookmark. Ports `markMovieWatchedStremio`. Best-effort —
  /// a failed read/write is swallowed; [nowIso] is the caller's clock.
  Future<void> markMovieWatched(
    String canonicalId, {
    required String authKey,
    required String metaName,
    String? metaPoster,
    String? metaBackground,
    required String metaType,
    required bool watched,
    required String nowIso,
  }) async {
    final base = await libraryGetOne(authKey, canonicalId);
    final item = buildMovieWatchedWrite(
      base: base,
      canonicalId: canonicalId,
      metaName: metaName,
      metaPoster: metaPoster,
      metaBackground: metaBackground,
      metaType: metaType,
      watched: watched,
      nowIso: nowIso,
    );
    if (item == null) return;
    await datastorePut(authKey, [item]);
  }

  /// One raw library item by id (`datastoreGet`, `all: false`), or null. The
  /// untouched map, so a subsequent write round-trips every server field.
  Future<Map<String, dynamic>?> libraryGetOne(String authKey, String id) async {
    final got = await datastoreGetRaw(authKey, [id]);
    final items = got.valueOrNull;
    if (items == null) return null;
    for (final m in items) {
      if (m['_id'] == id) return m;
    }
    return null;
  }

  /// The full Stremio library — all item ids resolved to entries. Empty when
  /// the account has no library. Ported from `stremio.ts` `library`.
  Future<Result<List<LibraryItem>>> library(String authKey) async {
    final meta = await datastoreMeta(authKey);
    return meta.when(
      ok: (ids) =>
          ids.isEmpty ? Future.value(const Ok([])) : datastoreGet(authKey, ids),
      err: (f) => Future.value(Err(f)),
    );
  }

  Future<Result<List<dynamic>>> addonCollectionGet(String authKey) => _call(
    'addonCollectionGet',
    {'authKey': authKey, 'type': 'user', 'update': false},
    (r) => (r is Map ? r['addons'] : null) is List
        ? (r as Map)['addons'] as List
        : const [],
  );

  Future<Result<void>> addonCollectionSet(
    String authKey,
    List<dynamic> addons,
  ) => _call('addonCollectionSet', {
    'authKey': authKey,
    'type': 'user',
    'addons': addons,
  }, (_) {});

  /// Sign in with an existing authKey: hydrate the user, or synthesize a minimal
  /// user (`_id: "stremio:"+key[:10]`) if `getUser` fails — matching Harbor's
  /// `signInWithKey`.
  Future<Result<AuthSession>> signInWithKey(String authKey) async {
    final key = authKey.trim();
    final user = await getUser(key);
    return user.when(
      ok: (u) => Ok(AuthSession(authKey: key, user: u)),
      err: (_) => Ok(
        AuthSession(
          authKey: key,
          user: StremioUser.fromJson({
            '_id':
                'stremio:${key.substring(0, key.length < 10 ? key.length : 10)}',
            'email': '',
          }),
        ),
      ),
    );
  }
}

/// Ids the Stremio cloud library accepts (IMDb + the tracker namespaces).
final _cloudOk = RegExp(r'^(tt\d|kitsu:|mal:|anilist:|anidb:|tmdb:)');

/// The id to write to the Stremio cloud library for [metaId], or null when it
/// isn't a cloud-safe id (e.g. an addon-local id). A verified IMDb [resolved]
/// id substitutes for a non-IMDb meta. Ported from `stremio.ts` `cloudWriteId`.
String? cloudWriteId(String metaId, String? resolved, bool verified) {
  if (metaId.startsWith('tt')) return metaId;
  if (verified && resolved != null && resolved.startsWith('tt')) {
    return resolved;
  }
  return _cloudOk.hasMatch(metaId) ? metaId : null;
}
