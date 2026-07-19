/// A stored Trakt OAuth session. [createdAt]/[expiresIn] are epoch **seconds**
/// (matching Trakt's `created_at`/`expires_in`), so token validity can be
/// computed without a separate expiry timestamp. Ported from `trakt/types.ts`.
class TraktSession {
  const TraktSession({
    required this.accessToken,
    required this.refreshToken,
    required this.createdAt,
    required this.expiresIn,
    this.username,
  });

  final String accessToken;
  final String refreshToken;
  final int createdAt;
  final int expiresIn;
  final String? username;

  TraktSession copyWith({String? username}) => TraktSession(
    accessToken: accessToken,
    refreshToken: refreshToken,
    createdAt: createdAt,
    expiresIn: expiresIn,
    username: username ?? this.username,
  );

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'createdAt': createdAt,
    'expiresIn': expiresIn,
    'username': username,
  };

  /// Parses a stored session, or null when any required field is missing or the
  /// wrong type (mirroring the web's strict validation).
  static TraktSession? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final access = raw['accessToken'];
    final refresh = raw['refreshToken'];
    final created = raw['createdAt'];
    final expires = raw['expiresIn'];
    if (access is! String ||
        refresh is! String ||
        created is! num ||
        expires is! num) {
      return null;
    }
    final username = raw['username'];
    return TraktSession(
      accessToken: access,
      refreshToken: refresh,
      createdAt: created.toInt(),
      expiresIn: expires.toInt(),
      username: username is String ? username : null,
    );
  }
}

/// The cross-service ids Trakt accepts for a title. Ported from `TraktIds`.
class TraktIds {
  const TraktIds({this.trakt, this.slug, this.imdb, this.tmdb, this.tvdb});

  final int? trakt;
  final String? slug;
  final String? imdb;
  final int? tmdb;
  final int? tvdb;

  bool get isEmpty =>
      trakt == null &&
      slug == null &&
      imdb == null &&
      tmdb == null &&
      tvdb == null;

  Map<String, dynamic> toJson() => {
    if (trakt != null) 'trakt': trakt,
    if (slug != null) 'slug': slug,
    if (imdb != null) 'imdb': imdb,
    if (tmdb != null) 'tmdb': tmdb,
    if (tvdb != null) 'tvdb': tvdb,
  };

  static TraktIds fromRaw(Object? raw) {
    final m = raw is Map ? raw : const {};
    return TraktIds(
      trakt: (m['trakt'] as num?)?.toInt(),
      slug: m['slug'] is String ? m['slug'] as String : null,
      imdb: m['imdb'] is String ? m['imdb'] as String : null,
      tmdb: (m['tmdb'] as num?)?.toInt(),
      tvdb: (m['tvdb'] as num?)?.toInt(),
    );
  }
}

/// An upcoming episode from Trakt's calendar (`/calendars/my/shows`). Ported
/// from `CalendarEpisode`.
class TraktUpcomingEpisode {
  const TraktUpcomingEpisode({
    required this.showTitle,
    this.showYear,
    required this.ids,
    required this.airDate,
    required this.season,
    required this.number,
    this.episodeTitle,
  });

  final String showTitle;
  final int? showYear;
  final TraktIds ids; // the show's ids
  final String airDate;
  final int season;
  final int number;
  final String? episodeTitle;

  static TraktUpcomingEpisode? fromRow(Object? raw) {
    if (raw is! Map) return null;
    final show = raw['show'];
    final ep = raw['episode'];
    if (show is! Map || ep is! Map) return null;
    return TraktUpcomingEpisode(
      showTitle: (show['title'] ?? '').toString(),
      showYear: (show['year'] as num?)?.toInt(),
      ids: TraktIds.fromRaw(show['ids']),
      airDate: (raw['first_aired'] ?? '').toString(),
      season: (ep['season'] as num?)?.toInt() ?? 0,
      number: (ep['number'] as num?)?.toInt() ?? 0,
      episodeTitle: ep['title'] is String ? ep['title'] as String : null,
    );
  }
}

