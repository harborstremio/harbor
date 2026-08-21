import 'stream_enums.dart';

/// Maps a raw resolution token to a [StreamResolution], ported from
/// `src/lib/streams/parser/parser-resolution.ts`.
StreamResolution mapResolution(String? r) {
  if (r == null) return StreamResolution.sd;
  final lower = r.toLowerCase();
  if (lower.contains('2160') || lower == '4k' || lower == 'uhd') {
    return StreamResolution.uhd;
  }
  if (lower.contains('1080')) return StreamResolution.p1080;
  if (lower.contains('720')) return StreamResolution.p720;
  if (lower.contains('480')) return StreamResolution.p480;
  return StreamResolution.sd;
}
