import 'dart:convert';
import 'dart:typed_data';

// The subtitle parser, ported 1:1 from `src/lib/subtitles/parser.ts`. Turns SRT,
// VTT, and ASS/SSA text into time-ordered [SubCue]s the player overlay renders,
// with [findActiveCue] for the per-frame lookup and [decodeSubtitleBytes] for
// the BOM/encoding sniffing the web `decodeText` does.

/// One subtitle line: [start]/[end] in seconds and the (tag-stripped) [text].
class SubCue {
  const SubCue({required this.start, required this.end, required this.text});
  final double start;
  final double end;
  final String text;
}

/// The subtitle container formats the parser recognises.
enum SubFormat { srt, vtt, ass, ssa, sub }

/// Parses [raw] subtitle text into cues, detecting the format when not given.
List<SubCue> parseSubtitle(String raw, {SubFormat? format}) {
  final text = raw
      .replaceFirst(RegExp('^﻿'), '')
      .replaceAll('\r\n', '\n')
      .replaceAll('\r', '\n');
  final fmt = format ?? _detectFormat(text);
  if (fmt == SubFormat.vtt) return _parseVtt(text);
  if (fmt == SubFormat.ass || fmt == SubFormat.ssa) return _parseAss(text);
  return _parseSrt(text);
}

final RegExp _webvttRe = RegExp(r'^WEBVTT', caseSensitive: false);
final RegExp _scriptInfoRe = RegExp(r'\[Script Info\]', caseSensitive: false);
final RegExp _v4StylesRe = RegExp(
  r'^\[V4\+? Styles\]',
  caseSensitive: false,
  multiLine: true,
);

SubFormat _detectFormat(String text) {
  final head = (text.length > 200 ? text.substring(0, 200) : text).trim();
  if (_webvttRe.hasMatch(head)) return SubFormat.vtt;
  if (_scriptInfoRe.hasMatch(head) || _v4StylesRe.hasMatch(text)) {
    return SubFormat.ass;
  }
  return SubFormat.srt;
}

final RegExp _blankLineRe = RegExp(r'\n{2,}');
final RegExp _numberLineRe = RegExp(r'^\d+$');
final RegExp _srtTimingRe = RegExp(
  r'(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})',
);

List<SubCue> _parseSrt(String text) {
  final cues = <SubCue>[];
  for (final block in text.split(_blankLineRe)) {
    final lines = block.split('\n').where((l) => l.isNotEmpty).toList();
    if (lines.length < 2) continue;
    var timingIdx = 0;
    if (_numberLineRe.hasMatch(lines[0].trim())) timingIdx = 1;
    if (timingIdx >= lines.length) continue;
    final m = _srtTimingRe.firstMatch(lines[timingIdx]);
    if (m == null) continue;
    final start = _toSec(m[1]!, m[2]!, m[3]!, m[4]!);
    final end = _toSec(m[5]!, m[6]!, m[7]!, m[8]!);
    final body = lines.sublist(timingIdx + 1).join('\n');
    if (body.isEmpty) continue;
    cues.add(SubCue(start: start, end: end, text: _cleanInline(body)));
  }
  cues.sort((a, b) => a.start.compareTo(b.start));
  return cues;
}

final RegExp _webvttHeaderRe = RegExp(
  r'^WEBVTT[^\n]*\n+',
  caseSensitive: false,
);
final RegExp _vttTimingRe = RegExp(
  r'(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})',
);

List<SubCue> _parseVtt(String text) {
  final cues = <SubCue>[];
  final stripped = text.replaceFirst(_webvttHeaderRe, '');
  for (final block in stripped.split(_blankLineRe)) {
    final lines = block.split('\n').where((l) => l.isNotEmpty).toList();
    if (lines.isEmpty) continue;
    var timingIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].contains('-->')) {
        timingIdx = i;
        break;
      }
    }
    if (timingIdx == -1) continue;
    final m = _vttTimingRe.firstMatch(lines[timingIdx]);
    if (m == null) continue;
    final start = _toSec(m[1] ?? '0', m[2]!, m[3]!, m[4]!);
    final end = _toSec(m[5] ?? '0', m[6]!, m[7]!, m[8]!);
    final body = lines.sublist(timingIdx + 1).join('\n');
    if (body.isEmpty) continue;
    cues.add(SubCue(start: start, end: end, text: _cleanInline(body)));
  }
  cues.sort((a, b) => a.start.compareTo(b.start));
  return cues;
}

final RegExp _eventsRe = RegExp(r'\[Events\]', caseSensitive: false);
final RegExp _assTimeRe = RegExp(r'(\d+):(\d{2}):(\d{2})\.(\d{1,3})');

