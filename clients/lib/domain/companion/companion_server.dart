import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cryptography/cryptography.dart';

import 'companion_crypto.dart';
import 'companion_link.dart';
import 'companion_page.dart';

/// A running phone → TV companion pairing session.
///
/// The TV binds an EPHEMERAL plain-HTTP server to its LAN address on a random
/// port and shows a QR encoding a real `http://<lan>:<port>/#<token…>` URL that
/// any phone browser can open — no Harbor app required. GET `/` returns a
/// self-contained page (a form plus inline pure-JS AES-256-GCM); the one-time
/// token / kind / label ride in the URL *fragment*, so this GET never carries
/// them. The page derives the key from the token, encrypts the typed value, and
/// POSTs only the ciphertext to `/submit`, so nothing sensitive ever crosses the
/// LAN in the clear. The server lives only while the pairing sheet is open: it
/// stops the instant a value arrives, on [timeout], or on [close].
///
/// Trust model — the guarantees and the one assumption:
///  • Confidentiality vs. a PASSIVE eavesdropper: the submitted value is
///    end-to-end AES-256-GCM encrypted under the out-of-band token, so a sniffer
///    on the LAN sees only ciphertext, and a client without the token can
///    neither read nor forge a payload.
///  • Exposure is bounded: the server binds to the LAN interface only, admits
///    only private/link-local clients ([isPrivateCompanionHost]), rate-limits,
///    caps the body, and is single-use with a short [timeout].
///  • ASSUMPTION — no ACTIVE on-path attacker. Because the page itself is
///    delivered over cleartext HTTP, an attacker who already holds an on-path
///    position on the LAN (ARP/DNS spoofing, rogue AP) could substitute their
///    own page during the brief pairing window and capture the value as it is
///    typed. This is inherent to cleartext-LAN delivery — a self-signed cert on
///    a bare IP would not fix it (the phone has no trust anchor to tell the real
///    cert from the attacker's). The TV shows the exact target URL on the
///    pairing sheet for out-of-band eyeball verification; treat the channel as
///    safe against passive/off-network attackers, not a hostile local network.
class CompanionSession {
  CompanionSession._(this._server, this.token, this._value, this._timer);

  final HttpServer _server;

  /// The one-time session token (32 bytes) carried out-of-band in the QR.
  final List<int> token;

  final Completer<String?> _value;
  final Timer _timer;

  /// The LAN host the phone connects to (e.g. `192.168.1.20`).
  String get host => _server.address.address;

  /// The random port the server is listening on.
  int get port => _server.port;

  /// Completes with the decrypted value the phone submitted, or null on
  /// timeout / cancellation.
  Future<String?> get value => _value.future;

  /// Stops the server and cancels the timeout. Idempotent.
  Future<void> close() async {
    _timer.cancel();
    if (!_value.isCompleted) _value.complete(null);
    await _server.close(force: true);
  }
}

/// Starts a companion pairing session, or throws [CompanionUnavailable] when no
/// LAN address is available (e.g. no network). [timeout] bounds how long the
/// server stays up.
Future<CompanionSession> startCompanionSession({
  Duration timeout = const Duration(minutes: 3),
  InternetAddress? bindAddress,
}) async {
  final lan = bindAddress ?? await _lanAddress();
  if (lan == null) throw const CompanionUnavailable();

  // Bind to the LAN interface only (never 0.0.0.0) on a random free port.
  final server = await HttpServer.bind(lan, 0, shared: false);
  server.idleTimeout = const Duration(seconds: 15);

  final token = companionToken();
  final key = await companionKey(token);
  final completer = Completer<String?>();
  final limiter = _RateLimiter();

  final timer = Timer(timeout, () {
    if (!completer.isCompleted) completer.complete(null);
    server.close(force: true);
  });

  final session = CompanionSession._(server, token, completer, timer);

  server.listen((req) async {
    final res = req.response;
    _harden(res);
    try {
      final remote = req.connectionInfo?.remoteAddress;
      // LAN-only: reject any client that is not on a private / link-local range.
      // Shares the one hardened, byte-accurate LAN predicate with the link gate.
      if (remote == null || !isPrivateCompanionHost(remote.address)) {
        res.statusCode = HttpStatus.forbidden;
        await res.close();
        return;
      }
      if (limiter.blocked(remote.address)) {
        res.statusCode = HttpStatus.tooManyRequests;
        await res.close();
        return;
      }
      if (req.method == 'POST' && req.uri.path == '/submit') {
        await _handleSubmit(req, res, key, completer, session);
        return;
      }
      if (req.method == 'GET' && req.uri.path == '/') {
        // Serve the self-contained pairing page (form + inline pure-JS crypto).
        // The token/kind/label ride in the URL fragment, so this GET carries
        // none of them; the page reads them client-side and POSTs ciphertext to
        // /submit. The page needs inline script/style + a same-origin POST, so
        // relax the CSP for THIS response only (the strict default-src 'none'
        // stays on /submit and everything else). An explicit html+charset with
        // nosniff blocks encoding-sniffing.
        res.statusCode = HttpStatus.ok;
        res.headers.contentType = ContentType.html;
        res.headers.set(
          'Content-Security-Policy',
          "default-src 'none'; script-src 'unsafe-inline'; "
              "style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; "
              "frame-src 'none'; child-src 'none'; object-src 'none'; "
              "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
        );
        res.write(companionPageHtml);
        await res.close();
        return;
      }
      res.statusCode = HttpStatus.notFound;
      await res.close();
    } catch (_) {
      try {
        res.statusCode = HttpStatus.internalServerError;
        await res.close();
      } catch (_) {}
    }
  }, onError: (_) {});

  // Tear the server down as soon as a value arrives.
  completer.future.whenComplete(() {
    timer.cancel();
    server.close(force: true);
  });

  return session;
}