/// An upcoming movie from Trakt's calendar (`/calendars/my/movies`).
class TraktUpcomingMovie {
  const TraktUpcomingMovie({
    required this.title,
    this.year,
    required this.ids,
    required this.released,
  });

  final String title;
  final int? year;
  final TraktIds ids;
  final String released;

  static TraktUpcomingMovie? fromRow(Object? raw) {
    if (raw is! Map) return null;
    final movie = raw['movie'];
    if (movie is! Map) return null;
    return TraktUpcomingMovie(
      title: (movie['title'] ?? '').toString(),
      year: (movie['year'] as num?)?.toInt(),
      ids: TraktIds.fromRaw(movie['ids']),
      released: (raw['released'] ?? '').toString(),
    );
  }
}

String _date10(String s) => s.length >= 10 ? s.substring(0, 10) : s;

/// An anticipated (most-listed, unreleased) show (`/shows/anticipated`). Ported
/// from `AnticipatedShow`. Rows without a `first_aired` are dropped.
class TraktAnticipatedShow {
  const TraktAnticipatedShow({
    required this.title,
    this.year,
    required this.ids,
    required this.firstAired,
    this.overview = '',
  });

  final String title;
  final int? year;
  final TraktIds ids;
  final String firstAired;
  final String overview;

  static TraktAnticipatedShow? fromRow(Object? raw) {
    if (raw is! Map) return null;
    final show = raw['show'];
    if (show is! Map) return null;
    final firstAired = show['first_aired'];
    if (firstAired is! String || firstAired.isEmpty) return null;
    return TraktAnticipatedShow(
      title: (show['title'] ?? '').toString(),
      year: (show['year'] as num?)?.toInt(),
      ids: TraktIds.fromRaw(show['ids']),
      firstAired: _date10(firstAired),
      overview: show['overview'] is String ? show['overview'] as String : '',
    );
  }
}

/// An anticipated movie (`/movies/anticipated`). Ported from `AnticipatedMovie`.
/// Rows without a `released` date are dropped.
class TraktAnticipatedMovie {
  const TraktAnticipatedMovie({
    required this.title,
    this.year,
    required this.ids,
    required this.released,
    this.overview = '',
  });

  final String title;
  final int? year;
  final TraktIds ids;
  final String released;
  final String overview;

  static TraktAnticipatedMovie? fromRow(Object? raw) {
    if (raw is! Map) return null;
    final movie = raw['movie'];
    if (movie is! Map) return null;
    final released = movie['released'];
    if (released is! String || released.isEmpty) return null;
    return TraktAnticipatedMovie(
      title: (movie['title'] ?? '').toString(),
      year: (movie['year'] as num?)?.toInt(),
      ids: TraktIds.fromRaw(movie['ids']),
      released: _date10(released),
      overview: movie['overview'] is String ? movie['overview'] as String : '',
    );
  }
}

/// A resolved Trakt write target — a movie, a whole show, or one episode.
/// Ported from the `TraktTarget` union.
sealed class TraktTarget {
  const TraktTarget();
}

class TraktMovieTarget extends TraktTarget {
  const TraktMovieTarget(this.ids);
  final TraktIds ids;
}

class TraktShowTarget extends TraktTarget {
  const TraktShowTarget(this.ids);
  final TraktIds ids;
}

class TraktEpisodeTarget extends TraktTarget {
  const TraktEpisodeTarget({
    required this.showIds,
    required this.season,
    required this.number,
  });
  final TraktIds showIds;
  final int season;
  final int number;
}

final _ttIdRe = RegExp(r'^tt\d+$');

/// A row from the account's Trakt watchlist (`/sync/watchlist`). Ported from the
/// web `TraktItem` + `traktItemToStremioId`.
class TraktWatchItem {
  const TraktWatchItem({
    required this.type,
    required this.title,
    this.year,
    required this.ids,
  });

  final String type; // 'movie' | 'show'
  final String title;
  final int? year;
  final TraktIds ids;

