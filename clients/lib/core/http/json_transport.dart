import 'dart:async';

import 'package:dio/dio.dart';

/// A decoded JSON HTTP response.
class JsonResponse {
  const JsonResponse(this.statusCode, this.data);

  final int statusCode;

  /// Decoded JSON (`Map`, `List`, or a primitive), or `null` for an empty body.
  final dynamic data;

  bool get ok => statusCode >= 200 && statusCode < 300;
}

/// Thrown for transport-level failures (network down, timeout, TLS) — distinct
/// from an application error carried inside a 2xx JSON body.
class TransportException implements Exception {
  const TransportException(this.message, {this.cause});
  final String message;
  final Object? cause;
  @override
  String toString() => 'TransportException($message)';
}

/// Direct JSON HTTP — no CORS proxy (native has no CORS). Injectable so the
/// Stremio/addon/provider clients can be unit-tested with a canned transport.
abstract interface class JsonTransport {
  Future<JsonResponse> postJson(
    String url, {
    Object? body,
    Map<String, String>? headers,
  });

  Future<JsonResponse> getJson(String url, {Map<String, String>? headers});

  /// A form-encoded `PATCH` (`application/x-www-form-urlencoded`) — the shape
  /// MyAnimeList's `my_list_status` update requires. [form] is sent as the
  /// url-encoded body.
  Future<JsonResponse> patchForm(
    String url, {
    required Map<String, String> form,
    Map<String, String>? headers,
  });

  /// A `DELETE` with no body — the shape Trakt's un-like / delete-comment
  /// endpoints require.
  Future<JsonResponse> deleteJson(String url, {Map<String, String>? headers});
}

/// Production transport backed by Dio. Retries idempotent-safe on 429/5xx with
/// exponential backoff (providers like TMDB expect a few retries), validates the
/// TLS chain (never disabled), and surfaces network failures as
/// [TransportException].
class DioJsonTransport implements JsonTransport {
  DioJsonTransport({Dio? dio, this.maxRetries = 3})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
              responseType: ResponseType.json,
              validateStatus: (_) => true,
              // Present as a browser, 1:1 with the desktop app's native
              // `harbor_fetch` (src-tauri/src/http_fetch.rs). Several upstreams
              // (Jikan/MyAnimeList and other Cloudflare-fronted APIs) throttle
              // or challenge the default Dart client but serve a browser
              // fingerprint — the reason anime rows loaded on the Mac app but
              // not here.
              headers: {
                'User-Agent': _browserUa,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
              },
            ),
          );

  static const _browserUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  final Dio _dio;
  final int maxRetries;

  @override
  Future<JsonResponse> postJson(
    String url, {
    Object? body,
    Map<String, String>? headers,
  }) => _send(() => _dio.post(url, data: body, options: _opts(headers)));

  @override
  Future<JsonResponse> getJson(String url, {Map<String, String>? headers}) =>
      // A GET carries no body — sending `content-type: application/json` (as
      // _opts does) is a non-browser signal Cloudflare flags, so pass only the
      // caller's headers here (the browser UA/Accept come from BaseOptions).
      _send(() => _dio.get(url, options: Options(headers: headers)));

  @override
  Future<JsonResponse> patchForm(
    String url, {
    required Map<String, String> form,
    Map<String, String>? headers,
  }) => _send(
    () => _dio.patch(
      url,
      data: form,
      options: Options(
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          ...?headers,
        },
      ),
    ),
  );

  @override
  Future<JsonResponse> deleteJson(String url, {Map<String, String>? headers}) =>
      _send(() => _dio.delete(url, options: Options(headers: headers)));

  Options _opts(Map<String, String>? headers) =>
      Options(headers: {'content-type': 'application/json', ...?headers});

  Future<JsonResponse> _send(Future<Response> Function() run) async {
    var attempt = 0;
    while (true) {
      try {
        final res = await run();
        final status = res.statusCode ?? 0;
        if ((status == 429 || status >= 500) && attempt < maxRetries) {
          attempt++;
          await Future.delayed(
            Duration(milliseconds: 300 * (1 << (attempt - 1))),
          );
          continue;
        }
        return JsonResponse(status, res.data);
      } on DioException catch (e) {
        if (attempt < maxRetries &&
            (e.type == DioExceptionType.connectionTimeout ||
                e.type == DioExceptionType.receiveTimeout ||
                e.type == DioExceptionType.connectionError)) {
          attempt++;
          await Future.delayed(
            Duration(milliseconds: 300 * (1 << (attempt - 1))),
          );
          continue;
        }
        throw TransportException(e.message ?? 'Network error', cause: e);
      }
    }
  }
}

/// Transport that delegates to a function — a real, reusable implementation used
/// by tests to return canned responses without a network.
class FnJsonTransport implements JsonTransport {
  const FnJsonTransport(this.handler);

  final Future<JsonResponse> Function(
    String method,
    String url,
    Object? body,
    Map<String, String>? headers,
  )
  handler;

  @override
  Future<JsonResponse> postJson(
    String url, {
    Object? body,
    Map<String, String>? headers,
  }) => handler('POST', url, body, headers);

  @override
  Future<JsonResponse> getJson(String url, {Map<String, String>? headers}) =>
      handler('GET', url, null, headers);

  @override
  Future<JsonResponse> deleteJson(String url, {Map<String, String>? headers}) =>
      handler('DELETE', url, null, headers);

  @override
  Future<JsonResponse> patchForm(
    String url, {
    required Map<String, String> form,
    Map<String, String>? headers,
  }) => handler('PATCH', url, form, headers);
}
