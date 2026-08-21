import '../../core/http/json_transport.dart';
import '../addons/models.dart';
import 'stremboxd_config.dart';

/// A failed Stremboxd request. Ported from the web `StremboxdApiError`.
class StremboxdApiError implements Exception {
  StremboxdApiError(this.status, [this.body = '']);
  final int status;
  final String body;
  @override
  String toString() => 'StremboxdApiError($status)';
}

/// A Letterboxd list/watchlist the account owns. Ported from `LetterboxdListRef`.
class LetterboxdListRef {
  const LetterboxdListRef({
    required this.id,
    required this.name,
    this.owner,
    this.filmCount,
  });

  final String id;
  final String name;
  final String? owner;
  final int? filmCount;

  static LetterboxdListRef? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final id = raw['id'];
    if (id is! String) return null;
    return LetterboxdListRef(
      id: id,
      name: raw['name'] is String ? raw['name'] as String : id,
      owner: raw['owner'] is String ? raw['owner'] as String : null,
      filmCount: (raw['filmCount'] as num?)?.toInt(),
    );
  }
}

/// The result of a username check (`/auth/validate-username`). Ported from
/// `LetterboxdUsernameValidation`.
class LetterboxdUsernameValidation {
  const LetterboxdUsernameValidation({
    required this.valid,
    this.memberId,
    this.displayName,
    this.username,
    this.lists = const [],
  });

  final bool valid;
  final String? memberId;
  final String? displayName;
  final String? username;
  final List<LetterboxdListRef> lists;

  static LetterboxdUsernameValidation fromJson(Object? raw) {
    if (raw is! Map) return const LetterboxdUsernameValidation(valid: false);
    final lists = raw['lists'];
    return LetterboxdUsernameValidation(
      valid: raw['valid'] == true,
      memberId: raw['memberId'] is String ? raw['memberId'] as String : null,
      displayName: raw['displayName'] is String
          ? raw['displayName'] as String
          : null,
      username: raw['username'] is String ? raw['username'] as String : null,
      lists: lists is List
          ? [for (final l in lists) ?LetterboxdListRef.fromJson(l)]
          : const [],
    );
  }
}

/// The outcome of validating a config against the Stremboxd manifest. Ported
/// from `ManifestValidation`.
sealed class ManifestValidation {
  const ManifestValidation();
}

class ManifestValid extends ManifestValidation {
  const ManifestValid({required this.catalogs, required this.hasWatchlist});
  final int catalogs;
  final bool hasWatchlist;
}

class ManifestInvalid extends ManifestValidation {
  const ManifestInvalid(this.reason, this.message);

  /// One of `network`, `invalid`, `no-catalogs`.
  final String reason;
  final String message;
}

/// A full-mode Letterboxd session — the JWT [userToken] returned by
/// `/auth/login`, plus the account it belongs to. Ported from
/// `LetterboxdSession`. The token is a credential, so it lives in the keychain.
class LetterboxdSession {
  const LetterboxdSession({
    required this.userToken,
    required this.userId,
    required this.username,
    this.displayName,
    this.loginAt = 0,
    this.lists = const [],
  });

  final String userToken;
  final String userId;
  final String username;
  final String? displayName;
  final int loginAt;
  final List<LetterboxdListRef> lists;

  Map<String, dynamic> toJson() => {
    'userToken': userToken,
    'userId': userId,
    'username': username,
    if (displayName != null) 'displayName': displayName,
    'loginAt': loginAt,
    'lists': [
      for (final l in lists)
        {
          'id': l.id,
          'name': l.name,
          if (l.owner != null) 'owner': l.owner,
          if (l.filmCount != null) 'filmCount': l.filmCount,
        },
    ],
  };

  static LetterboxdSession? fromJson(Object? raw) {
    if (raw is! Map || raw['userToken'] is! String) return null;
    final lists = raw['lists'];
    return LetterboxdSession(
      userToken: raw['userToken'] as String,
      userId: raw['userId']?.toString() ?? '',
      username: raw['username']?.toString() ?? '',
      displayName: raw['displayName'] is String
          ? raw['displayName'] as String
          : null,
      loginAt: (raw['loginAt'] as num?)?.toInt() ?? 0,
      lists: lists is List
          ? [for (final l in lists) ?LetterboxdListRef.fromJson(l)]
          : const [],
    );
  }
}

/// The outcome of a full-mode sign-in. Ported from the web `LoginResult`.
sealed class LetterboxdLoginResult {
  const LetterboxdLoginResult();
}

class LetterboxdLoginSuccess extends LetterboxdLoginResult {
  const LetterboxdLoginSuccess(this.session);
  final LetterboxdSession session;
}

/// The server needs a two-factor code — re-submit with the TOTP.
class LetterboxdLoginTwoFactor extends LetterboxdLoginResult {
  const LetterboxdLoginTwoFactor();
}

