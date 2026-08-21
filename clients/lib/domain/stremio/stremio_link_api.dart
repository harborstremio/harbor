import '../../core/http/json_transport.dart';
import '../../core/result.dart';

/// A device-code created by Stremio Link.
class LinkCode {
  const LinkCode({required this.code, this.link, this.qrcode});

  final String code;

  /// The URL to open on the phone (`link.stremio.com/...`).
  final String? link;

  /// A QR image URL encoding [link].
  final String? qrcode;
}

/// Stremio Link (`https://link.stremio.com/api`) — the QR / device-code sign-in
/// used on TVs. `create` mints a short code; `read` is polled until the phone
/// approves it, at which point it yields an authKey. While pending, Stremio
/// returns error code 101, surfaced here as `Ok(null)` (keep polling).
class StremioLinkApi {
  StremioLinkApi(this._t, {this.base = 'https://link.stremio.com/api'});

  final JsonTransport _t;
  final String base;

  Future<Result<LinkCode>> create() async {
    try {
      final res = await _t.postJson('$base/create');
      final d = res.data;
      if (d is Map && d['code'] != null) {
        return Ok(
          LinkCode(
            code: d['code'].toString(),
            link: d['link']?.toString(),
            qrcode: d['qrcode']?.toString(),
          ),
        );
      }
      return Err(
        Failure('Could not create a link code (HTTP ${res.statusCode})'),
      );
    } on TransportException catch (e) {
      return Err(Failure(e.message, cause: e));
    }
  }

  /// Polls the code. Returns the authKey when approved, `null` while still
  /// pending (error 101), or an [Err] for any other error.
  Future<Result<String?>> read(String code) async {
    try {
      final res = await _t.getJson('$base/read?code=$code');
      final d = res.data;
      final key = _extractAuthKey(d);
      if (key != null) return Ok(key);
      if (d is Map && d['error'] != null) {
        final error = d['error'];
        final errCode = error is Map ? (error['code'] as num?)?.toInt() : null;
        if (errCode == 101) return const Ok(null); // pending — keep polling
        final msg = error is Map
            ? (error['message']?.toString() ?? 'Link failed')
            : error.toString();
        return Err(Failure(msg, code: errCode));
      }
      return const Ok(null);
    } on TransportException catch (e) {
      return Err(Failure(e.message, cause: e));
    }
  }

  String? _extractAuthKey(dynamic data) {
    if (data is! Map) return null;
    final result = data['result'];
    if (result is String && result.length > 8) return result;
    if (result is Map && result['authKey'] is String) {
      return result['authKey'] as String;
    }
    if (data['authKey'] is String) return data['authKey'] as String;
    return null;
  }
}
