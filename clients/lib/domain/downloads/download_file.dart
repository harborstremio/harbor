import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'download_filename.dart';

// The download core loop, ported from the Rust `download.rs` spec in `docs/60`:
// a `.part` temp file with HTTP Range resume, the anti-stub content/size guards,
// cooperative cancellation, and an atomic rename on success. The byte fetch is
// injected as a [ByteRangeSource] so the loop is testable and the platform
// engine can supply a Dio-backed source.

/// A ranged HTTP response the download loop consumes.
class DownloadBytesResponse {
  const DownloadBytesResponse({
    required this.statusCode,
    required this.stream,
    this.contentType,
    this.contentLength,
    this.contentRange,
  });

  final int statusCode;
  final Stream<List<int>> stream;
  final String? contentType;

  /// The `Content-Length` header (bytes of *this* response body).
  final int? contentLength;

  /// The `Content-Range` header, `bytes {start}-{end}/{total}` (resume).
  final String? contentRange;
}

/// Fetches [url] optionally from [startByte] (a `Range: bytes=startByte-` request).
typedef ByteRangeSource = Future<DownloadBytesResponse> Function(int startByte);

/// A finished-or-cancelled download; a failure throws [DownloadException].
class DownloadOutcome {
  const DownloadOutcome({required this.received, required this.canceled});
  final int received;
  final bool canceled;
}

/// A download failure with a human-readable [message].
class DownloadException implements Exception {
  const DownloadException(this.message);
  final String message;
  @override
  String toString() => 'DownloadException: $message';
}

final RegExp _totalRe = RegExp(r'/(\d+)\s*$');

int? _totalFromContentRange(String? contentRange) {
  if (contentRange == null) return null;
  final m = _totalRe.firstMatch(contentRange.trim());
  return m == null ? null : int.tryParse(m.group(1)!);
}

/// Downloads to [destPath] via [source], resuming from any existing `.part`.
/// Calls [onStarted] once (with the total and whether it resumed) and [onProgress]
/// as bytes arrive; polls [isCancelled] cooperatively. Returns the outcome or
/// throws [DownloadException].
Future<DownloadOutcome> downloadToFile({
  required String destPath,
  required ByteRangeSource source,
  void Function(int received, int? total, bool resumed)? onStarted,
  void Function(int received, int? total)? onProgress,
  bool Function()? isCancelled,
}) async {
  final part = File('$destPath.part');
  await part.parent.create(recursive: true);
  final startByte = await part.exists() ? await part.length() : 0;

  final res = await source(startByte);

  // A 416 on a resume means the `.part` is already the whole file.
  if (res.statusCode == 416 && startByte > 0) {
    await part.rename(destPath);
    onStarted?.call(startByte, startByte, true);
    return DownloadOutcome(received: startByte, canceled: false);
  }

  // Anti-stub content guard: an error page returned instead of the video.
  if (isStubContentType(res.contentType) ||
      (res.contentLength != null && res.contentLength! < kMinDeclaredBytes)) {
    final snippet = await _snippet(res.stream);
    final type = res.contentType ?? 'text';
    throw DownloadException(
      'source returned a $type page, not the video: $snippet',
    );
  }

  final resuming = startByte > 0 && res.statusCode == 206;
  final total = resuming
      ? (_totalFromContentRange(res.contentRange) ??
            (res.contentLength != null ? startByte + res.contentLength! : null))
      : res.contentLength;

  final sink = part.openWrite(
    mode: resuming ? FileMode.append : FileMode.write,
  );
  var received = resuming ? startByte : 0;
  onStarted?.call(received, total, resuming);

  try {
    await for (final chunk in res.stream) {
      if (isCancelled?.call() ?? false) {
        await sink.flush();
        await sink.close();
        return DownloadOutcome(received: received, canceled: true);
      }
      sink.add(chunk);
      received += chunk.length;
      onProgress?.call(received, total);
    }
    await sink.flush();
    await sink.close();
  } catch (_) {
    await sink.close();
    rethrow;
  }

  // Reject a stub: too small to be the video.
  if (received < kMinVideoBytes) {
    if (await part.exists()) await part.delete();
    throw DownloadException(
      'source returned only $received bytes, not the video',
    );
  }

  await part.rename(destPath);
  return DownloadOutcome(received: received, canceled: false);
}

/// Reads up to the first 160 characters of an error-page body for the message.
Future<String> _snippet(Stream<List<int>> stream) async {
  final bytes = <int>[];
  await for (final chunk in stream) {
    bytes.addAll(chunk);
    if (bytes.length >= 320) break;
  }
  final text = utf8.decode(bytes, allowMalformed: true);
  return text.length > 160 ? text.substring(0, 160) : text;
}