  /// The type as Stremio names it.
  String get stremioType => type == 'show' ? 'series' : 'movie';

  /// The Stremio meta id — IMDb first, else `tmdb:tv|movie:<id>`, else null.
  /// Ports `traktItemToStremioId`.
  String? get stremioId {
    final imdb = ids.imdb;
    if (imdb != null && _ttIdRe.hasMatch(imdb)) return imdb;
    final tmdb = ids.tmdb;
    if (tmdb != null) return 'tmdb:${type == 'show' ? 'tv' : 'movie'}:$tmdb';
    return null;
  }

  /// Parses a raw `/sync/watchlist` row (`{type, movie|show:{title,year,ids}}`),
  /// or null when it isn't a movie/show entry.
  static TraktWatchItem? fromRow(Object? raw) {
    if (raw is! Map) return null;
    final type = raw['type'];
    if (type != 'movie' && type != 'show') return null;
    final node = raw[type];
    if (node is! Map) return null;
    final idsMap = node['ids'] is Map
        ? (node['ids'] as Map)
        : const <dynamic, dynamic>{};
    return TraktWatchItem(
      type: type as String,
      title: (node['title'] ?? '').toString(),
      year: (node['year'] as num?)?.toInt(),
      ids: TraktIds(
        imdb: idsMap['imdb'] is String ? idsMap['imdb'] as String : null,
        tmdb: (idsMap['tmdb'] as num?)?.toInt(),
        trakt: (idsMap['trakt'] as num?)?.toInt(),
        tvdb: (idsMap['tvdb'] as num?)?.toInt(),
        slug: idsMap['slug'] is String ? idsMap['slug'] as String : null,
      ),
    );
  }
}

/// A Trakt device-code grant (`/oauth/device/code`). Ported from `DeviceCode`.
class TraktDeviceCode {
  const TraktDeviceCode({
    required this.deviceCode,
    required this.userCode,
    required this.verificationUrl,
    required this.expiresIn,
    required this.pollIntervalSec,
  });

  final String deviceCode;
  final String userCode;
  final String verificationUrl;
  final int expiresIn;
  final int pollIntervalSec;

  static TraktDeviceCode? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final device = raw['device_code'];
    final user = raw['user_code'];
    final url = raw['verification_url'];
    if (device is! String || user is! String || url is! String) return null;
    return TraktDeviceCode(
      deviceCode: device,
      userCode: user,
      verificationUrl: url,
      expiresIn: (raw['expires_in'] as num?)?.toInt() ?? 600,
      pollIntervalSec: (raw['interval'] as num?)?.toInt() ?? 5,
    );
  }
}

/// The signed-in Trakt user (`/users/me`). Ported from `TraktUserMe`.
class TraktUserMe {
  const TraktUserMe({
    required this.username,
    required this.private,
    this.name,
    this.vip,
    this.avatar,
  });

  final String username;
  final bool private;
  final String? name;
  final bool? vip;

  /// The user's Trakt profile picture (`images.avatar.full`), when the request
  /// was made with `extended=full`/`extended=images`. Web `fetchTraktAvatar`.
  final String? avatar;

  static TraktUserMe? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final username = raw['username'];
    if (username is! String) return null;
    final images = raw['images'];
    final avatar = images is Map ? images['avatar'] : null;
    final full = avatar is Map ? avatar['full'] : null;
    return TraktUserMe(
      username: username,
      private: raw['private'] == true,
      name: raw['name'] is String ? raw['name'] as String : null,
      vip: raw['vip'] is bool ? raw['vip'] as bool : null,
      avatar: full is String && full.isNotEmpty ? full : null,
    );
  }
}

/// One row of the user's Trakt watched history (`/sync/history`). Ported from
/// `HistoryItem` in the web `trakt/history.ts`. A `movie` row carries the movie
/// ids/title; an `episode` row carries the show ids/title plus season/number.
class TraktHistoryItem {
  const TraktHistoryItem({
    required this.id,
    required this.watchedAt,
    required this.type,
    required this.title,
    this.year,
    this.imdb,
    this.tmdb,
    this.showImdb,
    this.showTmdb,
    this.season,
    this.number,
  });

