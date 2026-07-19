import 'dart:io';

import 'companion_crypto.dart';

/// Whether [host] is a LITERAL private / link-local / loopback IP — the only
/// hosts a companion link may target. Rejecting hostnames and public IPs is what
/// stops a spoofed `harbor://companion` QR from exfiltrating the typed value to
/// an attacker's server (the genuine TV always advertises a LAN IP).
///
/// SECURITY: the host must be a NUMERIC IP literal, validated by parsing it —
/// never a hostname. A prefix check on the raw string would wrongly accept
/// names like `fd.evil.com` or `fe80.attacker.net` (they "start with" a private
/// IPv6 range) and hand the typed secret to an attacker-controlled server. The
/// range tests below run on the parsed address bytes, so only true LAN literals
/// pass.
bool isPrivateCompanionHost(String host) {
  final addr = InternetAddress.tryParse(host);
  if (addr == null) return false; // hostnames and malformed input → reject
  final b = addr.rawAddress;
  if (addr.type == InternetAddressType.IPv4) {
    if (b[0] == 127) return true; // loopback 127.0.0.0/8
    if (b[0] == 10) return true; // 10.0.0.0/8
    if (b[0] == 192 && b[1] == 168) return true; // 192.168.0.0/16
    if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true; // 172.16.0.0/12
    if (b[0] == 169 && b[1] == 254) return true; // link-local 169.254.0.0/16
    return false;
  }
  // IPv6 (16 bytes), tested on the address bytes rather than the text form.
  if (b.length == 16 && b.take(15).every((x) => x == 0) && b[15] == 1) {
    return true; // loopback ::1
  }
  if (b[0] == 0xFC || b[0] == 0xFD) return true; // unique-local fc00::/7
  // Link-local fe80::/10 (first byte 0xFE, top two bits of the second 0b10).
  if (b[0] == 0xFE && (b[1] & 0xC0) == 0x80) return true;
  return false; // public IP → reject
}

/// The kind of value being entered — hints the phone's keyboard and validation.
enum CompanionKind { url, key, text }

String _kindStr(CompanionKind k) => switch (k) {
  CompanionKind.url => 'url',
  CompanionKind.key => 'key',
  CompanionKind.text => 'text',
};

/// The pairing details a TV encodes into its QR: a real http URL the phone's
/// browser opens directly (the TV serves the entry page over the LAN), plus the
/// out-of-band token to encrypt with and what is being entered.
class CompanionLink {
  const CompanionLink({
    required this.host,
    required this.port,
    required this.token,
    required this.kind,
    required this.label,
    this.configureUrl,
  });

  final String host;
  final int port;

  /// The 32-byte one-time session token (carried in the QR fragment only).
  final List<int> token;
  final CompanionKind kind;

  /// A human label for the field being filled (e.g. "Real-Debrid API token").
  final String label;

  /// An add-on's setup page (the `configure` URL), when this pairing is a
  /// "configure on your phone" flow rather than a plain value entry. The served
  /// page shows an "Open the setup page" link to it, then the viewer pastes the
  /// resulting install/manifest link back — which returns to the TV to install.
  /// Null for ordinary URL / API-key / text entry.
  final String? configureUrl;

  /// The real http URL the QR encodes and the phone browser opens. The token,
  /// kind, label, and (for a configure flow) the add-on setup URL live in the
  /// URL FRAGMENT (after `#`) so the server's GET never receives them — the
  /// served page reads them client-side, encrypts the typed value with the
  /// token, and POSTs the ciphertext. base64url keeps the token fragment-safe;
  /// the label and setup URL are percent-encoded by [Uri].
  String toPairingUrl() {
    final params = {'t': companionB64(token), 'k': _kindStr(kind), 'l': label};
    final configure = configureUrl;
    if (configure != null && configure.isNotEmpty) params['c'] = configure;
    final frag = Uri(queryParameters: params).query;
    return 'http://$host:$port/#$frag';
  }
}
