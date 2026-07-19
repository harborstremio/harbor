import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

/// The XMLTV size cap (200 MB of received bytes). Ported from `iptv/xmltv.ts`
/// `MAX_BYTES`.
const int xmltvMaxBytes = 200 * 1024 * 1024;

/// A single EPG programme. Ported from `iptv/types.ts` `EpgProgram`.
class EpgProgram {
  const EpgProgram({
    required this.channelTvgId,
    required this.title,
    this.description,
    required this.startMs,
    required this.endMs,
    this.category,
    this.iconUrl,
  });

  final String channelTvgId;
  final String title;
  final String? description;
  final int startMs;
  final int endMs;
  final String? category;
  final String? iconUrl;
}

/// Channel-level metadata from an XMLTV `<channel>` element. Ported from
/// `EpgChannelMeta`.
class EpgChannelMeta {
  const EpgChannelMeta({this.displayName, this.icon});
  final String? displayName;
  final String? icon;
}

/// The result of parsing an XMLTV document. Ported from `XmltvParseResult`.
class XmltvParseResult {
  const XmltvParseResult({required this.programs, required this.channelMeta});
  final List<EpgProgram> programs;
  final Map<String, EpgChannelMeta> channelMeta;
}

/// A built EPG index: programmes bucketed by channel tvg-id, optional channel
/// metadata, and the fetch time. Ported from `iptv/types.ts` `EpgIndex`.
class EpgIndex {
  const EpgIndex({
    required this.byChannel,
    this.channelMeta,
    required this.fetchedAt,
  });
  final Map<String, List<EpgProgram>> byChannel;
  final Map<String, EpgChannelMeta>? channelMeta;
  final int fetchedAt;
}

/// Thrown when the received EPG payload exceeds [xmltvMaxBytes].
class XmltvTooLarge implements Exception {
  const XmltvTooLarge(this.bytes);
  final int bytes;
  @override
  String toString() =>
      'XmltvTooLarge: EPG exceeds ${xmltvMaxBytes ~/ (1024 * 1024)}MB limit '
      '($bytes bytes)';
}

/// Parses a complete XMLTV document into programmes + channel metadata. Ports
/// `parseXmltv`.
XmltvParseResult parseXmltv(String text) {
  final programs = <EpgProgram>[];
  final channelMeta = <String, EpgChannelMeta>{};
  _drainBlocks(text, programs, channelMeta);
  return XmltvParseResult(programs: programs, channelMeta: channelMeta);
}

/// Inflates (if gzipped) and parses raw XMLTV bytes, honouring the
/// [xmltvMaxBytes] cap. Gzip is detected by its magic bytes (`0x1f 0x8b`), as in
/// the streaming reader of `fetchAndParseXmltv`.
///
/// SECURITY: the cap is applied to the DECOMPRESSED size. A hostile IPTV
/// provider can serve a tiny gzip that inflates to gigabytes (a decompression
/// bomb) and OOM-kill the app, so gzip input is inflated through a counted sink
/// that throws [XmltvTooLarge] the moment the output crosses the cap — before
/// the full payload is ever allocated. Plain XML is bounded by its own length.
XmltvParseResult parseXmltvBytes(
  Uint8List bytes, {
  int maxBytes = xmltvMaxBytes,
}) {
  if (bytes.isEmpty) {
    return const XmltvParseResult(programs: [], channelMeta: {});
  }
  final List<int> decoded;
  if (_isGzip(bytes)) {
    decoded = _inflateCapped(bytes, maxBytes);
  } else {
    if (bytes.length > maxBytes) throw XmltvTooLarge(bytes.length);
    decoded = bytes;
  }
  return parseXmltv(utf8.decode(decoded, allowMalformed: true));
}

bool _isGzip(Uint8List b) => b.length >= 2 && b[0] == 0x1f && b[1] == 0x8b;

/// Inflates gzip [input], aborting with [XmltvTooLarge] as soon as the running
/// DECOMPRESSED output exceeds [maxOut] — so a decompression bomb is rejected
/// while it streams, bounding peak memory to about [maxOut] plus one chunk.
Uint8List _inflateCapped(Uint8List input, int maxOut) {
  final sink = _CappedByteSink(maxOut);
  final inputSink = gzip.decoder.startChunkedConversion(sink);
  inputSink.add(input);
  inputSink.close();
  return sink.takeBytes();
}

