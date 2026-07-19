import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../domain/downloads/download_engine.dart';
import '../domain/downloads/download_file.dart';
import '../domain/downloads/downloads_store.dart';
import 'providers.dart';

/// The fixed browser User-Agent the download engine sends (`docs/60` step 18).
const _downloadUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/// The persistent downloads store (`harbor.downloads.v1`).
final downloadsStoreProvider = Provider<DownloadsStore>(
  (ref) => DownloadsStore(ref.watch(kvStoreProvider)),
);

ByteRangeSource _dioSource(Dio dio, String url, Map<String, String>? headers) {
  return (startByte) async {
    final h = <String, String>{
      'User-Agent': _downloadUa,
      // A Range from the resume offset, else from 0 (so servers reply 206 with a
      // Content-Range total). Caller headers win.
      'Range': 'bytes=$startByte-',
      if (headers == null ||
          !headers.keys.any((k) => k.toLowerCase() == 'accept'))
        'Accept': '*/*',
      ...?headers,
    };
    final res = await dio.get<ResponseBody>(
      url,
      options: Options(
        responseType: ResponseType.stream,
        headers: h,
        followRedirects: true,
        validateStatus: (_) => true,
      ),
    );
    final body = res.data!;
    return DownloadBytesResponse(
      statusCode: res.statusCode ?? 0,
      contentType: res.headers.value(Headers.contentTypeHeader),
      contentLength: int.tryParse(
        res.headers.value(Headers.contentLengthHeader) ?? '',
      ),
      contentRange: res.headers.value('content-range'),
      stream: body.stream.cast<List<int>>(),
    );
  };
}

Future<String> _downloadsDir() async {
  final base = await getApplicationDocumentsDirectory();
  final dir = Directory('${base.path}/Harbor Downloads');
  if (!await dir.exists()) await dir.create(recursive: true);
  return dir.path;
}

/// The app-lifetime download engine, driving the native download loop from a
/// Dio byte source into the [downloadsStoreProvider].
final downloadEngineProvider = Provider<DownloadEngine>((ref) {
  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(minutes: 30),
    ),
  );
  ref.onDispose(dio.close);
  return DownloadEngine(
    store: ref.watch(downloadsStoreProvider),
    downloadsDir: _downloadsDir,
    sourceFor: (url, headers) => _dioSource(dio, url, headers),
  );
});
