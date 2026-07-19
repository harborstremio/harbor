import 'dart:async';

import '../../core/http/json_transport.dart';
import 'trakt_config.dart';
import 'trakt_session_store.dart';
import 'trakt_types.dart';

/// A non-2xx Trakt response. Ported from `TraktApiError`.
class TraktApiError implements Exception {
  TraktApiError(this.status, this.body);
  final int status;
  final String body;
  @override
  String toString() {
    final b = body.length > 200 ? body.substring(0, 200) : body;
    return 'Trakt HTTP $status: $b';
  }
}

/// The authenticated Trakt API client. Adds the `trakt-api-key`/version headers
/// and the bearer token, and on a 401 refreshes the access token once (through
/// Harbor's token proxy) and retries. 429/5xx backoff is handled by the
/// underlying [JsonTransport]. Ported from `trakt/client.ts`.
class TraktClient {
  TraktClient(
    this._t,
    this._store, {
    this.scrobbleRetryDelay = const Duration(milliseconds: 800),
  });

  final JsonTransport _t;
  final TraktSessionStore _store;

  /// The one-shot retry delay after a failed `stop` scrobble (the web waits
  /// 800ms so a stop lands even if the network hiccuped at teardown).
  final Duration scrobbleRetryDelay;

  Map<String, String> _baseHeaders() => {
    'trakt-api-version': traktApiVersion,
    'trakt-api-key': traktClientId,
  };

  Future<JsonResponse> _send(
    String path,
    String method,
    Object? body,
    bool authed,
  ) async {
    final headers = _baseHeaders();
    if (authed) {
      await _store.ensureHydrated();
      final session = _store.read();
      if (session != null) {
        headers['Authorization'] = 'Bearer ${session.accessToken}';
      }
    }
    final url = '$traktApiBase$path';
    return switch (method) {
      'GET' => _t.getJson(url, headers: headers),
      'DELETE' => _t.deleteJson(url, headers: headers),
      _ => _t.postJson(url, body: body, headers: headers),
    };
  }

  Completer<TraktSession?>? _inflightRefresh;

  /// Refreshes the access token via the proxy, de-duping concurrent refreshes.
  /// On failure the session is cleared (matching the web).
  Future<TraktSession?> _ensureRefreshed() {
    final inflight = _inflightRefresh;
    if (inflight != null) return inflight.future;
    final completer = Completer<TraktSession?>();
    _inflightRefresh = completer;
    _refresh()
        .then(completer.complete)
        .catchError((Object e, StackTrace s) => completer.completeError(e, s))
        .whenComplete(() => _inflightRefresh = null);
    return completer.future;
  }

  Future<TraktSession?> _refresh() async {
    await _store.ensureHydrated();
    final current = _store.read();
    if (current == null) return null;
    final JsonResponse res;
    try {
      res = await _t.postJson(
        traktTokenProxy,
        body: {
          'refresh_token': current.refreshToken,
          'grant_type': 'refresh_token',
        },
        headers: _baseHeaders(),
      );
    } on TransportException {
      return null;
    }
    if (res.statusCode < 200 || res.statusCode >= 300 || res.data is! Map) {
      await _store.write(null);
      return null;
    }
    final data = res.data as Map;
    final access = data['access_token'];
    final refresh = data['refresh_token'];
    if (access is! String || refresh is! String) {
      await _store.write(null);
      return null;
    }
    final next = TraktSession(
      accessToken: access,
      refreshToken: refresh,
      createdAt:
          (data['created_at'] as num?)?.toInt() ??
          DateTime.now().millisecondsSinceEpoch ~/ 1000,
      expiresIn: (data['expires_in'] as num?)?.toInt() ?? 0,
      username: current.username,
    );
    await _store.write(next);
    return next;
  }

