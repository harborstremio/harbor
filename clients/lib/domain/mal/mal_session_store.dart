import 'dart:convert';

import '../../core/storage/kv_store.dart';
import '../../core/storage/secure_store.dart';
import 'mal_types.dart';

/// Persists the MyAnimeList session per profile. Ported from `mal/session.ts`.
///
/// The access and refresh tokens are secrets, so the session lives in the
/// platform keychain (`harbor.secret.harbor.mal.session.v1.<id>`), never
/// plaintext prefs (`docs/80-security.md`); a legacy plaintext session is
/// migrated on first read. [ensureHydrated] loads the keychain into the cache
/// before the synchronous [read] returns the stored session.
class MalSessionStore {
  MalSessionStore(this._secure, this._kv, {required this.profileId});

  static const _base = 'harbor.mal.session.v1';

  final SecureStore _secure;
  final KvStore _kv;
  final String profileId;

  MalSession? _cached;
  bool _hydrated = false;

  String get _legacyKey => '$_base.$profileId';
  String get _secureKey => 'harbor.secret.$_base.$profileId';

  /// Loads the session from the keychain into the cache (idempotent), migrating
  /// a legacy plaintext session into the keychain the first time it is seen.
  Future<void> ensureHydrated() async {
    if (_hydrated) return;
    var raw = await _secure.read(_secureKey);
    if (raw == null || raw.isEmpty) {
      final legacy = _kv.getString(_legacyKey);
      if (legacy != null && legacy.isNotEmpty) {
        await _secure.write(_secureKey, legacy);
        await _kv.remove(_legacyKey);
        await _kv.compact();
        raw = legacy;
      }
    }
    _cached = _parse(raw);
    _hydrated = true;
  }

  MalSession? _parse(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return MalSession.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  MalSession? read() => _cached;

  Future<void> write(MalSession? session) async {
    _cached = session;
    _hydrated = true;
    if (session == null) {
      await _secure.delete(_secureKey);
    } else {
      await _secure.write(_secureKey, jsonEncode(session.toJson()));
    }
  }

  bool isAuthenticated() => read() != null;
}
