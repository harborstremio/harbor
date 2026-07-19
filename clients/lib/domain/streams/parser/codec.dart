import 'stream_enums.dart';

/// Maps a raw codec token to a [VideoCodec], ported from
/// `src/lib/streams/parser/parser-codec.ts`.
VideoCodec mapCodec(String c) {
  final lower = c.toLowerCase();
  if (lower.contains('265') || lower == 'hevc') return VideoCodec.hevc;
  if (lower.contains('264') || lower == 'avc') return VideoCodec.avc;
  if (lower.contains('av1')) return VideoCodec.av1;
  if (lower.contains('vp9')) return VideoCodec.vp9;
  if (lower.contains('mpeg')) return VideoCodec.mpeg2;
  return VideoCodec.other;
}