class LetterboxdLoginError extends LetterboxdLoginResult {
  const LetterboxdLoginError(this.message);
  final String message;
}

/// The Stremboxd HTTP client — public-config validation and Letterboxd username
/// checks. Ported from the read half of the web `stremboxd/client.ts`.
class StremboxdClient {
  StremboxdClient(this._t);

  final JsonTransport _t;

  /// Full-mode sign-in (`/auth/login`). Returns a two-factor result when the
  /// server responds `2FA_REQUIRED` (re-call with [totp]). The password is
  /// entered by the user and sent only to Stremboxd. Ported from
  /// `loginLetterboxd` + the provider's login result mapping. [nowMs] stamps the
  /// session's login time.
  Future<LetterboxdLoginResult> login(
    String username,
    String password, {
    String? totp,
    required int nowMs,
  }) async {
    JsonResponse res;
    try {
      res = await _t.postJson(
        '$stremboxdBase/auth/login',
        body: {
          'username': username,
          'password': password,
          if (totp != null && totp.isNotEmpty) 'totp': totp,
        },
        headers: {'Content-Type': 'application/json'},
      );
    } catch (_) {
      return const LetterboxdLoginError(
        'Could not reach Stremboxd. Check your connection.',
      );
    }
    final data = res.data;
    if (!res.ok) {
      final code = data is Map ? data['code'] : null;
      if (code == '2FA_REQUIRED') return const LetterboxdLoginTwoFactor();
      final message =
          (data is Map ? data['error'] : null)?.toString() ??
          'Sign-in failed (${res.statusCode}).';
      return LetterboxdLoginError(message);
    }
    if (data is! Map || data['userToken'] is! String) {
      return const LetterboxdLoginError('Unexpected response from Stremboxd.');
    }
    final user = data['user'];
    final lists = data['lists'];
    return LetterboxdLoginSuccess(
      LetterboxdSession(
        userToken: data['userToken'] as String,
        userId: user is Map ? (user['id']?.toString() ?? '') : '',
        username: user is Map
            ? (user['username']?.toString() ?? username)
            : username,
        displayName: user is Map && user['displayName'] is String
            ? user['displayName'] as String
            : null,
        loginAt: nowMs,
        lists: lists is List
            ? [for (final l in lists) ?LetterboxdListRef.fromJson(l)]
            : const [],
      ),
    );
  }

  /// Validates [configSegment] by fetching the manifest and checking it is the
  /// Stremboxd addon with catalogs (and, when [expectWatchlist], a watchlist).
  /// Ported from `validateStremboxdConfig`.
  Future<ManifestValidation> validateConfig(
    String configSegment, {
    required bool expectWatchlist,
  }) async {
    try {
      final res = await _t.getJson(
        '$stremboxdBase/$configSegment/manifest.json',
      );
      if (!res.ok) throw StremboxdApiError(res.statusCode, '${res.data ?? ''}');
      final m = res.data;
      if (m is! Map || m['id'] != 'community.stremboxd') {
        return const ManifestInvalid(
          'invalid',
          'Unexpected manifest from Stremboxd.',
        );
      }
      final catalogs = m['catalogs'];
      if (catalogs is! List || catalogs.isEmpty) {
        return const ManifestInvalid(
          'no-catalogs',
          'No catalogs returned for this configuration.',
        );
      }
      final hasWatchlist = catalogs.any(
        (c) => c is Map && c['id'] == 'letterboxd-watchlist',
      );
      if (expectWatchlist && !hasWatchlist) {
        return const ManifestInvalid(
          'invalid',
          'Letterboxd did not return a watchlist for this username. Check the '
              'username is correct and public.',
        );
      }
      return ManifestValid(
        catalogs: catalogs.length,
        hasWatchlist: hasWatchlist,
      );
    } on StremboxdApiError catch (e) {
      return ManifestInvalid(
        'invalid',
        e.status == 400
            ? 'Invalid configuration.'
            : 'Stremboxd error (${e.status}).',
      );
    } catch (_) {
      return const ManifestInvalid(
        'network',
        'Could not reach Stremboxd. Check your connection.',
      );
    }
  }

  /// Fetches a public-mode Stremboxd catalog page (`/{config}/catalog/movie/
  /// {catalogId}[/skip=N].json`), returning its metas as [MetaPreview]s. Ported
  /// from `fetchStremboxdCatalog`.
  Future<List<MetaPreview>> fetchCatalog(
    String configSegment,
    String catalogId, {
    int skip = 0,
  }) {
    final base = '$stremboxdBase/$configSegment/catalog/movie/$catalogId';
    return _catalogMetas(skip > 0 ? '$base/skip=$skip.json' : '$base.json');
  }

