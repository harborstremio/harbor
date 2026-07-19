import 'package:dio/dio.dart';

import 'resolve.dart';

/// Production [LinkProber] over Dio: a short HEAD request reading the
/// content-type and content-length so resolution can reject web pages and
/// stub/error videos. Any failure resolves to `ok:false` (treated as
/// inconclusive by the caller). TLS is validated (never disabled).
class DioLinkProber implements LinkProber {
  DioLinkProber({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 5),
              receiveTimeout: const Duration(seconds: 5),
              sendTimeout: const Duration(seconds: 5),
              validateStatus: (_) => true,
            ),
          );

  final Dio _dio;

  @override
  Future<ProbeResult> head(String url, {Map<String, String>? headers}) async {
    try {
      final res = await _dio.head(url, options: Options(headers: headers));
      final status = res.statusCode ?? 0;
      final ok = status >= 200 && status < 400;
      final lenStr = res.headers.value('content-length');
      return ProbeResult(
        ok: ok,
        contentType: res.headers.value('content-type'),
        contentLength: lenStr != null ? int.tryParse(lenStr) : null,
      );
    } catch (_) {
      return const ProbeResult(ok: false);
    }
  }
}
