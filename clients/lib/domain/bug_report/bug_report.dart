import 'dart:convert';

/// The bug-report backend (`{endpoint}/v1/reports`). Ported from the web
/// `bug-report.ts`; overridable for self-hosting.
const bugReportEndpoint = 'https://bugs.harbor.site';

/// How badly a bug hurts. The wire value matches the web `Severity`.
enum BugSeverity {
  low('low'),
  normal('normal'),
  high('high'),
  critical('critical');

  const BugSeverity(this.wire);
  final String wire;
}

/// A file attached to a report (an image or a log).
class BugReportFile {
  const BugReportFile({
    required this.name,
    required this.bytes,
    this.contentType,
  });

  final String name;
  final List<int> bytes;
  final String? contentType;
}

/// The user-entered fields of a report. Ported from `BugReportInput`.
class BugReportInput {
  const BugReportInput({
    required this.summary,
    this.severity = BugSeverity.normal,
    this.steps = '',
    this.expected = '',
    this.actual = '',
    this.reporterName = '',
    this.reporterGithub = '',
    this.reporterContact = '',
    this.consentCredit = true,
  });

  final String summary;
  final BugSeverity severity;
  final String steps;
  final String expected;
  final String actual;
  final String reporterName;
  final String reporterGithub;
  final String reporterContact;
  final bool consentCredit;

  /// The submit gate — web `canSubmit`: a meaningful summary is required.
  bool get isValid => summary.trim().length >= 6;
}

/// A captured runtime error, for the report's diagnostics buffer.
class BugError {
  const BugError({required this.ts, required this.msg, this.src});
  final int ts;
  final String msg;
  final String? src;

  Map<String, dynamic> toJson() => {
    'ts': ts,
    'msg': msg,
    if (src != null) 'src': src,
  };
}

/// The integration/health flags attached to a report. Ported from
/// `Diagnostics.flags`.
class BugFlags {
  const BugFlags({
    required this.playerEngine,
    required this.region,
    required this.hasTmdb,
    required this.hasRpdb,
    required this.hasTrakt,
    required this.hasStremio,
    required this.debridCount,
    required this.addonCount,
    required this.iptvCount,
  });

  final String playerEngine;
  final String region;
  final bool hasTmdb;
  final bool hasRpdb;
  final bool hasTrakt;
  final bool hasStremio;
  final int debridCount;
  final int addonCount;
  final int iptvCount;

  Map<String, dynamic> toJson() => {
    'playerEngine': playerEngine,
    'region': region,
    'hasTmdb': hasTmdb,
    'hasRpdb': hasRpdb,
    'hasTrakt': hasTrakt,
    'hasStremio': hasStremio,
    'debridCount': debridCount,
    'addonCount': addonCount,
    'iptvCount': iptvCount,
  };
}

/// The device/app snapshot sent with a report. Ported from `Diagnostics`. The
/// Flutter-specific values (version, OS) are injected by the caller so this stays
/// framework-free.
class BugDiagnostics {
  const BugDiagnostics({
    required this.appVersion,
    required this.os,
    this.osVersion = '',
    this.ua = '',
    this.viewport = '',
    this.locale = '',
    required this.flags,
    this.recentErrors = const [],
  });

  final String appVersion;
  final String os;
  final String osVersion;
  final String ua;
  final String viewport;
  final String locale;
  final BugFlags flags;
  final List<BugError> recentErrors;
}

/// A bounded ring buffer of recent runtime errors, mirroring the web
/// `installBugReportErrorCapture`/`getRecentErrors`. The app layer feeds it from
/// `FlutterError.onError` and `PlatformDispatcher.onError`.
class BugReportErrors {
  BugReportErrors({this.max = 50});
  final int max;
  final List<BugError> _buf = [];

  void push(String msg, {String? src, required int nowMs}) {
    final trimmed = msg.length > 600 ? msg.substring(0, 600) : msg;
    _buf.add(BugError(ts: nowMs, msg: trimmed, src: src));
    while (_buf.length > max) {
      _buf.removeAt(0);
    }
  }

  /// The most recent [n] errors (all of them by default).
  List<BugError> recent([int? n]) {
    if (n == null || n >= _buf.length) return List.unmodifiable(_buf);
    return List.unmodifiable(_buf.sublist(_buf.length - n));
  }

  void clear() => _buf.clear();
}

/// Sends a report's fields (and any files) as multipart to the backend and
/// returns the created report id. The concrete implementation lives in the app
/// layer (a Dio multipart POST); tests inject a fake.
abstract interface class BugReportTransport {
  Future<String> submit(
    String url,
    Map<String, String> fields,
    List<BugReportFile> files,
  );
}

/// Submits [input] with [diag] (and optional [files]) to the backend, returning
/// the new report id. Ported 1:1 from the web `submitBugReport` field mapping.
Future<String> submitBugReport(
  BugReportTransport transport,
  BugReportInput input,
  BugDiagnostics diag, {
  List<BugReportFile> files = const [],
}) {
  final fields = <String, String>{
    'summary': input.summary,
    'severity': input.severity.wire,
    'steps': input.steps,
    'expected': input.expected,
    'actual': input.actual,
    'reporter_name': input.reporterName,
    'reporter_github': input.reporterGithub,
    'reporter_contact': input.reporterContact,
    'consent_credit': input.consentCredit ? '1' : '0',
    'app_version': diag.appVersion,
    'os': diag.os,
    'os_version': diag.osVersion,
    'ua': diag.ua,
    'viewport': diag.viewport,
    'locale': diag.locale,
    'diagnostics': jsonEncode({
      'flags': diag.flags.toJson(),
      'recentErrors': diag.recentErrors.map((e) => e.toJson()).toList(),
    }),
  };
  return transport.submit('$bugReportEndpoint/v1/reports', fields, files);
}
