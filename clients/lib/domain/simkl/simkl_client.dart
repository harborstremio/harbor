import '../../core/http/json_transport.dart';
import '../library/local_cw.dart';
import 'simkl_config.dart';
import 'simkl_playback.dart';
import 'simkl_session_store.dart';
import 'simkl_types.dart';

/// A non-2xx Simkl response. Ported from `SimklApiError`.
class SimklApiError implements Exception {
  SimklApiError(this.status, this.body);
  final int status;
  final String body;
  @override
  String toString() {
    final b = body.length > 200 ? body.substring(0, 200) : body;
    return 'Simkl HTTP $status: $b';
  }
}

/// The Simkl API client. Adds the `simkl-api-key` header, the bearer token, and
/// the `client_id`/`app-name`/`app-version` query params every request needs.
/// A 401 on an authed call clears the session and throws (Simkl tokens don't
/// refresh); 429/5xx backoff is handled by the underlying [JsonTransport].
/// Ported from `simkl/client.ts`.
class SimklClient {
  SimklClient(this._t, this._store);

  final JsonTransport _t;
  final SimklSessionStore _store;

  Map<String, String> _headers({String? token, required bool authed}) {
    final headers = {'simkl-api-key': simklClientId};
    final bearer = token ?? (authed ? _store.read()?.accessToken : null);
    if (bearer != null) headers['Authorization'] = 'Bearer $bearer';
    return headers;
  }

  String _url(String path) {
    final sep = path.contains('?') ? '&' : '?';
    return '$simklApiBase$path$sep'
        'client_id=$simklClientId&app-name=$simklAppName'
        '&app-version=$simklAppVersion';
  }

