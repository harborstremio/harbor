import '../../core/http/json_transport.dart';
import 'ad_fingerprint.dart';

/// The injected-ad report endpoint, ported 1:1 from web
/// `src/lib/ad-report/submit.ts`. A user-marked ad range is sent here for
/// review — it is never trusted or skipped until it is signed into the corpus.
const String kAdReportUrl = 'https://bugs.harbor.site/v1/adreport';

/// Submits user-marked injected-ad ranges for review.
class AdReportSubmitter {
  const AdReportSubmitter(this._transport);

  final JsonTransport _transport;

  /// Sends the marked [ranges] (seconds) for [content]/[source]. Returns whether
  /// the server accepted the report. Only torrent (`ih_`) or parsed-release
  /// (`rg_`) sources are reportable; ranges are rounded to whole seconds,
  /// ordered start≤end, and empty/degenerate ranges dropped. Ports web
  /// `submitAdReport`.
  Future<bool> submit({
    required String content,
    required String source,
    required List<({double startSec, double endSec})> ranges,
  }) async {
    if (!adSourceReportable(source)) return false;
    final norm = <Map<String, int>>[];
    for (final r in ranges) {
      final start = (r.startSec <= r.endSec ? r.startSec : r.endSec).round();
      final end = (r.startSec >= r.endSec ? r.startSec : r.endSec).round();
      if (end > start) norm.add({'start': start, 'end': end});
    }
    if (norm.isEmpty) return false;
    try {
      final res = await _transport.postJson(
        kAdReportUrl,
        body: {'content': content, 'source': source, 'ranges': norm},
      );
      return res.ok;
    } catch (_) {
      return false;
    }
  }
}
