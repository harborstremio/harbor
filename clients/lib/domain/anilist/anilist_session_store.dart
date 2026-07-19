import 'dart:convert';

import '../../core/storage/kv_store.dart';
import '../../core/storage/secure_store.dart';
import 'anilist_types.dart';

/// Persists the AniList session per profile. Ported from `anilist/session.ts`.
///
/// The access token is a secret, so the session lives in the platform keychain
/// (`harbor.secret.harbor.anilist.session.v1.<id>`), never plaintext prefs
/// (`docs/80-security.md`); a legacy plaintext session is migrated on first
/// read. [ensureHydrated] loads the keychain into the cache before the
/// synchronous [read] returns the stored session.
class AnilistSessionStore {
  AnilistSessionStore(this._secure, this._kv, {required this.profileId});

  static const _base = 'harbor.anilist.session.v1';

  final SecureStore _secure;
  final KvStore _kv;
  final String profileId;

  AnilistSession? _cached;
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

  AnilistSession? _parse(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return AnilistSession.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  AnilistSession? read() => _cached;

  Future<void> write(AnilistSession? session) async {
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