  /// Issues a request and returns the decoded JSON body (or null for 204).
  /// Throws [SimklApiError] on 401 (clearing the session) or any other non-2xx.
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    bool authed = true,
    String? token,
  }) async {
    if (authed && token == null) await _store.ensureHydrated();
    final headers = _headers(token: token, authed: authed);
    final url = _url(path);
    final res = method == 'GET'
        ? await _t.getJson(url, headers: headers)
        : await _t.postJson(url, body: body, headers: headers);

    if (res.statusCode == 401 && authed && token == null) {
      await _store.write(null);
      throw SimklApiError(401, 'unauthorized');
    }
    if (res.statusCode == 204) return null;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw SimklApiError(res.statusCode, res.data?.toString() ?? '');
    }
    return res.data;
  }

  /// The signed-in user's display name (`/users/settings`), or null. Accepts an
  /// explicit [token] since it runs before the session is stored during auth.
  Future<String?> fetchUsername(String token) async {
    try {
      final data = await request(
        '/users/settings',
        method: 'POST',
        token: token,
      );
      if (data is Map && data['user'] is Map) {
        final name = (data['user'] as Map)['name'];
        return name is String ? name : null;
      }
      return null;
    } on SimklApiError {
      return null;
    }
  }

  /// The signed-in user's avatar (`/users/settings` → `user.avatar`), or null.
  /// Uses the stored session token. Ported from web `fetchSimklAvatar`.
  Future<String?> fetchAvatar() async {
    try {
      final data = await request('/users/settings', method: 'POST');
      if (data is Map && data['user'] is Map) {
        final avatar = (data['user'] as Map)['avatar'];
        return avatar is String && avatar.isNotEmpty ? avatar : null;
      }
      return null;
    } on SimklApiError {
      return null;
    }
  }

  /// The account's items for a list [status] (`/sync/all-items/all/<status>`),
  /// across movies, shows and anime. Empty on error. Ports `fetchByStatus`.
  Future<List<SimklWatchItem>> _fetchByStatus(String status) async {
    try {
      final data = await request('/sync/all-items/all/$status');
      if (data is! Map) return const [];
      final movies = data['movies'] is List ? data['movies'] as List : const [];
      final shows = [
        ...(data['shows'] is List ? data['shows'] as List : const []),
        ...(data['anime'] is List ? data['anime'] as List : const []),
      ];
      return [
        for (final e in movies) ?SimklWatchItem.fromEntry(e, 'movie'),
        for (final e in shows) ?SimklWatchItem.fromEntry(e, 'show'),
      ];
    } on SimklApiError {
      return const [];
    }
  }

  /// The plan-to-watch list. Ports `fetchWatchlist`.
  Future<List<SimklWatchItem>> fetchWatchlist() =>
      _fetchByStatus('plantowatch');

  /// The currently-watching list. Ports `fetchWatchingItems`.
  Future<List<SimklWatchItem>> fetchWatching() => _fetchByStatus('watching');

  /// In-progress playback sessions as external Continue-Watching entries, so a
  /// title you're mid-way through on Simkl shows in Harbor's CW shelf. Ports web
  /// `fetchSimklPlaybackItems` — GET `/sync/playback` (hide watched, cap 40).
  /// Empty on any failure.
  Future<List<LocalCwEntry>> fetchPlaybackItems() async {
    try {
      final data = await request('/sync/playback?hide_watched=true&limit=40');
      return data is List ? parseSimklPlayback(data) : const [];
    } on SimklApiError {
      return const [];
    } catch (_) {
      return const [];
    }
  }

  static int _added(Object? r, String key) {
    if (r is Map && r['added'] is Map) {
      final v = (r['added'] as Map)[key];
      if (v is num) return v.toInt();
    }
    return 0;
  }

  /// Adds a movie/episode/show to the watched history (`/sync/history`). Ports
  /// `addToHistory`.
  Future<bool> addToHistory(SimklTarget target) async {
    final watchedAt = DateTime.now().toUtc().toIso8601String();
    try {
      switch (target) {
        case SimklMovieTarget(:final ids):
          final r = await request(
            '/sync/history',
            method: 'POST',
            body: {
              'movies': [
                {'ids': ids.toJson(), 'watched_at': watchedAt},
              ],
            },
          );
          return _added(r, 'movies') > 0;
        case SimklEpisodeTarget(:final showIds, :final season, :final number):
          final r = await request(
            '/sync/history',
            method: 'POST',
            body: {
              'shows': [
                {
                  'ids': showIds.toJson(),
                  'seasons': [
                    {
                      'number': season,
                      'episodes': [
                        {'number': number, 'watched_at': watchedAt},
                      ],
                    },
                  ],
                },
              ],
            },
          );
          return _added(r, 'episodes') > 0 || _added(r, 'shows') > 0;
        case SimklShowTarget(:final ids):
          final r = await request(
            '/sync/history',
            method: 'POST',
            body: {
              'shows': [
                {'ids': ids.toJson(), 'watched_at': watchedAt},
              ],
            },
          );
          return _added(r, 'shows') > 0;
      }
    } on SimklApiError {
      return false;
    }
  }

  /// Adds a target to the plan-to-watch list (`/sync/add-to-list`). Ports
  /// `addToWatchlist`.
  Future<bool> addToWatchlist(SimklTarget target) async {
    try {
      final (key, ids) = _keyIds(target);
      await request(
        '/sync/add-to-list',
        method: 'POST',
        body: {
          key: [
            {'to': 'plantowatch', 'ids': ids.toJson()},
          ],
        },
      );
      return true;
    } on SimklApiError {
      return false;
    }
  }

  /// Removes a target from the lists (`/sync/history/remove` — a Simkl quirk).
  /// Ports `removeFromWatchlist`.
  Future<bool> removeFromWatchlist(SimklTarget target) async {
    try {
      final (key, ids) = _keyIds(target);
      await request(
        '/sync/history/remove',
        method: 'POST',
        body: {
          key: [
            {'ids': ids.toJson()},
          ],
        },
      );
      return true;
    } on SimklApiError {
      return false;
    }
  }

  /// Sets [target]'s watch status on Simkl (`/sync/add-to-list`), returning the
  /// status Simkl echoed back (falling back to [status]). Generalises
  /// [addToWatchlist] to an arbitrary status. Ports `setSimklStatus`.
  Future<String> setListStatus(SimklTarget target, String status) async {
    final (key, ids) = _keyIds(target);
    final data = await request(
      '/sync/add-to-list',
      method: 'POST',
      body: {
        'to': status,
        key: [
          {'to': status, 'ids': ids.toJson()},
        ],
      },
    );
    final added = data is Map ? data['added'] : null;
    final list = added is Map ? added[key] : null;
    final echoed = (list is List && list.isNotEmpty && list.first is Map)
        ? (list.first as Map)['to']?.toString()
        : null;
    return simklIsStatus(echoed) ? echoed! : status;
  }

  /// Loads the user's whole Simkl list as an id→status map, so the detail page
  /// can show a title's current status. GET `/sync/all-items` with the ids of
  /// every entry. Empty on any failure. Ports `loadSimklStatusMap`.
  Future<Map<String, String>> fetchListStatusMap() async {
    final dynamic data;
    try {
      data = await request(
        '/sync/all-items/all/all?extended=full&episode_watched_at=yes',
      );
    } catch (_) {
      return const {};
    }
    if (data is! Map) return const {};
    final out = <String, String>{};
    void add(Object? entries, {required bool movie}) {
      if (entries is! List) return;
      for (final e in entries) {
        if (e is! Map) continue;
        final status = e['status']?.toString();
        if (!simklIsStatus(status)) continue;
        final node = movie ? e['movie'] : e['show'];
        final ids = node is Map ? node['ids'] : null;
        if (ids is! Map) continue;
        for (final k in simklIdKeys(ids, movie: movie)) {
          out[k] = status!;
        }
      }
    }

    add(data['movies'], movie: true);
    add(data['shows'], movie: false);
    add(data['anime'], movie: false);
    return out;
  }

  (String, SimklIds) _keyIds(SimklTarget target) => switch (target) {
    SimklMovieTarget(:final ids) => ('movies', ids),
    SimklShowTarget(:final ids) => ('shows', ids),
    SimklEpisodeTarget(:final showIds) => ('shows', showIds),
  };

  /// Sends a scrobble (`/scrobble/{action}`) with a pre-built body. Best-effort.
  /// Ports `simklScrobble`.
  Future<void> scrobble(String action, Map<String, dynamic> body) async {
    try {
      await request('/scrobble/$action', method: 'POST', body: body);
    } on SimklApiError {
      // Best-effort — scrobbling never blocks playback.
    }
  }
}

