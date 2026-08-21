import 'dart:math' as math;

import '../../core/http/json_transport.dart';

const anilistGraphqlUrl = 'https://graphql.anilist.co';

/// A failed AniList GraphQL request — an HTTP error or a GraphQL `errors`
/// payload (reported as status 200). Ported from `AnilistApiError`.
class AnilistApiError implements Exception {
  AnilistApiError(this.status, this.body);

  final int status;
  final String body;

  @override
  String toString() =>
      'AnilistApiError(AniList HTTP $status: '
      '${body.substring(0, math.min(200, body.length))})';
}

/// The AniList GraphQL client. Ported from `anilistRequest` — a public request
/// (`skipAuth`) sends no token; an authenticated one carries the bearer token.
/// Rate-limit (429) retries are handled by the transport. Throws
/// [AnilistApiError] on an HTTP failure or a GraphQL error payload.
class AnilistClient {
  AnilistClient(this._transport);

  final JsonTransport _transport;

  Future<Map<String, dynamic>?> request(
    String query, {
    Map<String, dynamic> variables = const {},
    String? accessToken,
    bool skipAuth = false,
  }) async {
    final token = skipAuth ? null : accessToken;
    final res = await _transport.postJson(
      anilistGraphqlUrl,
      body: {'query': query, 'variables': variables},
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    );
    if (!res.ok) {
      throw AnilistApiError(res.statusCode, '${res.data ?? ''}');
    }
    final data = res.data;
    if (data is! Map) return null;
    final errors = data['errors'];
    if (errors is List && errors.isNotEmpty) {
      final message = errors
          .map((e) => (e is Map ? e['message'] : null) ?? '')
          .join('; ');
      throw AnilistApiError(200, message);
    }
    final payload = data['data'];
    return payload is Map ? payload.cast<String, dynamic>() : null;
  }
}
