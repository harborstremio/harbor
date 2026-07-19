import '../../core/http/json_transport.dart';
import '../../core/http/text_transport.dart';

/// The client UA IPTV providers expect (many reject generic clients). Ported
/// from `iptv/store.ts` `iptvFetch`.
const String iptvUserAgent = 'VLC/3.0.20 LibVLC/3.0.20';

/// The M3U Accept header. Ported from `iptv/store.ts`.
const String iptvM3uAccept =
    'audio/x-mpegurl, application/x-mpegURL, application/octet-stream, */*';

/// The playlist parse cap (80 MB of text). Ported from `PARSE_LIMIT_BYTES`.
const int iptvM3uMaxChars = 80 * 1024 * 1024;

const int _connectTimeoutS = 30;

/// A playlist fetch failure with a human-readable, provider-specific message.
class IptvFetchError implements Exception {
  const IptvFetchError(this.message);
  final String message;
  @override
  String toString() => 'IptvFetchError: $message';
}

/// Fetches an M3U playlist body as text, spoofing the VLC UA, mapping HTTP and
/// network failures to actionable messages, and enforcing the [maxChars] cap
/// and a non-empty body. Ports `iptv/store.ts` `fetchM3uText`.
Future<String> fetchM3uText(
  TextTransport t,
  String url, {
  int maxChars = iptvM3uMaxChars,
}) async {
  final TextResponse res;
  try {
    res = await t.getText(
      url,
      headers: const {'User-Agent': iptvUserAgent, 'Accept': iptvM3uAccept},
    );
  } on TransportException catch (e) {
    throw IptvFetchError(_networkErrorMessage(e.message));
  }
  if (!res.ok) {
    throw IptvFetchError(_httpErrorMessage(res.statusCode, res.reasonPhrase));
  }
  final text = res.body;
  if (text.isEmpty) {
    throw const IptvFetchError('Playlist server returned an empty body');
  }
  if (text.length > maxChars) {
    final mb = (text.length / 1024 / 1024).toStringAsFixed(1);
    throw IptvFetchError('Playlist is too large ($mb MB). 80 MB limit.');
  }
  return text;
}

String _httpErrorMessage(int status, String statusText) {
  switch (status) {
    case 401:
      return 'HTTP 401: bad username or password. Check the URL credentials '
          'with your provider.';
    case 403:
      return 'HTTP 403: your IP or device is blocked from this playlist. Some '
          'providers geo-restrict or device-limit accounts.';
    case 404:
      return 'HTTP 404: playlist URL not found on this server. Check the URL '
          'for typos.';
    case 429:
      return 'HTTP 429: provider is rate-limiting your account. Wait a minute '
          'and try again.';
    case 503:
      return 'HTTP 503: provider is refusing service right now. Most common '
          'cause: account is at its max-connections limit (other '
          'devices/players still logged in). Close other sessions, or contact '
          'your provider if the credentials are valid.';
    default:
      return 'HTTP $status $statusText';
  }
}

String _networkErrorMessage(String raw) {
  final lower = raw.toLowerCase();
  if (lower.contains('timeout') ||
      lower.contains('cancel') ||
      lower.contains('abort')) {
    return 'Server did not respond (gave up after ${_connectTimeoutS}s). The '
        'provider may be rate-limiting your IP or down.';
  }
  if (lower.contains('host lookup') ||
      lower.contains('dns') ||
      lower.contains('resolve')) {
    return 'Could not resolve playlist hostname. Check the URL for typos.';
  }
  if (lower.contains('refused')) {
    return 'Playlist server refused the connection.';
  }
  if (lower.contains('reset')) {
    return 'Playlist server reset the connection. Some providers reject '
        'generic clients; try with their official app to confirm credentials '
        'work.';
  }
  return 'Network error: $raw';
}
