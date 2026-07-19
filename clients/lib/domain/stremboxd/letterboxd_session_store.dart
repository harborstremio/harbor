import 'dart:convert';

import '../../core/storage/secure_store.dart';
import 'stremboxd_client.dart';

/// The per-profile full-mode Letterboxd session, kept in the keychain (the
/// userToken is a credential). Mirrors the other tracker session stores;
/// [ensureHydrated] loads the token into the cache before [read] returns it.
class LetterboxdSessionStore {
  LetterboxdSessionStore(this._secure, {required this.profileId});

  final SecureStore _secure;
  final String profileId;

  LetterboxdSession? _cached;
  bool _hydrated = false;

  String get _key => 'harbor.secret.letterboxd.session.$profileId';

  Future<void> ensureHydrated() async {
    if (_hydrated) return;
    final raw = await _secure.read(_key);
    _cached = _parse(raw);
    _hydrated = true;
  }

  LetterboxdSession? read() => _cached;

  Future<void> write(LetterboxdSession session) async {
    _cached = session;
    _hydrated = true;
    await _secure.write(_key, jsonEncode(session.toJson()));
  }

  Future<void> clear() async {
    _cached = null;
    _hydrated = true;
    await _secure.delete(_key);
  }

  static LetterboxdSession? _parse(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return LetterboxdSession.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }
}
