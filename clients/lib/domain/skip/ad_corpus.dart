import 'dart:convert';
import 'dart:typed_data';

import 'package:ed25519_edwards/ed25519_edwards.dart' as ed;

import '../../core/http/json_transport.dart';
import 'ad_fingerprint.dart';
import 'skip_segment.dart';

/// The signed injected-ad corpus, ported 1:1 from web
/// `src/lib/skip-intro/adcorpus.ts`. The corpus is a community-maintained,
/// Ed25519-**signed** list of ad ranges keyed by content + source fingerprint;
/// an unsigned or tampered corpus is rejected, never trusted.
const String kAdCorpusUrl = 'https://harbor.site/updates/ad-segments.json';

/// The Ed25519 public key (base64, 32 raw bytes) the corpus is signed with —
/// the same key the web build verifies against.
const String kAdCorpusPublicKey =
    'yszDA2+G0Rtep39h67iuhl8+5pCQkM+O4D4pMnpg4Ks=';

/// One corpus record: the ad [ranges] (seconds) for a given content + source.
class AdCorpusEntry {
  const AdCorpusEntry({
    required this.content,
    required this.source,
    required this.ranges,
  });

  final String content;
  final String source;
  final List<({double start, double end})> ranges;
}

/// Fetches, verifies and caches the signed ad corpus and resolves the ad
/// [SkipSegment]s for a given fingerprint.
class AdCorpus {
  AdCorpus(this._transport, {this.publicKeyB64 = kAdCorpusPublicKey});

  final JsonTransport _transport;

  /// The Ed25519 public key (base64) the corpus signature is checked against.
  /// Defaults to the production key; injectable so tests can sign with their
  /// own keypair.
  final String publicKeyB64;

  List<AdCorpusEntry>? _cache;

  /// The ad segments for [content]/[source]. Returns empty unless the source is
  /// a torrent (`ih_`) or parsed-release (`rg_`) key — bare-URL rips are never
  /// matched. [fresh] bypasses the in-memory cache.
  Future<List<SkipSegment>> segmentsFor({
    required String content,
    required String source,
    bool fresh = false,
  }) async {
    if (content.isEmpty) return const [];
    if (!adSourceReportable(source)) return const [];
    final entries = await _loadCorpus(fresh: fresh);
    final out = <SkipSegment>[];
    for (final e in entries) {
      if (e.content != content || e.source != source) continue;
      for (final r in e.ranges) {
        if (!r.start.isFinite || !r.end.isFinite || r.end <= r.start) continue;
        out.add(
          SkipSegment(
            kind: SkipKind.ad,
            startSec: r.start,
            endSec: r.end,
            source: SkipSource.adcorpus,
          ),
        );
      }
    }
    return out;
  }

  Future<List<AdCorpusEntry>> _loadCorpus({bool fresh = false}) async {
    if (!fresh && _cache != null) return _cache!;
    final loaded = await _load();
    _cache = loaded;
    return loaded;
  }

  Future<List<AdCorpusEntry>> _load() async {
    try {
      final res = await _transport.getJson(kAdCorpusUrl);
      if (!res.ok) return const [];
      var data = res.data;
      // The signed envelope may arrive already decoded (JSON content-type) or
      // as a raw string; handle both.
      if (data is String) {
        try {
          data = jsonDecode(data);
        } catch (_) {
          return const [];
        }
      }
      if (data is! Map) return const [];
      final payload = data['payload'];
      final sig = data['sig'];
      if (payload is! String ||
          sig is! String ||
          payload.isEmpty ||
          sig.isEmpty) {
        return const [];
      }
      if (!verifyAdCorpusSignature(payload, sig, publicKeyB64: publicKeyB64)) {
        return const [];
      }
      final parsed = jsonDecode(payload);
      if (parsed is! List) return const [];
      return parsed
          .map(_entryFrom)
          .whereType<AdCorpusEntry>()
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  static AdCorpusEntry? _entryFrom(dynamic e) {
    if (e is! Map) return null;
    final content = e['content'];
    final source = e['source'];
    final ranges = e['ranges'];
    if (content is! String || source is! String || ranges is! List) return null;
    final rs = <({double start, double end})>[];
    for (final r in ranges) {
      if (r is! Map) continue;
      final s = (r['start'] as num?)?.toDouble();
      final en = (r['end'] as num?)?.toDouble();
      if (s == null || en == null) continue;
      rs.add((start: s, end: en));
    }
    return AdCorpusEntry(content: content, source: source, ranges: rs);
  }
}

/// Verifies an Ed25519 [sigB64] (base64) over the UTF-8 bytes of [payload]
/// against [kAdCorpusPublicKey]. Any decode/verify failure returns false — an
/// unverified corpus is discarded, matching web `verify`.
bool verifyAdCorpusSignature(
  String payload,
  String sigB64, {
  String publicKeyB64 = kAdCorpusPublicKey,
}) {
  try {
    final pub = ed.PublicKey(base64Decode(publicKeyB64));
    final msg = Uint8List.fromList(utf8.encode(payload));
    return ed.verify(pub, msg, base64Decode(sigB64));
  } catch (_) {
    return false;
  }
}
