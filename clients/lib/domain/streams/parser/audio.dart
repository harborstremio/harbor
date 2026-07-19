import 'stream_enums.dart';
import 'torrent_title.dart';

// Ordered most-specific-first. Ported from parser-audio.ts.
final List<(RegExp, AudioCodec)> _audioCodecRx = [
  (RegExp(r'\bAtmos\b', caseSensitive: false), AudioCodec.atmos),
  (RegExp(r'\bTrueHD\b', caseSensitive: false), AudioCodec.trueHd),
  (
    RegExp(r'\bDTS-HD\.?MA\b|\bDTS\.?HD\.?MA\b', caseSensitive: false),
    AudioCodec.dtsHdMa,
  ),
  (RegExp(r'\bDTS\b', caseSensitive: false), AudioCodec.dts),
  (
    RegExp(r'\bDDP?5?\.?1\+?\b|\bE-?AC3\b|\bDD\+\b', caseSensitive: false),
    AudioCodec.ddPlus,
  ),
  (RegExp(r'\bAC3\b', caseSensitive: false), AudioCodec.ac3),
  (RegExp(r'\bAAC\b', caseSensitive: false), AudioCodec.aac),
  (RegExp(r'\bFLAC\b', caseSensitive: false), AudioCodec.flac),
  (RegExp(r'\bOpus\b', caseSensitive: false), AudioCodec.opus),
];

final RegExp _channelsRx = RegExp(r'\b(7\.1|5\.1|6\.1|2\.1|2\.0)\b');
final RegExp _bitDepthRx = RegExp(r'\b(8|10|12)\s*bit\b', caseSensitive: false);

/// Parses audio codec, channel count, and bit depth from [text], falling back
/// to the [ptt] channel/bit-depth fields. Ported from parser-audio.ts.
AudioInfo parseAudio(String text, TorrentTitle ptt) {
  var codec = AudioCodec.other;
  for (final (rx, label) in _audioCodecRx) {
    if (rx.hasMatch(text)) {
      codec = label;
      break;
    }
  }
  final channelsMatch = _channelsRx.firstMatch(text);
  final channels = channelsMatch != null
      ? _mapChannels(channelsMatch.group(1)!)
      : (ptt.channels ?? 2);
  final bitDepthMatch = _bitDepthRx.firstMatch(text);
  final bitDepth = bitDepthMatch != null
      ? int.tryParse(bitDepthMatch.group(1)!)
      : ptt.bitDepth;
  return AudioInfo(codec: codec, channels: channels, bitDepth: bitDepth);
}

int _mapChannels(String label) {
  switch (label) {
    case '7.1':
      return 8;
    case '6.1':
      return 7;
    case '5.1':
      return 6;
    case '2.1':
      return 3;
    default:
      return 2;
  }
}
