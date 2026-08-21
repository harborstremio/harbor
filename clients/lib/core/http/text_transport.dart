import 'package:dio/dio.dart';

import 'json_transport.dart';

/// A raw-text HTTP response (used for M3U playlists and other non-JSON bodies).
class TextResponse {
  const TextResponse(this.statusCode, this.reasonPhrase, this.body);

  final int statusCode;
  final String reasonPhrase;
  final String body;

  bool get ok => statusCode >= 200 && statusCode < 300;
}

/// Direct raw-text HTTP — no CORS proxy. Injectable so the IPTV playlist
/// fetcher can be unit-tested with a canned transport. A transport-level
/// failure (network down, DNS, timeout, TLS) surfaces as [TransportException].
abstract interface class TextTransport {
  Future<TextResponse> getText(String url, {Map<String, String>? headers});
}

/// Production text transport backed by Dio. Reads bodies as plain text (never
/// JSON-parsed), validates the TLS chain (never disabled), and normalises Dio
/// failures into [TransportException] whose message preserves the underlying
/// cause (host-lookup/refused/reset/timeout) for downstream classification.
class DioTextTransport implements TextTransport {
  DioTextTransport({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 30),
              receiveTimeout: const Duration(seconds: 60),
              responseType: ResponseType.plain,
              validateStatus: (_) => true,
            ),
          );

  final Dio _dio;

  @override
  Future<TextResponse> getText(
    String url, {
    Map<String, String>? headers,
  }) async {
    try {
      final res = await _dio.get(
        url,
        options: Options(headers: headers, responseType: ResponseType.plain),
      );
      return TextResponse(
        res.statusCode ?? 0,
        res.statusMessage ?? '',
        res.data?.toString() ?? '',
      );
    } on DioException catch (e) {
      final detail = e.error?.toString() ?? e.message ?? 'Network error';
      throw TransportException('${e.type.name}: $detail', cause: e);
    }
  }
}

/// Text transport that delegates to a function — a real, reusable
/// implementation used by tests to return canned responses without a network.
class FnTextTransport implements TextTransport {
  const FnTextTransport(this.handler);

  final Future<TextResponse> Function(String url, Map<String, String>? headers)
  handler;

  @override
  Future<TextResponse> getText(String url, {Map<String, String>? headers}) =>
      handler(url, headers);
}
