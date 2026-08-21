import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../domain/bug_report/bug_report.dart';
import 'providers.dart';
import 'stremio_auth.dart';
import 'trakt_providers.dart';

/// A failed report submission — carries the backend's message when present.
class BugReportError implements Exception {
  BugReportError(this.message);
  final String message;
  @override
  String toString() => message;
}

/// The real transport: POSTs the report as `multipart/form-data` to the backend
/// (Dio), matching the web `FormData` submission.
class DioBugReportTransport implements BugReportTransport {
  DioBugReportTransport([Dio? dio]) : _dio = dio ?? Dio();
  final Dio _dio;

  @override
  Future<String> submit(
    String url,
    Map<String, String> fields,
    List<BugReportFile> files,
  ) async {
    final form = FormData.fromMap({
      ...fields,
      if (files.isNotEmpty)
        'files': [
          for (final f in files)
            MultipartFile.fromBytes(f.bytes, filename: f.name),
        ],
    });
    final res = await _dio.post<dynamic>(
      url,
      data: form,
      options: Options(
        responseType: ResponseType.json,
        validateStatus: (_) => true,
      ),
    );
    final data = res.data;
    final code = res.statusCode ?? 0;
    if (code < 200 || code >= 300) {
      final msg = (data is Map ? data['error'] : null) ?? 'HTTP $code';
      throw BugReportError(msg.toString());
    }
    final id = data is Map ? data['id'] : null;
    return id?.toString() ?? '';
  }
}

/// The bug-report submission transport.
final bugReportTransportProvider = Provider<BugReportTransport>(
  (ref) => DioBugReportTransport(),
);

/// The session-wide recent-error buffer attached to reports' diagnostics. The
/// app bootstrap feeds it from `FlutterError.onError` / `PlatformDispatcher`.
final bugReportErrorsProvider = Provider<BugReportErrors>(
  (ref) => BugReportErrors(),
);

String _osName() {
  if (Platform.isIOS) return 'iOS';
  if (Platform.isAndroid) return 'Android';
  if (Platform.isMacOS) return 'macOS';
  if (Platform.isWindows) return 'Windows';
  if (Platform.isLinux) return 'Linux';
  return Platform.operatingSystem;
}

/// Assembles the report diagnostics from the running app — version/OS, the
/// integration flags, and the recent-error buffer. Ported from web
/// `collectDiagnostics`; [viewport] is the current screen size (`WxH`).
Future<BugDiagnostics> collectBugDiagnostics(
  WidgetRef ref, {
  required String viewport,
}) async {
  final s = ref.read(settingsProvider);
  final info = await PackageInfo.fromPlatform();
  final version = info.buildNumber.isEmpty
      ? info.version
      : '${info.version}+${info.buildNumber}';
  final debridCount = const [
    'rdKey',
    'tbKey',
    'adKey',
    'pmKey',
    'dlKey',
  ].where((k) => s.getString(k).isNotEmpty).length;
  final iptvCount = (s['iptvPlaylists'] as List?)?.length ?? 0;
  return BugDiagnostics(
    appVersion: version,
    os: _osName(),
    osVersion: Platform.operatingSystemVersion,
    ua: 'Harbor/$version (${_osName()})',
    viewport: viewport,
    locale: Platform.localeName,
    flags: BugFlags(
      playerEngine: s.getString('playerEngine'),
      region: s.getString('region'),
      hasTmdb: s.getString('tmdbKey').isNotEmpty,
      hasRpdb: s.getString('rpdbKey').isNotEmpty,
      hasTrakt: ref.read(traktConnectedProvider),
      hasStremio: ref.read(stremioSessionProvider).asData?.value != null,
      debridCount: debridCount,
      addonCount: 0,
      iptvCount: iptvCount,
    ),
    recentErrors: ref.read(bugReportErrorsProvider).recent(20),
  );
}
