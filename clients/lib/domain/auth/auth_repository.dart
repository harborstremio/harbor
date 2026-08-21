import 'dart:convert';

import '../../core/storage/secure_store.dart';
import '../profiles/profiles_repository.dart';
import '../stremio/stremio_user.dart';

/// A signed-in Stremio session: `{ authKey, user }`.
class AuthSession {
  const AuthSession({required this.authKey, required this.user});

  final String authKey;
  final StremioUser user;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    authKey: json['authKey'] as String,
    user: StremioUser.fromJson((json['user'] as Map).cast<String, dynamic>()),
  );

  Map<String, dynamic> toJson() => {'authKey': authKey, 'user': user.toJson()};
}

/// Persists Stremio sessions keyed by the **source** profile
/// (`harbor.auth.<sourceProfileId>`) in secure storage — the session carries the
/// authKey secret. The source profile can differ from the active one when
/// `shareStremioWith` is set (see [ProfilesRepository.stremioSourceProfileId]).
class AuthRepository {
  AuthRepository(this._secure, this._profiles);

  final SecureStore _secure;
  final ProfilesRepository _profiles;

  static String keyFor(String sourceProfileId) =>
      'harbor.auth.$sourceProfileId';

  Future<AuthSession?> readSession(String sourceProfileId) async {
    final raw = await _secure.read(keyFor(sourceProfileId));
    if (raw == null || raw.isEmpty) return null;
    try {
      return AuthSession.fromJson(
        (jsonDecode(raw) as Map).cast<String, dynamic>(),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> writeSession(String sourceProfileId, AuthSession session) =>
      _secure.write(keyFor(sourceProfileId), jsonEncode(session.toJson()));

  Future<void> clear(String sourceProfileId) =>
      _secure.delete(keyFor(sourceProfileId));

  /// The session for whichever profile owns the active profile's Stremio login.
  Future<AuthSession?> readActiveSession() =>
      readSession(_profiles.stremioSourceProfileId());

  Future<String?> readActiveAuthKey() async =>
      (await readActiveSession())?.authKey;
}
