import '../../core/http/json_transport.dart';
import 'mal_config.dart';

/// A failed MyAnimeList API request. Ported from the `malRequest` error path in
/// `src/lib/mal/client.ts`.
class MalApiError implements Exception {
  MalApiError(this.status);

  final int status;

  @override
  String toString() => 'MalApiError(MAL HTTP $status)';
}

/// The MyAnimeList REST client. Ported from `malRequest` — a bearer-authenticated
/// GET against the v2 API. Refreshing an expired token is handled a layer up
/// (the watched provider refreshes before calling), mirroring the web's
/// 401-refresh but done proactively.
class MalClient {
  MalClient(this._transport);

  final JsonTransport _transport;

  /// GETs [path] (e.g. `/anime/1?fields=...`) with the bearer [accessToken],
  /// returning the decoded object or throwing [MalApiError] on an HTTP failure.
  Future<Map<String, dynamic>?> get(
    String path, {
    required String accessToken,
  }) async {
    final res = await _transport.getJson(
      '$malApiBase$path',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    if (!res.ok) throw MalApiError(res.statusCode);
    final data = res.data;
    return data is Map ? data.cast<String, dynamic>() : null;
  }

  /// Updates the user's list entry for [malId] (status / watched count) via a
  /// form-encoded PATCH — ported from `saveListEntry` in `mal/mutations.ts`.
  Future<Map<String, dynamic>?> patchListStatus(
    int malId, {
    required Map<String, String> form,
    required String accessToken,
  }) async {
    final res = await _transport.patchForm(
      '$malApiBase/anime/$malId/my_list_status',
      form: form,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    if (!res.ok) throw MalApiError(res.statusCode);
    final data = res.data;
    return data is Map ? data.cast<String, dynamic>() : null;
  }
}
