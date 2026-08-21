import '../../core/http/json_transport.dart';
import 'trakt_client.dart';
import 'trakt_config.dart';
import 'trakt_types.dart';

/// The outcome of a single device-token poll. Ported from `PollResult`.
sealed class TraktPollResult {
  const TraktPollResult();
}

class TraktPollAuthorized extends TraktPollResult {
  const TraktPollAuthorized(this.session);
  final TraktSession session;
}

class TraktPollPending extends TraktPollResult {
  const TraktPollPending();
}

class TraktPollSlowDown extends TraktPollResult {
  const TraktPollSlowDown();
}

class TraktPollExpired extends TraktPollResult {
  const TraktPollExpired();
}

class TraktPollDenied extends TraktPollResult {
  const TraktPollDenied();
}

class TraktPollError extends TraktPollResult {
  const TraktPollError(this.message);
  final String message;
}

/// The Trakt device-code sign-in: request a code, then poll Harbor's device
/// token proxy until the user authorizes on trakt.tv. Ported from
/// `trakt/device-auth.ts`.
class TraktDeviceAuth {
  TraktDeviceAuth(this._t);

  final JsonTransport _t;

  /// Requests a fresh device code. Throws [TraktApiError] on a non-2xx or
  /// malformed response.
  Future<TraktDeviceCode> requestDeviceCode() async {
    final res = await _t.postJson(
      '$traktApiBase/oauth/device/code',
      body: {'client_id': traktClientId},
      headers: const {'Content-Type': 'application/json'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw TraktApiError(res.statusCode, res.data?.toString() ?? '');
    }
    final code = TraktDeviceCode.fromJson(res.data);
    if (code == null) {
      throw TraktApiError(res.statusCode, 'Malformed device-code response');
    }
    return code;
  }

  /// Polls the token proxy once, mapping Trakt's status codes to a
  /// [TraktPollResult] (200 authorized, 400 pending, 429 slow-down, 410
  /// expired, 418 denied).
  Future<TraktPollResult> pollOnce(String deviceCode) async {
    final JsonResponse res;
    try {
      res = await _t.postJson(
        traktDeviceTokenProxy,
        body: {'code': deviceCode},
        headers: const {'Content-Type': 'application/json'},
      );
    } on TransportException catch (e) {
      return TraktPollError(e.message);
    }
    switch (res.statusCode) {
      case 200:
        final data = res.data;
        if (data is! Map) {
          return const TraktPollError('Malformed token response');
        }
        final access = data['access_token'];
        final refresh = data['refresh_token'];
        if (access is! String || refresh is! String) {
          return const TraktPollError('Malformed token response');
        }
        return TraktPollAuthorized(
          TraktSession(
            accessToken: access,
            refreshToken: refresh,
            createdAt:
                (data['created_at'] as num?)?.toInt() ??
                DateTime.now().millisecondsSinceEpoch ~/ 1000,
            expiresIn: (data['expires_in'] as num?)?.toInt() ?? 0,
          ),
        );
      case 400:
        return const TraktPollPending();
      case 429:
        return const TraktPollSlowDown();
      case 410:
        return const TraktPollExpired();
      case 418:
        return const TraktPollDenied();
      default:
        return TraktPollError('HTTP ${res.statusCode}');
    }
  }
}