/// A byte sink that accumulates the decompressed output but throws
/// [XmltvTooLarge] once the total crosses [_maxOut].
class _CappedByteSink extends ByteConversionSink {
  _CappedByteSink(this._maxOut);

  final int _maxOut;
  final BytesBuilder _out = BytesBuilder(copy: false);
  int _total = 0;

  void _accumulate(List<int> chunk) {
    _total += chunk.length;
    if (_total > _maxOut) throw XmltvTooLarge(_total);
    _out.add(chunk);
  }

  @override
  void add(List<int> chunk) => _accumulate(chunk);

  @override
  void addSlice(List<int> chunk, int start, int end, bool isLast) {
    _accumulate(chunk.sublist(start, end));
  }

  @override
  void close() {}

  Uint8List takeBytes() => _out.takeBytes();
}

/// Consumes every complete `<channel>` / `<programme>` block in [buffer],
/// appending to [out] / [channelMeta], and returns the unparsed leftover. Ports
/// `drainBlocks`.
String _drainBlocks(
  String buffer,
  List<EpgProgram> out,
  Map<String, EpgChannelMeta> channelMeta,
) {
  const chClose = '</channel>';
  const prClose = '</programme>';
  // Walk with an integer cursor rather than re-slicing the buffer each block:
  // reslicing is O(n) per block, so a large (e.g. gzip-inflated) EPG with many
  // blocks would be O(n²) and freeze the isolate. indexOf-from-cursor is O(n)
  // overall.
  var cursor = 0;
  while (true) {
    final chIdx = buffer.indexOf('<channel ', cursor);
    final prIdx = buffer.indexOf('<programme', cursor);
    if (chIdx < 0 && prIdx < 0) return _trimLeftover(buffer.substring(cursor));
    final channelFirst = chIdx >= 0 && (prIdx < 0 || chIdx < prIdx);
    if (channelFirst) {
      final close = buffer.indexOf(chClose, chIdx);
      if (close < 0) return buffer.substring(chIdx);
      _parseChannel(
        buffer.substring(chIdx, close + chClose.length),
        channelMeta,
      );
      cursor = close + chClose.length;
      continue;
    }
    final closeOpen = buffer.indexOf('>', prIdx);
    if (closeOpen < 0) return buffer.substring(prIdx);
    final endIdx = buffer.indexOf(prClose, closeOpen);
    if (endIdx < 0) return buffer.substring(prIdx);
    final prog = _parseProgramme(
      buffer.substring(prIdx, endIdx + prClose.length),
    );
    if (prog != null) out.add(prog);
    cursor = endIdx + prClose.length;
  }
}

String _trimLeftover(String buffer) =>
    buffer.length > 64 ? buffer.substring(buffer.length - 64) : buffer;

void _parseChannel(String block, Map<String, EpgChannelMeta> channelMeta) {
  final id = _attr(block, 'id');
  if (id == null || id.isEmpty) return;
  final displayName = _childText(block, 'display-name');
  final icon = _childAttr(block, 'icon', 'src');
  // Keep the first non-empty definition; later empty ones don't overwrite it.
  if (channelMeta.containsKey(id) && displayName == null && icon == null) {
    return;
  }
  channelMeta[id] = EpgChannelMeta(displayName: displayName, icon: icon);
}

EpgProgram? _parseProgramme(String block) {
  final start = _attr(block, 'start');
  final stop = _attr(block, 'stop');
  final channel = _attr(block, 'channel');
  if (start == null ||
      start.isEmpty ||
      stop == null ||
      stop.isEmpty ||
      channel == null ||
      channel.isEmpty) {
    return null;
  }
  final startMs = parseXmltvTime(start);
  final endMs = parseXmltvTime(stop);
  if (startMs == null || endMs == null || endMs <= startMs) return null;
  return EpgProgram(
    channelTvgId: channel,
    title: _childText(block, 'title') ?? 'Untitled',
    description: _childText(block, 'desc'),
    category: _childText(block, 'category'),
    iconUrl: _childAttr(block, 'icon', 'src'),
    startMs: startMs,
    endMs: endMs,
  );
}

String? _attr(String block, String name) =>
    RegExp('\\b$name="([^"]*)"').firstMatch(block)?.group(1);