  /// The Trakt history-entry id (unique per play, used for removal).
  final int id;
  final String watchedAt;

  /// `movie` | `episode`.
  final String type;
  final String title;
  final int? year;

  /// Movie ids (set only when [type] is `movie`).
  final String? imdb;
  final int? tmdb;

  /// Show ids (set only when [type] is `episode`).
  final String? showImdb;
  final int? showTmdb;
  final int? season;
  final int? number;

  bool get isMovie => type == 'movie';

  /// Parses a `/sync/history` row. A `movie`-typed row with a `movie` payload
  /// becomes a movie item; every other row is treated as an episode (matching
  /// the web fallthrough). Null only when the row is malformed (no id/date).
  static TraktHistoryItem? fromRow(Object? raw) {
    if (raw is! Map) return null;
    final id = (raw['id'] as num?)?.toInt();
    final watchedAt = raw['watched_at'];
    if (id == null || watchedAt is! String) return null;
    final movie = raw['movie'];
    if (raw['type'] == 'movie' && movie is Map) {
      final ids = TraktIds.fromRaw(movie['ids']);
      return TraktHistoryItem(
        id: id,
        watchedAt: watchedAt,
        type: 'movie',
        title: (movie['title'] ?? '').toString(),
        year: (movie['year'] as num?)?.toInt(),
        imdb: ids.imdb,
        tmdb: ids.tmdb,
      );
    }
    final show = raw['show'];
    final ep = raw['episode'];
    final showMap = show is Map ? show : const {};
    final epMap = ep is Map ? ep : const {};
    final showIds = TraktIds.fromRaw(showMap['ids']);
    return TraktHistoryItem(
      id: id,
      watchedAt: watchedAt,
      type: 'episode',
      title: (showMap['title'] ?? '').toString(),
      year: (showMap['year'] as num?)?.toInt(),
      showImdb: showIds.imdb,
      showTmdb: showIds.tmdb,
      season: (epMap['season'] as num?)?.toInt(),
      number: (epMap['number'] as num?)?.toInt(),
    );
  }
}

/// A Trakt comment on a title/episode, ported from web `TraktComment`
/// (`src/lib/trakt/comments.ts`). Read-only; drives the detail-page comments.
class TraktComment {
  const TraktComment({
    required this.id,
    required this.comment,
    required this.spoiler,
    required this.review,
    required this.replies,
    required this.likes,
    required this.createdAt,
    required this.userRating,
    required this.username,
    required this.name,
    required this.avatar,
  });

  final int id;
  final String comment;
  final bool spoiler;
  final bool review;
  final int replies;
  final int likes;
  final String createdAt;
  final int? userRating;
  final String username;
  final String? name;
  final String? avatar;

  static TraktComment? fromRow(dynamic r) {
    if (r is! Map) return null;
    final user = r['user'];
    final userMap = user is Map ? user : const {};
    final images = userMap['images'];
    final avatarObj = images is Map ? images['avatar'] : null;
    final avatar = avatarObj is Map ? avatarObj['full']?.toString() : null;
    final stats = r['user_stats'];
    final username = userMap['username']?.toString() ?? '';
    if (username.isEmpty) return null;
    return TraktComment(
      id: (r['id'] as num?)?.toInt() ?? 0,
      comment: r['comment']?.toString() ?? '',
      spoiler: r['spoiler'] == true,
      review: r['review'] == true,
      replies: (r['replies'] as num?)?.toInt() ?? 0,
      likes: (r['likes'] as num?)?.toInt() ?? 0,
      createdAt: r['created_at']?.toString() ?? '',
      userRating: stats is Map ? (stats['rating'] as num?)?.toInt() : null,
      username: username,
      name: userMap['name']?.toString(),
      avatar: avatar,
    );
  }
}
