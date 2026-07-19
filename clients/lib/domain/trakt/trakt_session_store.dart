import 'dart:convert';

import '../../core/storage/kv_store.dart';
import '../../core/storage/secure_store.dart';
import 'trakt_config.dart';
import 'trakt_types.dart';

/// Persists the Trakt OAuth session per profile and computes token
/// validity/refresh windows. Ported from `trakt/session.ts`.
///
/// The access/refresh tokens are secrets, so the session lives in the platform
/// keychain (`harbor.secret.trakt.session.v1.<id>`), never plaintext prefs
/// (`docs/80-security.md`); a legacy plaintext session at the old kv key is
/// migrated into the keychain on first read. Because the keychain is async, the
/// session is hydrated once into an in-memory cache — [ensureHydrated] must
/// complete before the synchronous [read] returns the stored value.
///
/// The session can also be seeded from the legacy settings fields
/// (`traktAccessToken`/…) so a token pasted into settings becomes a live
/// session. A [clock] is injectable so validity windows are deterministic under
/// test.
class TraktSessionStore {
  TraktSessionStore(
    this._secure,
    this._kv, {
    required this.profileId,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  static const _base = 'harbor.trakt.session.v1';

  final SecureStore _secure;
  final KvStore _kv;
  final String profileId;
  final DateTime Function() _clock;

  TraktSession? _cached;
  bool _hydrated = false;

  String get _legacyKey => '$_base.$profileId';
  String get _secureKey => 'harbor.secret.$_base.$profileId';

  int get _nowSec => _clock().millisecondsSinceEpoch ~/ 1000;

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

  TraktSession? _parse(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return TraktSession.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  /// The hydrated session, or null. Call [ensureHydrated] first (the providers
  /// and the client do) so this reflects the keychain rather than a cold cache.
  TraktSession? read() => _cached;

  Future<void> write(TraktSession? session) async {
    _cached = session;
    _hydrated = true;
    if (session == null) {
      await _secure.delete(_secureKey);
    } else {
      await _secure.write(_secureKey, jsonEncode(session.toJson()));
    }
  }

  /// Builds a session from the legacy settings token fields, or null when they
  /// are absent or already expired. Pure — the `harbor.settings` migration
  /// branch of the web `read()`. [expiresAtMs] is the absolute expiry in epoch
  /// milliseconds (the `traktExpiresAt` setting).
  static TraktSession? sessionFromSettings({
    String? accessToken,
    String? refreshToken,
    int expiresAtMs = 0,
    String? username,
    required int nowMs,
  }) {
    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty ||
        expiresAtMs <= 0) {
      return null;
    }
    final expiresInSec = (expiresAtMs - nowMs) ~/ 1000;
    if (expiresInSec <= 0) return null;
    return TraktSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      createdAt: nowMs ~/ 1000,
      expiresIn: expiresInSec,
      username: username,
    );
  }

  /// Seeds the session from the settings token fields when none is stored yet,
  /// returning the resulting session (or the existing one).
  Future<TraktSession?> hydrateFromSettings({
    String? accessToken,
    String? refreshToken,
    int expiresAtMs = 0,
    String? username,
  }) async {
    await ensureHydrated();
    final existing = read();
    if (existing != null) return existing;
    final session = sessionFromSettings(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAtMs: expiresAtMs,
      username: username,
      nowMs: _clock().millisecondsSinceEpoch,
    );
    if (session == null) return null;
    await write(session);
    return session;
  }

  /// Usable now, or refreshable within the threshold — the "connected" state.
  bool isAuthenticated() {
    final s = read();
    if (s == null) return false;
    return _nowSec < s.createdAt + s.expiresIn + traktRefreshThresholdSec;
  }

  /// The token is inside its refresh window (expiring within the threshold).
  bool shouldRefresh() {
    final s = read();
    if (s == null) return false;
    return _nowSec > s.createdAt + s.expiresIn - traktRefreshThresholdSec;
  }

  /// The access token itself has not yet expired.
  bool isAccessTokenStillValid() {
    final s = read();
    if (s == null) return false;
    return _nowSec < s.createdAt + s.expiresIn;
  }
}