  /// Issues a request and returns the decoded JSON body (or null for 204).
  /// Throws [TraktApiError] on a non-2xx (post-refresh) response.
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Object? body,
    bool authed = true,
  }) async {
    var res = await _send(path, method, body, authed);
    if (res.statusCode == 401 && authed) {
      final refreshed = await _ensureRefreshed();
      if (refreshed != null) res = await _send(path, method, body, authed);
    }
    if (res.statusCode == 204) return null;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw TraktApiError(res.statusCode, res.data?.toString() ?? '');
    }
    return res.data;
  }

  /// The signed-in user (`/users/me`), or null when not authenticated.
  Future<TraktUserMe?> getUserMe() async {
    try {
      return TraktUserMe.fromJson(await request('/users/me?extended=full'));
    } on TraktApiError {
      return null;
    }
  }

  /// Public comments for a title or episode (`/{movies|shows}/{id}[/seasons/{s}
  /// /episodes/{e}]/comments/{sort}`), most-liked first. A public read (no user
  /// token needed); empty on any error. Ports web `fetchComments`.
  Future<List<TraktComment>> fetchComments({
    required String type,
    required String id,
    int? season,
    int? episode,
    String sort = 'likes',
    int limit = 20,
  }) async {
    if (id.isEmpty) return const [];
    // Encode the id — it originates from third-party addon metadata, so a raw
    // '?'/'#'/'../' would otherwise reshape the request path or inject query
    // params against api.trakt.tv.
    final safeId = Uri.encodeComponent(id);
    final base = type == 'movie' ? '/movies/$safeId' : '/shows/$safeId';
    final path = (season != null && episode != null)
        ? '$base/seasons/$season/episodes/$episode/comments/$sort'
        : '$base/comments/$sort';
    try {
      final rows = await request(
        '$path?extended=images&page=1&limit=$limit',
        authed: false,
      );
      if (rows is! List) return const [];
      return [for (final r in rows) ?TraktComment.fromRow(r)];
    } on TraktApiError {
      return const [];
    }
  }

  /// Posts a comment on a movie/show [target] (`POST /comments`; Trakt requires
  /// at least five words), returning the created comment or null on failure.
  /// Ports web `postComment`. Episode targets aren't supported here.
  Future<TraktComment?> postComment(
    TraktTarget target,
    String comment, {
    bool spoiler = false,
  }) async {
    final (key, ids) = switch (target) {
      TraktMovieTarget(:final ids) => ('movie', ids),
      TraktShowTarget(:final ids) => ('show', ids),
      TraktEpisodeTarget() => ('', const TraktIds()),
    };
    if (key.isEmpty || ids.isEmpty) return null;
    try {
      final raw = await request(
        '/comments?extended=images',
        method: 'POST',
        body: {
          'comment': comment,
          'spoiler': spoiler,
          'review': false,
          'share': false,
          key: {
            'ids': {
              if (ids.tmdb != null) 'tmdb': ids.tmdb,
              if (ids.imdb != null) 'imdb': ids.imdb,
            },
          },
        },
      );
      return TraktComment.fromRow(raw);
    } on TraktApiError {
      return null;
    }
  }

  /// Likes a comment (`POST /comments/{id}/like`). Ports web `likeComment`.
  Future<bool> likeComment(int id) async {
    try {
      await request('/comments/$id/like', method: 'POST');
      return true;
    } on TraktApiError {
      return false;
    }
  }

  /// Removes a like from a comment (`DELETE /comments/{id}/like`). Ports web
  /// `unlikeComment`.
  Future<bool> unlikeComment(int id) async {
    try {
      await request('/comments/$id/like', method: 'DELETE');
      return true;
    } on TraktApiError {
      return false;
    }
  }

  /// Deletes the signed-in user's own comment (`DELETE /comments/{id}`). Ports
  /// web `deleteComment`.
  Future<bool> deleteComment(int id) async {
    try {
      await request('/comments/$id', method: 'DELETE');
      return true;
    } on TraktApiError {
      return false;
    }
  }

  /// The account's watchlist (`/sync/watchlist`), newest first. Empty on error.
  /// Ports `fetchWatchlist`.
  Future<List<TraktWatchItem>> fetchWatchlist() async {
    try {
      final rows = await request('/sync/watchlist?sort_by=added&sort_how=desc');
      if (rows is! List) return const [];
      return [for (final r in rows) ?TraktWatchItem.fromRow(r)];
    } on TraktApiError {
      return const [];
    }
  }

  /// Personalized movie recommendations (`/recommendations/movies`), already
  /// collection-filtered. Empty on error. Ports `fetchMovieRecommendations`.
  Future<List<TraktWatchItem>> fetchMovieRecommendations() =>
      _fetchRecommendations('movie');

  /// Personalized show recommendations (`/recommendations/shows`). Empty on
  /// error. Ports `fetchShowRecommendations`.
  Future<List<TraktWatchItem>> fetchShowRecommendations() =>
      _fetchRecommendations('show');

  Future<List<TraktWatchItem>> _fetchRecommendations(String type) async {
    // The recommendations endpoints return a flat array of movie/show objects
    // ({title, year, ids}) rather than the `{type, movie|show:{…}}` envelope the
    // sync endpoints use, so build the items with the caller's [type].
    final path = type == 'show' ? 'shows' : 'movies';
    try {
      final rows = await request(
        '/recommendations/$path?limit=40&ignore_collected=true',
      );
      if (rows is! List) return const [];
      final out = <TraktWatchItem>[];
      for (final r in rows) {
        if (r is! Map) continue;
        out.add(
          TraktWatchItem(
            type: type,
            title: (r['title'] ?? '').toString(),
            year: (r['year'] as num?)?.toInt(),
            ids: TraktIds.fromRaw(r['ids']),
          ),
        );
      }
      return out;
    } on TraktApiError {
      return const [];
    }
  }

  /// The account's watched history (`/sync/history`), newest first, up to [limit]
  /// rows. Empty on any error — history is a non-critical read. Ports
  /// `fetchWatchedHistory`.
  Future<List<TraktHistoryItem>> fetchWatchedHistory({int limit = 200}) async {
    try {
      final rows = await request('/sync/history?limit=$limit');
      if (rows is! List) return const [];
      return [for (final r in rows) ?TraktHistoryItem.fromRow(r)];
    } catch (_) {
      return const [];
    }
  }

  /// The set of "already watched" keys over the last 1000 history rows: for a
  /// movie, `imdb:<id>` and/or `tmdb:<id>`; for an episode,
  /// `imdb:<showId>:<season>:<number>` and/or the `tmdb:` equivalent. The lookup
  /// the next-up/continue rails use to hide finished titles. Ports
  /// `fetchWatchedKeySet`.
  Future<Set<String>> fetchWatchedKeySet() async {
    final rows = await fetchWatchedHistory(limit: 1000);
    final set = <String>{};
    // Match the web's JS truthiness (`if (r.imdb)`): skip empty-string / zero
    // ids so a non-standard payload never yields a bogus `imdb:` / `tmdb:0` key.
    for (final r in rows) {
      if (r.isMovie) {
        final imdb = r.imdb;
        if (imdb != null && imdb.isNotEmpty) set.add('imdb:$imdb');
        if (r.tmdb != null && r.tmdb != 0) set.add('tmdb:${r.tmdb}');
      } else if (r.season != null && r.number != null) {
        final showImdb = r.showImdb;
        if (showImdb != null && showImdb.isNotEmpty) {
          set.add('imdb:$showImdb:${r.season}:${r.number}');
        }
        if (r.showTmdb != null && r.showTmdb != 0) {
          set.add('tmdb:${r.showTmdb}:${r.season}:${r.number}');
        }
      }
    }
    return set;
  }

  /// The user's upcoming episodes (`/calendars/my/shows/<today>/<days>`), from
  /// [todayIso] over [days]. Empty on error. Ports `fetchUpcomingEpisodes`.
  Future<List<TraktUpcomingEpisode>> fetchUpcomingEpisodes({
    required String todayIso,
    int days = 14,
  }) async {
    try {
      final rows = await request('/calendars/my/shows/$todayIso/$days');
      if (rows is! List) return const [];
      return [for (final r in rows) ?TraktUpcomingEpisode.fromRow(r)];
    } on TraktApiError {
      return const [];
    }
  }

  /// The user's upcoming movies (`/calendars/my/movies/<today>/<days>`). Empty
  /// on error. Ports `fetchUpcomingMovies`.
  Future<List<TraktUpcomingMovie>> fetchUpcomingMovies({
    required String todayIso,
    int days = 30,
  }) async {
    try {
      final rows = await request('/calendars/my/movies/$todayIso/$days');
      if (rows is! List) return const [];
      return [for (final r in rows) ?TraktUpcomingMovie.fromRow(r)];
    } on TraktApiError {
      return const [];
    }
  }

  /// The most-anticipated unreleased shows (`/shows/anticipated`, unauthed).
  /// Empty on error. Ports `fetchAnticipatedShows`.
  Future<List<TraktAnticipatedShow>> fetchAnticipatedShows() async {
    try {
      final rows = await request(
        '/shows/anticipated?extended=full&limit=100',
        authed: false,
      );
      if (rows is! List) return const [];
      return [for (final r in rows) ?TraktAnticipatedShow.fromRow(r)];
    } on TraktApiError {
      return const [];
    }
  }

  /// The most-anticipated unreleased movies (`/movies/anticipated`, unauthed).
  /// Empty on error. Ports `fetchAnticipatedMovies`.
  Future<List<TraktAnticipatedMovie>> fetchAnticipatedMovies() async {
    try {
      final rows = await request(
        '/movies/anticipated?extended=full&limit=100',
        authed: false,
      );
      if (rows is! List) return const [];
      return [for (final r in rows) ?TraktAnticipatedMovie.fromRow(r)];
    } on TraktApiError {
      return const [];
    }
  }

  /// Adds a movie/episode to the watched history (`/sync/history`). A whole-show
  /// target is a no-op (history is per movie/episode). Ports `pushWatched`.
  Future<bool> pushWatched(TraktTarget target) async {
    try {
      switch (target) {
        case TraktMovieTarget(:final ids):
          await request(
            '/sync/history',
            method: 'POST',
            body: {
              'movies': [
                {'ids': ids.toJson()},
              ],
            },
          );
          return true;
        case TraktEpisodeTarget(:final showIds, :final season, :final number):
          await request(
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
                        {'number': number},
                      ],
                    },
                  ],
                },
              ],
            },
          );
          return true;
        case TraktShowTarget():
          return false;
      }
    } on TraktApiError {
      return false;
    }
  }

  /// Adds a target to the watchlist (`/sync/watchlist`). Ports `addToWatchlist`.
  Future<bool> addToWatchlist(TraktTarget target) =>
      _watchlistWrite('/sync/watchlist', target);

  /// Removes a target from the watchlist (`/sync/watchlist/remove`). Ports
  /// `removeFromWatchlist`.
  Future<bool> removeFromWatchlist(TraktTarget target) =>
      _watchlistWrite('/sync/watchlist/remove', target);

  Future<bool> _watchlistWrite(String path, TraktTarget target) async {
    try {
      final (key, ids) = switch (target) {
        TraktMovieTarget(:final ids) => ('movies', ids),
        TraktShowTarget(:final ids) => ('shows', ids),
        TraktEpisodeTarget(:final showIds) => ('shows', showIds),
      };
      await request(
        path,
        method: 'POST',
        body: {
          key: [
            {'ids': ids.toJson()},
          ],
        },
      );
      return true;
    } on TraktApiError {
      return false;
    }
  }

  Future<void> scrobbleStart(TraktTarget target, double progress) =>
      _scrobble('start', target, progress);

  Future<void> scrobblePause(TraktTarget target, double progress) =>
      _scrobble('pause', target, progress);

  Future<void> scrobbleStop(TraktTarget target, double progress) =>
      _scrobble('stop', target, progress);

  /// Sends a scrobble (`/scrobble/{action}`). A whole-show target is a no-op.
  /// A failed `stop` is retried once after [scrobbleRetryDelay]. Ports the
  /// `scrobble.ts` `send`.
  Future<void> _scrobble(
    String action,
    TraktTarget target,
    double progress,
  ) async {
    if (target is TraktShowTarget) return;
    final body = _scrobbleBody(target, progress);
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await request('/scrobble/$action', method: 'POST', body: body);
        return;
      } on TraktApiError {
        if (attempt == 0 && action == 'stop') {
          await Future.delayed(scrobbleRetryDelay);
          continue;
        }
        return;
      }
    }
  }

  Map<String, dynamic> _scrobbleBody(TraktTarget target, double progress) {
    final clamped = double.parse(progress.clamp(0, 100).toStringAsFixed(2));
    return switch (target) {
      TraktMovieTarget(:final ids) => {
        'movie': {'ids': ids.toJson()},
        'progress': clamped,
      },
      TraktEpisodeTarget(:final showIds, :final season, :final number) => {
        'show': {'ids': showIds.toJson()},
        'episode': {'season': season, 'number': number},
        'progress': clamped,
      },
      TraktShowTarget(:final ids) => {
        'show': {'ids': ids.toJson()},
        'progress': clamped,
      },
    };
  }
}