  /// Fetches a full-mode (authenticated) Stremboxd catalog page from the
  /// `/stremio/{userId}/…` endpoint, which also sees the private watchlist and
  /// liked films. Ported from `fetchFullModeCatalog`.
  Future<List<MetaPreview>> fetchFullCatalog(
    String userId,
    String catalogId, {
    int skip = 0,
  }) {
    final base = '$stremboxdBase/stremio/$userId/catalog/movie/$catalogId';
    return _catalogMetas(skip > 0 ? '$base/skip=$skip.json' : '$base.json');
  }

  Future<List<MetaPreview>> _catalogMetas(String url) async {
    final res = await _t.getJson(url);
    if (!res.ok) throw StremboxdApiError(res.statusCode, '${res.data ?? ''}');
    final data = res.data;
    final metas = data is Map ? data['metas'] : null;
    if (metas is! List) return const [];
    return [
      for (final m in metas)
        if (m is Map) _stremboxdMetaToPreview(m.cast<String, dynamic>()),
    ];
  }

  /// The catalog display names keyed by catalog id — public mode reads the
  /// config manifest, full mode the personalized `/stremio/{userId}` one (which
  /// carries names like "karsten's Watchlist"). Returns empty on any failure so
  /// the row builder falls back to template/default names.
  Future<Map<String, String>> fetchManifestNames(String configSegment) =>
      _manifestNames('$stremboxdBase/$configSegment/manifest.json');

  Future<Map<String, String>> fetchFullManifestNames(String userId) =>
      _manifestNames('$stremboxdBase/stremio/$userId/manifest.json');

  Future<Map<String, String>> _manifestNames(String url) async {
    final JsonResponse res;
    try {
      res = await _t.getJson(url);
    } catch (_) {
      return const {};
    }
    if (!res.ok) return const {};
    final m = res.data;
    final cats = m is Map ? m['catalogs'] : null;
    final out = <String, String>{};
    if (cats is List) {
      for (final c in cats) {
        if (c is Map && c['id'] is String && c['name'] is String) {
          out[c['id'] as String] = c['name'] as String;
        }
      }
    }
    return out;
  }

  /// Maps a Stremboxd catalog meta to a [MetaPreview] (always a movie; a bare
  /// `year` becomes `releaseInfo`). Ported from `stremboxdMetaToMeta`.
  static MetaPreview _stremboxdMetaToPreview(Map<String, dynamic> m) {
    final releaseInfo =
        m['releaseInfo']?.toString() ??
        (m['year'] != null ? '${m['year']}' : null);
    return MetaPreview({
      'id': m['id'],
      'type': 'movie',
      'name': m['name'],
      if (m['poster'] != null) 'poster': m['poster'],
      if (m['background'] != null) 'background': m['background'],
      if (m['description'] != null) 'description': m['description'],
      'releaseInfo': ?releaseInfo,
      if (m['imdbRating'] != null) 'imdbRating': m['imdbRating'],
      if (m['genres'] != null) 'genres': m['genres'],
    });
  }

  /// Resolves a public Letterboxd list URL to its reference (id, name, owner,
  /// film count) via `/auth/resolve-list-public`. Ported from
  /// `resolveLetterboxdListPublic`. Throws when the URL can't be resolved.
  Future<LetterboxdListRef> resolveListPublic(String url) async {
    final res = await _t.postJson(
      '$stremboxdBase/auth/resolve-list-public',
      body: {'url': url},
      headers: {'Content-Type': 'application/json'},
    );
    if (!res.ok) throw StremboxdApiError(res.statusCode, '${res.data ?? ''}');
    final ref = LetterboxdListRef.fromJson(res.data);
    if (ref == null) throw StremboxdApiError(res.statusCode, 'no list ref');
    return ref;
  }

  /// Checks a Letterboxd username exists (and is public), returning its member
  /// id, display name and lists. Ported from `validateLetterboxdUsername`.
  Future<LetterboxdUsernameValidation> validateUsername(String username) async {
    final res = await _t.postJson(
      '$stremboxdBase/auth/validate-username',
      body: {'username': username},
      headers: {'Content-Type': 'application/json'},
    );
    if (!res.ok) throw StremboxdApiError(res.statusCode, '${res.data ?? ''}');
    return LetterboxdUsernameValidation.fromJson(res.data);
  }
}

/// Builds the encoded public config from the panel's selections. Ported from
/// `buildStremboxdConfig` (`settings-helper.ts`).
String buildStremboxdConfig({
  required Set<String> selectedCatalogs,
  required String username,
  required List<String> listIds,
  required bool ratings,
}) {
  final u = username.trim();
  return encodeStremboxdConfig(
    StremboxdPublicConfig(
      username: u.isEmpty ? null : u,
      catalogs: StremboxdCatalogs(
        popular: selectedCatalogs.contains('letterboxd-popular'),
        top250: selectedCatalogs.contains('letterboxd-top250'),
        watchlist: selectedCatalogs.contains('letterboxd-watchlist')
            ? true
            : null,
        likedFilms: selectedCatalogs.contains('letterboxd-liked') ? true : null,
      ),
      listIds: listIds,
      ratings: ratings,
    ),
  );
}
