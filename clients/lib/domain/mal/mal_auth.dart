import 'dart:math';

import '../../core/http/json_transport.dart';
import 'mal_config.dart';
import 'mal_session_store.dart';
import 'mal_types.dart';

const _verifierChars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

final _codeRe = RegExp(r'[?&#]code=([^&\s#]+)');
final _trimQuotes = RegExp('^["\'\\s]+|["\'\\s]+\$');

/// A user-facing MyAnimeList authorization failure. Its message is safe to show.
class MalAuthException implements Exception {
  const MalAuthException(this.message);
  final String message;
  @override
  String toString() => 'MalAuthException($message)';
}

/// The MyAnimeList PKCE PIN authorization flow, ported from `mal/auth.ts`:
/// generate a code verifier, open the authorize URL, let the user paste the
/// returned code, exchange it (with the verifier) for tokens via Harbor's proxy,
/// fetch the user name, and persist the session. Also refreshes an expiring
/// access token.
class MalAuth {
  MalAuth({
    required JsonTransport transport,
    required MalSessionStore store,
    DateTime Function() clock = DateTime.now,
    Random? rng,
  }) : _transport = transport,
       _store = store,
       _clock = clock,
       _rng = rng ?? Random.secure();

  final JsonTransport _transport;
  final MalSessionStore _store;
  final DateTime Function() _clock;
  final Random _rng;

  String? _verifier;

  String _generateVerifier() {
    final b = StringBuffer();
    for (var i = 0; i < 64; i++) {
      b.write(_verifierChars[_rng.nextInt(_verifierChars.length)]);
    }
    return b.toString();
  }

  /// The authorize URL to open in a browser. Stores the PKCE verifier for the
  /// later exchange (method `plain`, so the challenge is the verifier itself).
  String buildAuthorizeUrl() {
    final verifier = _generateVerifier();
    _verifier = verifier;
    final params = {
      'response_type': 'code',
      'client_id': malClientId,
      'code_challenge': verifier,
      'code_challenge_method': 'plain',
    };
    final qs = params.entries
        .map((e) => '${e.key}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    return '$malAuthorizeUrl?$qs';
  }

  /// Extracts the code from a pasted URL or a bare code. Ported from
  /// `extractMalCode`.
  static String extractCode(String input) {
    final trimmed = input.trim();
    if (trimmed.isEmpty) return '';
    final m = _codeRe.firstMatch(trimmed);
    if (m != null) {
      final g = m.group(1)!;
      try {
        return Uri.decodeComponent(g).trim();
      } catch (_) {
        return g.trim();
      }
    }
    return trimmed.replaceAll(_trimQuotes, '');
  }

  /// Exchanges [pastedCode] for a session and persists it. Throws
  /// [MalAuthException] with a user-facing message on any failure. Ported from
  /// `completeAuthorization`.
  Future<MalSession> completeAuthorization(String pastedCode) async {
    final code = extractCode(pastedCode);
    if (code.isEmpty) {
      throw const MalAuthException(
        'Paste the code from MyAnimeList to continue',
      );
    }
    final verifier = _verifier;
    if (verifier == null) {
      throw const MalAuthException(
        'Session expired. Start over and authorize again.',
      );
    }
    final tokens = await _exchange({
      'grant_type': 'authorization_code',
      'code': code,
      'code_verifier': verifier,
    });
    _verifier = null;
    final userName = await _fetchUserName(tokens.accessToken);
    final now = _clock().millisecondsSinceEpoch;
    final session = MalSession(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      createdAt: now,
      expiresAt: now + tokens.expiresIn * 1000,
      userName: userName,
    );
    await _store.write(session);
    return session;
  }

  /// Refreshes the access token with the stored refresh token, ported from
  /// `refreshAccessToken`. Returns the new session, or null (clearing the
  /// session) when there is no refresh token or the server rejects it.
  Future<MalSession?> refreshAccessToken() async {
    final current = _store.read();
    final refresh = current?.refreshToken;
    if (refresh == null || refresh.isEmpty) return null;
    _MalTokens tokens;
    try {
      tokens = await _exchange({
        'grant_type': 'refresh_token',
        'refresh_token': refresh,
      });
    } catch (_) {
      await _store.write(null);
      return null;
    }
    final now = _clock().millisecondsSinceEpoch;
    final next = MalSession(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      createdAt: now,
      expiresAt: now + tokens.expiresIn * 1000,
      userName: current!.userName,
    );
    await _store.write(next);
    return next;
  }

  /// Clears the stored session (sign out).
  Future<void> signOut() => _store.write(null);

  Future<_MalTokens> _exchange(Map<String, String> body) async {
    final JsonResponse res;
    try {
      res = await _transport.postJson(
        malTokenProxy,
        body: body,
        headers: const {'Content-Type': 'application/json'},
      );
    } catch (_) {
      throw const MalAuthException(
        'Could not reach MyAnimeList. Check your connection and try again.',
      );
    }
    if (!res.ok) {
      throw MalAuthException(
        'MyAnimeList rejected that code (HTTP ${res.statusCode}). '
        'Authorize again and paste the newest one.',
      );
    }
    final data = res.data;
    final access = data is Map ? data['access_token'] : null;
    final refresh = data is Map ? data['refresh_token'] : null;
    if (access is! String || access.isEmpty) {
      throw const MalAuthException(
        'MyAnimeList did not return a token. Try authorizing again.',
      );
    }
    return _MalTokens(
      accessToken: access,
      refreshToken: refresh is String ? refresh : '',
      expiresIn:
          (data is Map ? (data['expires_in'] as num?)?.toInt() : null) ?? 0,
    );
  }

  Future<String> _fetchUserName(String accessToken) async {
    try {
      final res = await _transport.getJson(
        '$malApiBase/users/@me',
        headers: {'Authorization': 'Bearer $accessToken'},
      );
      if (!res.ok || res.data is! Map) return 'unknown';
      return (res.data as Map)['name'] as String? ?? 'unknown';
    } catch (_) {
      return 'unknown';
    }
  }
}

class _MalTokens {
  const _MalTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
}
