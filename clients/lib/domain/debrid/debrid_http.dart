import 'package:dio/dio.dart';

/// A raw debrid HTTP response: status code plus the decoded body (a `Map`/`List`
/// for JSON, a `String` for text/plain, or null). Debrid providers inspect the
/// status and body directly, so — unlike the addon transport — there is no retry
/// or status validation here.
class DebridResponse {
  const DebridResponse(this.status, this.body);
  final int status;
  final dynamic body;

  bool get ok => status >= 200 && status < 300;

  /// The body as a JSON map, or null if it is not a map.
  Map<String, dynamic>? get map =>
      body is Map ? (body as Map).cast<String, dynamic>() : null;
}

/// Raised for transport-level failures (network down, TLS, cancellation) so the
/// provider's error wrapper can convert them to a typed failure.
class DebridNetworkException implements Exception {
  const DebridNetworkException(this.aborted, [this.cause]);
  final bool aborted;
  final Object? cause;
}

/// The HTTP surface the debrid providers need: GET, form/JSON POST, and DELETE,
/// each returning the raw status and body. Injectable for tests.
abstract interface class DebridHttp {
  Future<DebridResponse> get(String url, {Map<String, String>? headers});
  Future<DebridResponse> postForm(
    String url,
    Map<String, Object> form, {
    Map<String, String>? headers,
  });
  Future<DebridResponse> postJson(
    String url,
    Object? body, {
    Map<String, String>? headers,
  });
  Future<DebridResponse> delete(String url, {Map<String, String>? headers});
}

/// Production debrid HTTP over Dio. TLS is validated (never disabled); every
/// status is surfaced (no throw on 4xx/5xx).
class DioDebridHttp implements DebridHttp {
  DioDebridHttp({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
              validateStatus: (_) => true,
            ),
          );

  final Dio _dio;

  @override
  Future<DebridResponse> get(String url, {Map<String, String>? headers}) =>
      _send(() => _dio.get(url, options: Options(headers: headers)));

  @override
  Future<DebridResponse> postForm(
    String url,
    Map<String, Object> form, {
    Map<String, String>? headers,
  }) => _send(
    // Pass the raw map (not FormData): Dio URL-encodes a map under the
    // form-urlencoded content type, matching the reference contract
    // (`URLSearchParams` + `application/x-www-form-urlencoded`). FormData would
    // force `multipart/form-data`, which the debrid form endpoints reject.
    () => _dio.post(
      url,
      data: form,
      options: Options(
        headers: headers,
        contentType: Headers.formUrlEncodedContentType,
      ),
    ),
  );

  @override
  Future<DebridResponse> postJson(
    String url,
    Object? body, {
    Map<String, String>? headers,
  }) => _send(
    () => _dio.post(
      url,
      data: body,
      options: Options(headers: headers, contentType: Headers.jsonContentType),
    ),
  );

  @override
  Future<DebridResponse> delete(String url, {Map<String, String>? headers}) =>
      _send(() => _dio.delete(url, options: Options(headers: headers)));

  Future<DebridResponse> _send(Future<Response> Function() run) async {
    try {
      final res = await run();
      return DebridResponse(res.statusCode ?? 0, res.data);
    } on DioException catch (e) {
      throw DebridNetworkException(e.type == DioExceptionType.cancel, e);
    }
  }
}

/// A debrid HTTP that delegates to a function — a real implementation used by
/// tests to script provider flows without a network.
class FnDebridHttp implements DebridHttp {
  const FnDebridHttp(this.handler);

  final Future<DebridResponse> Function(
    String method,
    String url,
    Object? body,
    Map<String, String>? headers,
  )
  handler;

  @override
  Future<DebridResponse> get(String url, {Map<String, String>? headers}) =>
      handler('GET', url, null, headers);

  @override
  Future<DebridResponse> postForm(
    String url,
    Map<String, Object> form, {
    Map<String, String>? headers,
  }) => handler('POST', url, form, headers);

  @override
  Future<DebridResponse> postJson(
    String url,
    Object? body, {
    Map<String, String>? headers,
  }) => handler('POST', url, body, headers);

  @override
  Future<DebridResponse> delete(String url, {Map<String, String>? headers}) =>
      handler('DELETE', url, null, headers);
}
