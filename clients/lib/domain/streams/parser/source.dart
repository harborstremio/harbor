import 'stream_enums.dart';

// Ordered most-specific-first; the first matching pattern wins. Ported from
// `src/lib/streams/parser/parser-source.ts`.
final List<(RegExp, StreamSource)> _sourceRx = [
  (
    RegExp(
      r'\bHC[\s._\-]?(?:HDRip|HD[\s._\-]?Rip|CAM(?:Rip)?)\b',
      caseSensitive: false,
    ),
    StreamSource.cam,
  ),
  (
    RegExp(
      r'\b(?:HD|Clean|New|HQ|TS)[\s._\-]?CAM(?:Rip)?\b|\bCAM(?:Rip)?\b',
      caseSensitive: false,
    ),
    StreamSource.cam,
  ),
  (
    RegExp(r'\bHD[\s._\-]?TS\b|\bHDTS\b', caseSensitive: false),
    StreamSource.hdts,
  ),
  (
    RegExp(
      r'\bTELESYNC\b|\bTS[\s._\-]?Rip\b|\bPDVDRip\b'
      r'|\bTS\b(?=[\s._\-]\d{3,4}[pi]\b)|(?<=\b(?:19|20)\d{2}[\s._\-])TS\b',
      caseSensitive: false,
    ),
    StreamSource.ts,
  ),
  (
    RegExp(
      r'\bTELECINE\b|\bHD[\s._\-]?TC\b'
      r'|\bTC\b(?=[\s._\-]\d{3,4}[pi]\b)|(?<=\b(?:19|20)\d{2}[\s._\-])TC\b',
      caseSensitive: false,
    ),
    StreamSource.tc,
  ),
  (
    RegExp(
      r'\bSCREENER\b|\bDVDSCR\b|\bDVDScreener\b|\bBDSCR\b|\bWEB[\s._\-]?SCR\b|\bSCR\b',
      caseSensitive: false,
    ),
    StreamSource.scr,
  ),
  (RegExp(r'\bRemux\b', caseSensitive: false), StreamSource.remux),
  (
    RegExp(r'\bBluRay\b|\bBDRip\b|\bBRRip\b', caseSensitive: false),
    StreamSource.bluRay,
  ),
  (RegExp(r'\bWEB[\.\-]?DL\b', caseSensitive: false), StreamSource.webDl),
  (
    RegExp(r'\bWEBRip\b|\bWEB-Rip\b', caseSensitive: false),
    StreamSource.webRip,
  ),
  (RegExp(r'\bHDRip\b', caseSensitive: false), StreamSource.hdRip),
  (RegExp(r'\bDVDRip\b', caseSensitive: false), StreamSource.dvdRip),
  (RegExp(r'\bHDTV\b', caseSensitive: false), StreamSource.hdtv),
  (RegExp(r'\bWEB\b', caseSensitive: false), StreamSource.webDl),
];

/// Detects the release source in [text], ported from
/// `src/lib/streams/parser/parser-source.ts`.
StreamSource detectSource(String text) {
  for (final (rx, label) in _sourceRx) {
    if (rx.hasMatch(text)) return label;
  }
  return StreamSource.other;
}
