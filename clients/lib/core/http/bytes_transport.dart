import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'json_transport.dart';

/// A raw-bytes HTTP response (used for gzipped XMLTV EPG payloads).
class BytesResponse {
  const BytesResponse(this.statusCode, this.reasonPhrase, this.bytes);

  final int statusCode;
  final String reasonPhrase;
  final Uint8List bytes;

  bool get ok => statusCode >= 200 && statusCode < 300;
}

/// Direct raw-bytes HTTP — no CORS proxy. Injectable so the EPG loader can be
/// unit-tested with canned payloads. A transport-level failure surfaces as
/// [TransportException].
abstract interface class BytesTransport {
  Future<BytesResponse> getBytes(String url, {Map<String, String>? headers});
}

/// Production bytes transport backed by Dio. Reads the body as raw bytes (the
/// XMLTV parser handles any gzip), validates the TLS chain (never disabled),
/// and treats an idle gap over 25s as a stall (matching the web EPG reader).
class DioBytesTransport implements BytesTransport {
  DioBytesTransport({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 30),
              receiveTimeout: const Duration(seconds: 25),
              responseType: ResponseType.bytes,
              validateStatus: (_) => true,
            ),
          );

  final Dio _dio;

  @override
  Future<BytesResponse> getBytes(
    String url, {
    Map<String, String>? headers,
  }) async {
    try {
      final res = await _dio.get<List<int>>(
        url,
        options: Options(headers: headers, responseType: ResponseType.bytes),
      );
      final data = res.data ?? const <int>[];
      final bytes = data is Uint8List
          ? data
          : Uint8List.fromList(List<int>.from(data));
      return BytesResponse(res.statusCode ?? 0, res.statusMessage ?? '', bytes);
    } on DioException catch (e) {
      final detail = e.error?.toString() ?? e.message ?? 'Network error';
      throw TransportException('${e.type.name}: $detail', cause: e);
    }
  }
}

/// Bytes transport that delegates to a function — a real, reusable
/// implementation used by tests to return canned payloads without a network.
class FnBytesTransport implements BytesTransport {
  const FnBytesTransport(this.handler);

  final Future<BytesResponse> Function(String url, Map<String, String>? headers)
  handler;

  @override
  Future<BytesResponse> getBytes(String url, {Map<String, String>? headers}) =>
      handler(url, headers);
}
