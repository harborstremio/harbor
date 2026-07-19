/// A persisted MyAnimeList session. Ported from `MalSession`. The tokens are
/// secrets and are stored in the platform keychain, never plaintext prefs.
class MalSession {
  const MalSession({
    required this.accessToken,
    required this.refreshToken,
    required this.createdAt,
    required this.expiresAt,
    required this.userName,
  });

  final String accessToken;
  final String refreshToken;
  final int createdAt;
  final int expiresAt;
  final String userName;

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'createdAt': createdAt,
    'expiresAt': expiresAt,
    'userName': userName,
  };

  /// Parses a stored session, or null when any required field is missing or
  /// mistyped — a partial session is never trusted. Ported from the `read`
  /// validation in `mal/session.ts`.
  static MalSession? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final accessToken = raw['accessToken'];
    final refreshToken = raw['refreshToken'];
    final createdAt = raw['createdAt'];
    final expiresAt = raw['expiresAt'];
    final userName = raw['userName'];
    if (accessToken is! String ||
        refreshToken is! String ||
        createdAt is! num ||
        expiresAt is! num ||
        userName is! String) {
      return null;
    }
    return MalSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      createdAt: createdAt.toInt(),
      expiresAt: expiresAt.toInt(),
      userName: userName,
    );
  }
}