Future<void> _handleSubmit(
  HttpRequest req,
  HttpResponse res,
  SecretKey key,
  Completer<String?> completer,
  CompanionSession session,
) async {
  // Cap the body so a hostile client can't exhaust memory.
  final raw = await _readCapped(req, 64 * 1024);
  String? value;
  if (raw != null) {
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final iv = companionUnb64(json['iv'] as String);
      final data = companionUnb64(json['data'] as String);
      value = await companionDecrypt(key: key, iv: iv, cipherAndTag: data);
    } catch (_) {
      value = null;
    }
  }
  if (value == null || value.isEmpty) {
    // Wrong token / tampered / malformed — reject without leaking why.
    res.statusCode = HttpStatus.badRequest;
    res.headers.contentType = ContentType.json;
    res.write('{"ok":false}');
    await res.close();
    return;
  }
  res.statusCode = HttpStatus.ok;
  res.headers.contentType = ContentType.json;
  res.write('{"ok":true}');
  await res.close();
  if (!completer.isCompleted) completer.complete(value);
}

/// Reads the request body as UTF-8, up to [maxBytes]; returns null if it
/// exceeds the cap.
Future<String?> _readCapped(HttpRequest req, int maxBytes) async {
  final chunks = <int>[];
  await for (final chunk in req) {
    chunks.addAll(chunk);
    if (chunks.length > maxBytes) return null;
  }
  try {
    return utf8.decode(chunks);
  } catch (_) {
    return null;
  }
}

void _harden(HttpResponse res) {
  res.headers
    ..set('Cache-Control', 'no-store')
    ..set('X-Content-Type-Options', 'nosniff')
    ..set('Referrer-Policy', 'no-referrer')
    // The API is same-origin only; deny cross-origin reads.
    ..set('Content-Security-Policy', "default-src 'none'");
}

/// The device's first private-range IPv4 LAN address, or null when offline.
Future<InternetAddress?> _lanAddress() async {
  try {
    final ifaces = await NetworkInterface.list(
      type: InternetAddressType.IPv4,
      includeLoopback: false,
      includeLinkLocal: false,
    );
    for (final iface in ifaces) {
      for (final addr in iface.addresses) {
        if (_isPrivateV4(addr.address)) return addr;
      }
    }
  } catch (_) {}
  return null;
}

bool _isPrivateV4(String ip) {
  final p = ip.split('.');
  if (p.length != 4) return false;
  final a = int.tryParse(p[0]) ?? -1;
  final b = int.tryParse(p[1]) ?? -1;
  if (a == 10) return true;
  if (a == 192 && b == 168) return true;
  if (a == 172 && b >= 16 && b <= 31) return true;
  return false;
}

/// Thrown when no LAN address is available to host the pairing server.
class CompanionUnavailable implements Exception {
  const CompanionUnavailable();
  @override
  String toString() => 'No local network available for phone pairing.';
}

/// A simple per-client sliding-window limiter — a hostile client can't brute
/// the token by flooding /submit.
class _RateLimiter {
  static const _max = 30;
  static const _window = Duration(seconds: 30);
  final Map<String, List<DateTime>> _hits = {};

  bool blocked(String key) {
    final now = DateTime.now();
    final list = _hits.putIfAbsent(key, () => <DateTime>[])
      ..removeWhere((t) => now.difference(t) > _window);
    list.add(now);
    return list.length > _max;
  }
}
