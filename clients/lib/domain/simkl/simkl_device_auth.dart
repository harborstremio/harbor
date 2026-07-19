import 'simkl_client.dart';
import 'simkl_types.dart';

/// The outcome of a single Simkl PIN poll.
sealed class SimklPollResult {
  const SimklPollResult();
}

class SimklPollAuthorized extends SimklPollResult {
  const SimklPollAuthorized(this.session);
  final SimklSession session;
}

class SimklPollPending extends SimklPollResult {
  const SimklPollPending();
}

/// The Simkl PIN sign-in: request a PIN, then poll until the user enters it at
/// simkl.com/pin. Ported from `simkl/device-auth.ts`.
class SimklDeviceAuth {
  SimklDeviceAuth(this._client);

  final SimklClient _client;

  /// Requests a fresh PIN. Throws [SimklApiError] on a non-2xx or malformed
  /// response.
  Future<SimklPin> requestPin() async {
    final data = await _client.request('/oauth/pin', authed: false);
    final pin = SimklPin.fromJson(data);
    if (pin == null) {
      throw SimklApiError(200, 'Malformed PIN response');
    }
    return pin;
  }

  /// Polls once (`/oauth/pin/<userCode>`): authorized once `result == "OK"` and
  /// an access token is returned, otherwise pending. A transport/API error is
  /// treated as pending so the loop keeps trying until the PIN expires.
  Future<SimklPollResult> pollOnce(String userCode) async {
    try {
      final data = await _client.request('/oauth/pin/$userCode', authed: false);
      if (data is Map &&
          data['result'] == 'OK' &&
          data['access_token'] is String) {
        return SimklPollAuthorized(
          SimklSession(accessToken: data['access_token'] as String),
        );
      }
      return const SimklPollPending();
    } on SimklApiError {
      return const SimklPollPending();
    }
  }
}
