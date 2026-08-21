import 'm3u.dart';

String? _firstNonEmpty(String? a, String? b) {
  if (a != null && a.isNotEmpty) return a;
  if (b != null && b.isNotEmpty) return b;
  return null;
}

/// Builds the player HTTP headers a channel needs — a spoofed user-agent,
/// referer, or cookie captured from its `#EXTVLCOPT`/`|`-piped options — or null
/// when none apply. Ports `iptv/channel-headers.ts` `headersFromChannel`.
Map<String, String>? headersFromChannel(IptvChannel ch) {
  final out = <String, String>{};
  final ua = _firstNonEmpty(
    ch.attrs['vlcopt-user-agent'],
    ch.attrs['http-user-agent'],
  );
  final referer = _firstNonEmpty(
    ch.attrs['vlcopt-referrer'],
    ch.attrs['http-referrer'],
  );
  final cookie = ch.attrs['vlcopt-cookie'];
  if (ua != null) out['User-Agent'] = ua;
  if (referer != null) out['Referer'] = referer;
  if (cookie != null && cookie.isNotEmpty) out['Cookie'] = cookie;
  return out.isEmpty ? null : out;
}