List<SubCue> _parseAss(String text) {
  final cues = <SubCue>[];
  final eventsIdx = text.indexOf(_eventsRe);
  if (eventsIdx == -1) return cues;
  final lines = text.substring(eventsIdx).split('\n');
  List<String>? format;
  for (final line in lines) {
    if (line.startsWith('Format:')) {
      format = line
          .substring(7)
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .toList();
      continue;
    }
    if (!line.startsWith('Dialogue:')) continue;
    if (format == null) continue;
    final startIdx = format.indexOf('start');
    final endIdx = format.indexOf('end');
    final textIdx = format.indexOf('text');
    if (startIdx == -1 || endIdx == -1 || textIdx == -1) continue;
    final parts = _splitAssDialogue(line.substring(9), format.length);
    if (parts.length < format.length) continue;
    final start = _parseAssTime(parts[startIdx]);
    final end = _parseAssTime(parts[endIdx]);
    if (start == null || end == null) continue;
    final body = _stripAssTags(parts[textIdx]);
    if (body.isEmpty) continue;
    cues.add(SubCue(start: start, end: end, text: body));
  }
  cues.sort((a, b) => a.start.compareTo(b.start));
  return cues;
}

List<String> _splitAssDialogue(String line, int fields) {
  final out = <String>[];
  final buf = StringBuffer();
  var count = 0;
  for (var i = 0; i < line.length; i++) {
    final c = line[i];
    if (c == ',' && count < fields - 1) {
      out.add(buf.toString().trim());
      buf.clear();
      count++;
    } else {
      buf.write(c);
    }
  }
  out.add(buf.toString());
  return out;
}

double? _parseAssTime(String s) {
  final m = _assTimeRe.firstMatch(s);
  if (m == null) return null;
  return _toSec(m[1]!, m[2]!, m[3]!, '${m[4]!}00'.substring(0, 3));
}

final RegExp _assTagRe = RegExp(r'\{[^}]*\}');

String _stripAssTags(String s) => s
    .replaceAll(_assTagRe, '')
    .replaceAll(r'\N', '\n')
    .replaceAll(r'\n', ' ')
    .replaceAll(r'\h', ' ')
    .trim();

final RegExp _htmlTagRe = RegExp(r'<[^>]+>');

String _cleanInline(String s) => s
    .replaceAll(_htmlTagRe, '')
    .replaceAll(_assTagRe, '')
    .replaceAll(r'\N', '\n')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");

double _toSec(String h, String m, String s, String ms) {
  final padded = '${ms}000'.substring(0, 3);
  return int.parse(h) * 3600 +
      int.parse(m) * 60 +
      int.parse(s) +
      int.parse(padded) / 1000;
}

/// The cue active at [timeSec] (binary search over the sorted [cues]), or null.
SubCue? findActiveCue(List<SubCue> cues, double timeSec) {
  if (cues.isEmpty) return null;
  var lo = 0;
  var hi = cues.length - 1;
  while (lo <= hi) {
    final mid = (lo + hi) >> 1;
    final c = cues[mid];
    if (timeSec < c.start) {
      hi = mid - 1;
    } else if (timeSec >= c.end) {
      lo = mid + 1;
    } else {
      return c;
    }
  }
  return null;
}

/// Decodes subtitle [bytes] to text, honouring a UTF-16/UTF-8 BOM and falling
/// back to Latin-1 for non-UTF-8 bodies. Ports the web `decodeText`.
String decodeSubtitleBytes(Uint8List bytes) {
  if (bytes.length >= 2 && bytes[0] == 0xff && bytes[1] == 0xfe) {
    return _utf16(bytes.sublist(2), le: true);
  }
  if (bytes.length >= 2 && bytes[0] == 0xfe && bytes[1] == 0xff) {
    return _utf16(bytes.sublist(2), le: false);
  }
  if (bytes.length >= 3 &&
      bytes[0] == 0xef &&
      bytes[1] == 0xbb &&
      bytes[2] == 0xbf) {
    return utf8.decode(bytes.sublist(3), allowMalformed: true);
  }
  try {
    return utf8.decode(bytes);
  } on FormatException {
    return latin1.decode(bytes, allowInvalid: true);
  }
}

String _utf16(List<int> bytes, {required bool le}) {
  final units = <int>[];
  for (var i = 0; i + 1 < bytes.length; i += 2) {
    units.add(
      le ? (bytes[i] | (bytes[i + 1] << 8)) : ((bytes[i] << 8) | bytes[i + 1]),
    );
  }
  return String.fromCharCodes(units);
}
