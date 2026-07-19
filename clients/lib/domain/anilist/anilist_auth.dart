import '../../core/http/json_transport.dart';
import 'anilist_client.dart';
import 'anilist_config.dart';
import 'anilist_session_store.dart';
import 'anilist_types.dart';

const _viewerQuery =
    'query { Viewer { id name avatar { large medium } siteUrl } }';

final _codeRe = RegExp(r'[?&#]code=([^&\s#]+)');
final _trimQuotes = RegExp('^["\'\\s]+|["\'\\s]+\$');

/// A user-facing AniList authorization failure. Its message is safe to show.
class AnilistAuthException implements Exception {
  const AnilistAuthException(this.message);
  final String message;
  @override
  String toString() => 'AnilistAuthException($message)';
}

/// The AniList PIN authorization flow, ported from `anilist/auth.ts`: open the
/// authorize URL, let the user paste the returned code, exchange it for an
/// access token via Harbor's proxy, fetch the viewer, and persist the session.
class AnilistAuth {
  AnilistAuth({
    required JsonTransport transport,
    required AnilistClient client,
    required AnilistSessionStore store,
    DateTime Function() clock = DateTime.now,
  }) : _transport = transport,
       _client = client,
       _store = store,
       _clock = clock;

  final JsonTransport _transport;
  final AnilistClient _client;
  final AnilistSessionStore _store;
  final DateTime Function() _clock;

  /// The AniList authorize URL to open in a browser (PIN redirect).
  String buildAuthorizeUrl() {
    final params = {
      'client_id': anilistClientId,
      'redirect_uri': anilistPinRedirectUri,
      'response_type': 'code',
    };
    final qs = params.entries
        .map((e) => '${e.key}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    return '$anilistAuthorizeUrl?$qs';
  }

  /// Extracts the code from a pasted URL or a bare code. Ported from
  /// `extractAnilistCode`.
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
  /// [AnilistAuthException] with a user-facing message on any failure. Ported
  /// from `completeAuthorization`.
  Future<AnilistSession> completeAuthorization(String pastedCode) async {
    final code = extractCode(pastedCode);
    if (code.isEmpty) {
      throw const AnilistAuthException(
        'Paste the code from AniList to continue',
      );
    }
    final token = await _exchangeCode(code);
    final viewer = await fetchViewer(_client, token);
    final now = _clock().millisecondsSinceEpoch;
    final session = AnilistSession(
      accessToken: token,
      createdAt: now,
      expiresAt: now + anilistTokenTtl.inMilliseconds,
      userId: viewer.id,
      userName: viewer.name,
      avatar: viewer.avatar,
    );
    await _store.write(session);
    return session;
  }

  /// Clears the stored session (sign out).
  Future<void> signOut() => _store.write(null);

  Future<String> _exchangeCode(String code) async {
    final JsonResponse res;
    try {
      res = await _transport.postJson(
        anilistTokenExchangeUrl,
        body: {'code': code},
        headers: const {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      );
    } catch (_) {
      throw const AnilistAuthException(
        'Could not reach AniList. Check your connection and try again.',
      );
    }
    if (!res.ok) {
      throw const AnilistAuthException(
        'AniList rejected that code. Authorize again and paste the newest one.',
      );
    }
    final token = res.data is Map ? (res.data as Map)['access_token'] : null;
    if (token is! String || token.isEmpty) {
      throw const AnilistAuthException(
        'AniList did not return a token. Try authorizing again.',
      );
    }
    return token;
  }
}

/// Fetches the authenticated AniList viewer. Ported from `fetchViewer`.
Future<AnilistViewer> fetchViewer(
  AnilistClient client,
  String accessToken,
) async {
  final data = await client.request(_viewerQuery, accessToken: accessToken);
  final v = data?['Viewer'];
  if (v is! Map || v['id'] is! num) {
    throw const AnilistAuthException('AniList did not return your account.');
  }
  final avatar = v['avatar'];
  return AnilistViewer(
    id: (v['id'] as num).toInt(),
    name: v['name'] as String? ?? '',
    avatar: avatar is Map
        ? (avatar['large'] ?? avatar['medium']) as String?
        : null,
    siteUrl: v['siteUrl'] as String?,
  );
}
