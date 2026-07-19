/// A stored Simkl session. Simkl access tokens do not expire, so there is no
/// refresh token or expiry. Ported from `simkl/types.ts` `SimklSession`.
class SimklSession {
  const SimklSession({required this.accessToken, this.username});

  final String accessToken;
  final String? username;

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'username': username,
  };

  static SimklSession? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final access = raw['accessToken'];
    if (access is! String || access.isEmpty) return null;
    final username = raw['username'];
    return SimklSession(
      accessToken: access,
      username: username is String ? username : null,
    );
  }
}

/// The cross-service ids Simkl accepts. Ported from `SimklIds`.
class SimklIds {
  const SimklIds({
    this.simkl,
    this.imdb,
    this.tmdb,
    this.tvdb,
    this.mal,
    this.anidb,
    this.kitsu,
  });

  final int? simkl;
  final String? imdb;
  final int? tmdb;
  final int? tvdb;
  final int? mal;
  final int? anidb;
  final int? kitsu;

  bool get isEmpty =>
      simkl == null &&
      imdb == null &&
      tmdb == null &&
      tvdb == null &&
      mal == null &&
      anidb == null &&
      kitsu == null;

  Map<String, dynamic> toJson() => {
    if (simkl != null) 'simkl': simkl,
    if (imdb != null) 'imdb': imdb,
    if (tmdb != null) 'tmdb': tmdb,
    if (tvdb != null) 'tvdb': tvdb,
    if (mal != null) 'mal': mal,
    if (anidb != null) 'anidb': anidb,
    if (kitsu != null) 'kitsu': kitsu,
  };
}

/// A resolved Simkl write target — a movie, a whole show, or one episode. (The
/// anime/anime-episode kinds come only from MAL id resolution and aren't built
/// yet.) Ported from the `SimklTarget` union.
sealed class SimklTarget {
  const SimklTarget();
}

class SimklMovieTarget extends SimklTarget {
  const SimklMovieTarget(this.ids);
  final SimklIds ids;
}

class SimklShowTarget extends SimklTarget {
  const SimklShowTarget(this.ids);
  final SimklIds ids;
}

class SimklEpisodeTarget extends SimklTarget {
  const SimklEpisodeTarget({
    required this.showIds,
    required this.season,
    required this.number,
  });
  final SimklIds showIds;
  final int season;
  final int number;
}

int? _numId(Object? v) {
  if (v is num) return v.toInt();
  if (v is String && v.trim().isNotEmpty) return int.tryParse(v.trim());
  return null;
}

/// A row from a Simkl list (`/sync/all-items/…`). Ported from `SimklItem` +
/// `pickStremioId` (which prefers TMDB, then IMDb).
class SimklWatchItem {
  const SimklWatchItem({
    required this.type,
    required this.title,
    this.year,
    required this.ids,
  });

  final String type; // 'movie' | 'show'
  final String title;
  final int? year;
  final SimklIds ids;

  String get stremioType => type == 'show' ? 'series' : 'movie';

  /// The Stremio meta id — TMDB first (`tmdb:tv|movie:<id>`), else IMDb, else
  /// null. Ports `pickStremioId`.
  String? get stremioId {
    final tmdb = ids.tmdb;
    if (tmdb != null) {
      return type == 'movie' ? 'tmdb:movie:$tmdb' : 'tmdb:tv:$tmdb';
    }
    final imdb = ids.imdb;
    if (imdb != null && imdb.isNotEmpty) return imdb;
    return null;
  }

  /// The id used to resolve calendar releases — IMDb first, then TMDB, then MAL
  /// (`mal:<id>` for anime). Ports the `fetchSimklCalendar` candidate id.
  String? get libraryId {
    final imdb = ids.imdb;
    if (imdb != null && imdb.isNotEmpty) return imdb;
    final tmdb = ids.tmdb;
    if (tmdb != null) {
      return type == 'movie' ? 'tmdb:movie:$tmdb' : 'tmdb:tv:$tmdb';
    }
    final mal = ids.mal;
    if (mal != null) return 'mal:$mal';
    return null;
  }

  /// Parses one `{movie|show:{title,year,ids}}` entry, or null.
  static SimklWatchItem? fromEntry(Object? raw, String type) {
    if (raw is! Map) return null;
    final node = raw[type];
    if (node is! Map) return null;
    final idsMap = node['ids'] is Map
        ? (node['ids'] as Map)
        : const <dynamic, dynamic>{};
    return SimklWatchItem(
      type: type,
      title: (node['title'] ?? '').toString(),
      year: (node['year'] as num?)?.toInt(),
      ids: SimklIds(
        simkl: (idsMap['simkl'] as num?)?.toInt(),
        imdb: idsMap['imdb'] is String ? idsMap['imdb'] as String : null,
        tmdb: _numId(idsMap['tmdb']),
        tvdb: (idsMap['tvdb'] as num?)?.toInt(),
        mal: (idsMap['mal'] as num?)?.toInt(),
        anidb: (idsMap['anidb'] as num?)?.toInt(),
      ),
    );
  }
}

/// A Simkl PIN grant (`/oauth/pin`). Ported from `SimklPin`.
class SimklPin {
  const SimklPin({
    required this.userCode,
    required this.verificationUrl,
    required this.deepLinkUrl,
    required this.expiresIn,
    required this.pollIntervalSec,
  });

  final String userCode;
  final String verificationUrl;
  final String deepLinkUrl;
  final int expiresIn;
  final int pollIntervalSec;

  static SimklPin? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final code = raw['user_code'];
    final url = raw['verification_url'];
    if (code is! String || url is! String) return null;
    return SimklPin(
      userCode: code,
      verificationUrl: url,
      deepLinkUrl: 'https://simkl.com/pin/$code',
      expiresIn: (raw['expires_in'] as num?)?.toInt() ?? 900,
      pollIntervalSec: (raw['interval'] as num?)?.toInt() ?? 5,
    );
  }
}
