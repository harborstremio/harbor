import 'stream_enums.dart';

// Ordered so the most specific format wins (DV+HDR10 before DV before HDR10).
final List<(RegExp, HdrFormat)> _hdrFormats = [
  (
    RegExp(
      r'\bDV[+\-\s.]?HDR10\+?\b|\bDoVi[+\-\s.]?HDR10\+?\b'
      r'|\bDolby[\.\s]?Vision[+\-\s.]?HDR10\+?\b',
      caseSensitive: false,
    ),
    HdrFormat.dvHdr10,
  ),
  (
    RegExp(r'\bDV\b|\bDoVi\b|\bDolby[\.\s]?Vision\b', caseSensitive: false),
    HdrFormat.dv,
  ),
  (RegExp(r'\bHDR10\+\b', caseSensitive: false), HdrFormat.hdr10Plus),
  (RegExp(r'\bHLG\b', caseSensitive: false), HdrFormat.hlg),
  (RegExp(r'\bHDR10?\b|\bHDR\b', caseSensitive: false), HdrFormat.hdr10),
];

/// Detects the HDR format present in [text], ported from
/// `src/lib/streams/parser/parser-hdr.ts`.
HdrFormat? detectHdr(String text) {
  for (final (rx, label) in _hdrFormats) {
    if (rx.hasMatch(text)) return label;
  }
  return null;
}