String? _childText(String block, String tag) {
  final open = block.indexOf('<$tag');
  if (open < 0) return null;
  final openClose = block.indexOf('>', open);
  if (openClose < 0) return null;
  final close = block.indexOf('</$tag>', openClose);
  if (close < 0) return null;
  final decoded = _decode(
    _stripCdata(block.substring(openClose + 1, close)),
  ).trim();
  return decoded.isEmpty ? null : decoded;
}

String? _childAttr(String block, String tag, String attrName) {
  final open = block.indexOf('<$tag');
  if (open < 0) return null;
  final openClose = block.indexOf('>', open);
  if (openClose < 0) return null;
  final head = block.substring(open, openClose);
  return RegExp('\\b$attrName="([^"]*)"').firstMatch(head)?.group(1);
}

String _stripCdata(String s) => s.replaceAllMapped(
  RegExp(r'<!\[CDATA\[(.*?)\]\]>', dotAll: true),
  (m) => m.group(1)!,
);

String _decode(String s) => s
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAllMapped(
      RegExp(r'&#x([0-9a-fA-F]+);'),
      (m) => _decodeCharRef(m.group(1)!, 16),
    )
    .replaceAllMapped(
      RegExp(r'&#(\d+);'),
      (m) => _decodeCharRef(m.group(1)!, 10),
    )
    .replaceAll('&amp;', '&');

/// Resolves a numeric character reference, leaving the literal entity in place
/// for an out-of-range or overflowing value rather than throwing — a single bad
/// `&#…;` in an untrusted programme title must not abort the whole EPG parse.
String _decodeCharRef(String digits, int radix) {
  final code = int.tryParse(digits, radix: radix); // null on 64-bit overflow
  if (code == null || code < 0 || code > 0x10FFFF) {
    return radix == 16 ? '&#x$digits;' : '&#$digits;';
  }
  return String.fromCharCode(code);
}

/// Parses an XMLTV timestamp (`YYYYMMDDHHMMSS [+-]HHMM`) to epoch millis, or
/// null when malformed. Ports `parseXmltvTime`.
int? parseXmltvTime(String s) {
  final m = RegExp(
    r'^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?',
  ).firstMatch(s);
  if (m == null) return null;
  var offsetMin = 0;
  final tz = m.group(7);
  if (tz != null) {
    final sign = tz[0] == '-' ? -1 : 1;
    final hh = int.parse(tz.substring(1, 3));
    final mm = int.parse(tz.substring(3, 5));
    offsetMin = sign * (hh * 60 + mm);
  }
  final utc = DateTime.utc(
    int.parse(m.group(1)!),
    int.parse(m.group(2)!),
    int.parse(m.group(3)!),
    int.parse(m.group(4)!),
    int.parse(m.group(5)!),
    int.parse(m.group(6)!),
  ).millisecondsSinceEpoch;
  return utc - offsetMin * 60 * 1000;
}

/// Buckets programmes by their channel tvg-id, sorting each bucket by start
/// time. Ports `indexProgramsByChannel`.
Map<String, List<EpgProgram>> indexProgramsByChannel(
  List<EpgProgram> programs,
) {
  final map = <String, List<EpgProgram>>{};
  for (final p in programs) {
    (map[p.channelTvgId] ??= []).add(p);
  }
  for (final arr in map.values) {
    arr.sort((a, b) => a.startMs.compareTo(b.startMs));
  }
  return map;
}

/// Finds the now-playing programme (and the following one) in a start-sorted
/// list via binary search. Ports `findCurrent`.
({EpgProgram? current, EpgProgram? next}) findCurrent(
  List<EpgProgram>? arr,
  int nowMs,
) {
  if (arr == null || arr.isEmpty) return (current: null, next: null);
  var lo = 0;
  var hi = arr.length - 1;
  var foundIdx = -1;
  while (lo <= hi) {
    final mid = (lo + hi) >> 1;
    final p = arr[mid];
    if (nowMs < p.startMs) {
      hi = mid - 1;
    } else if (nowMs >= p.endMs) {
      lo = mid + 1;
    } else {
      foundIdx = mid;
      break;
    }
  }
  if (foundIdx < 0) {
    return (current: null, next: lo < arr.length ? arr[lo] : null);
  }
  return (
    current: arr[foundIdx],
    next: foundIdx + 1 < arr.length ? arr[foundIdx + 1] : null,
  );
}
