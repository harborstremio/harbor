import 'parsed_stream.dart';
import 'parser/stream_enums.dart';

/// Whether [s] is a low-quality theatrical/screener capture (cam, telesync,
/// telecine, screener). Ported from web `isRoughSource`.
bool isRoughSource(StreamSource s) =>
    s == StreamSource.cam ||
    s == StreamSource.ts ||
    s == StreamSource.hdts ||
    s == StreamSource.tc ||
    s == StreamSource.scr;

/// The best-source card's confirmation line — a short year + source-provenance
/// label ("2020 · Web Release", "2020 · In Theatres") that reassures the viewer
/// the pick is the right title and describes where the source comes from.
/// Ported from web `confirmationLabel`. [metaYear] is the title's year (used
/// when the source itself carries none); [isMovie] gates the disc/web wording.
String? sourceConfirmationLabel(
  ParsedStream p, {
  int? metaYear,
  required bool isMovie,
}) {
  final parts = <String>[];
  final year = p.year ?? metaYear;
  if (year != null) parts.add('$year');
  if (isRoughSource(p.source)) {
    switch (p.source) {
      case StreamSource.cam:
        parts.add('In Theatres');
      case StreamSource.ts:
      case StreamSource.hdts:
        parts.add('Theatrical Capture');
      case StreamSource.tc:
        parts.add('Telecine Print');
      case StreamSource.scr:
        parts.add('Screener Copy');
      default:
        break;
    }
  } else if (isMovie) {
    if (p.source == StreamSource.bdRip) {
      parts.add('Disc Source');
    } else if (p.source == StreamSource.webDl ||
        p.source == StreamSource.webRip) {
      parts.add('Web Release');
    }
  }
  return parts.isEmpty ? null : parts.join(' · ');
}