/// The valid Simkl watchlist statuses (ports the web `isStatus` guard).
bool simklIsStatus(String? s) =>
    s == 'watching' ||
    s == 'plantowatch' ||
    s == 'hold' ||
    s == 'completed' ||
    s == 'dropped';

/// The lookup keys a Simkl list entry is indexed under, from its raw id map —
/// ports the web `idKeys`. `imdb` is the bare `tt…`, TMDB is namespaced by kind,
/// and the anime ids carry their own prefixes.
List<String> simklIdKeys(Map<dynamic, dynamic> ids, {required bool movie}) {
  final keys = <String>[];
  final imdb = ids['imdb'];
  if (imdb is String && imdb.isNotEmpty) keys.add(imdb);
  final tmdb = ids['tmdb'];
  if (tmdb != null) keys.add(movie ? 'tmdb:movie:$tmdb' : 'tmdb:tv:$tmdb');
  final mal = ids['mal'];
  if (mal != null) keys.add('mal:$mal');
  final kitsu = ids['kitsu'];
  if (kitsu != null) keys.add('kitsu:$kitsu');
  final anilist = ids['anilist'];
  if (anilist != null) keys.add('anilist:$anilist');
  final anidb = ids['anidb'];
  if (anidb != null) keys.add('anidb:$anidb');
  return keys;
}
