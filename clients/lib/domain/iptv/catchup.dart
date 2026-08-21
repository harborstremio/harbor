import 'm3u.dart';

/// The catch-up/timeshift scheme a channel advertises. Ports `catchup.ts`
/// `CatchupType` (`default` is `defaultType` — `default` is a Dart keyword).
enum CatchupType { defaultType, append, shift, flussonic, xtream }

final RegExp _xtreamLiveRx = RegExp(
  r'^(https?://[^/]+)/(?:live/)?([^/]+)/([^/]+)/(\d+)\.(\w+)(?:\?|$)',
  caseSensitive: false,
);

String? _attr(IptvChannel ch, String key) {
  final v = ch.attrs[key];
  return v != null && v.isNotEmpty ? v : null;
}

/// Detects a channel's catch-up scheme from its attrs, catchup-source, or URL,
/// or null when it has none. Ports `detectCatchupType`.
CatchupType? detectCatchupType(IptvChannel ch) {
  final raw = (_attr(ch, 'catchup') ?? _attr(ch, 'catchup-type') ?? '')
      .toLowerCase()
      .trim();
  if (raw == 'flussonic' || raw == 'fs') return CatchupType.flussonic;
  if (raw == 'xc' || raw == 'xtream') return CatchupType.xtream;
  if (raw == 'append') return CatchupType.append;
  if (raw == 'shift' || raw == 'timeshift') return CatchupType.shift;
  final src = ch.catchupSource;
  if (raw == 'default' || (src != null && src.isNotEmpty)) {
    return CatchupType.defaultType;
  }
  if (_xtreamLiveRx.hasMatch(ch.url)) return CatchupType.xtream;
  return null;
}

/// Whether a channel supports catch-up playback. Ports `channelHasCatchup`.
bool channelHasCatchup(IptvChannel ch) => detectCatchupType(ch) != null;

String _pad(int n, [int w = 2]) => n.toString().padLeft(w, '0');

// UTC strftime supporting Y/m/d/H/M/S. Ports `strftime` (replaces each format
// letter globally, as the web source does).
String _strftime(String fmt, DateTime utc) => fmt
    .replaceAll('Y', utc.year.toString())
    .replaceAll('m', _pad(utc.month))
    .replaceAll('d', _pad(utc.day))
    .replaceAll('H', _pad(utc.hour))
    .replaceAll('M', _pad(utc.minute))
    .replaceAll('S', _pad(utc.second));

final RegExp _tplDollarTime = RegExp(
  r'\$\{(?:start|utc):([^}]+)\}',
  caseSensitive: false,
);
final RegExp _tplBraceTime = RegExp(
  r'\{(?:utc|start):([^}]+)\}',
  caseSensitive: false,
);
final RegExp _tplDollarVar = RegExp(r'\$\{(\w[\w-]*)\}', caseSensitive: false);
final RegExp _tplBraceVar = RegExp(r'\{(\w[\w-]*)\}', caseSensitive: false);

// Fills a catch-up-source template with the programme's timestamps. Ports
// `fillTemplate`.
String _fillTemplate(String tpl, int start, int end, int now, int duration) {
  final offset = now - start > 0 ? now - start : 0;
  final startDate = DateTime.fromMillisecondsSinceEpoch(
    start * 1000,
    isUtc: true,
  );
  final map = <String, String>{
    'start': '$start',
    'utc': '$start',
    'timestamp': '$start',
    'end': '$end',
    'utcend': '$end',
    'now': '$now',
    'lutc': '$now',
    'timenow': '$now',
    'duration': '$duration',
    'dur': '$duration',
    'offset': '$offset',
    'duration-minutes': '${(duration / 60).ceil()}',
  };
  var out = tpl;
  out = out.replaceAllMapped(
    _tplDollarTime,
    (m) => _strftime(m.group(1)!, startDate),
  );
  out = out.replaceAllMapped(
    _tplBraceTime,
    (m) => _strftime(m.group(1)!, startDate),
  );
  out = out.replaceAllMapped(
    _tplDollarVar,
    (m) => map[m.group(1)!.toLowerCase()] ?? m.group(0)!,
  );
  out = out.replaceAllMapped(
    _tplBraceVar,
    (m) => map[m.group(1)!.toLowerCase()] ?? m.group(0)!,
  );
  return out;
}

final RegExp _flussonicPath = RegExp(
  r'^(.*)/([^/]+)\.(m3u8|ts|mpd)$',
  caseSensitive: false,
);

String? _flussonicUrl(String base, int start, int duration) {
  final q = base.indexOf('?');
  final path = q >= 0 ? base.substring(0, q) : base;
  final query = q >= 0 ? base.substring(q) : '';
  final m = _flussonicPath.firstMatch(path);
  if (m != null) {
    final dir = m.group(1)!;
    final file = m.group(2)!;
    final ext = m.group(3)!;
    final stem = (file == 'mpegts' || file == 'mono') ? 'index' : file;
    return '$dir/$stem-$start-$duration.$ext$query';
  }
  final trimmed = path.replaceFirst(RegExp(r'/+$'), '');
  return '$trimmed/archive-$start-$duration.ts$query';
}

/// Builds the catch-up/timeshift URL for a programme span, or null when the
/// channel has no catch-up. Ports `buildCatchupUrl`.
String? buildCatchupUrl(IptvChannel ch, int startMs, int endMs, {int? nowMs}) {
  final type = detectCatchupType(ch);
  if (type == null) return null;
  final start = (startMs / 1000).floor();
  final end = (endMs / 1000).floor();
  final now = ((nowMs ?? DateTime.now().millisecondsSinceEpoch) / 1000).floor();
  final duration = end - start > 60 ? end - start : 60;

  if (type == CatchupType.flussonic) {
    return _flussonicUrl(ch.url, start, duration);
  }

  if (type == CatchupType.xtream) {
    final m = _xtreamLiveRx.firstMatch(ch.url);
    if (m == null) return null;
    final host = m.group(1)!;
    final user = m.group(2)!;
    final pass = m.group(3)!;
    final id = m.group(4)!;
    final mins = (duration / 60).ceil();
    final stamp = _strftime(
      'Y-m-d:H-M',
      DateTime.fromMillisecondsSinceEpoch(start * 1000, isUtc: true),
    );
    return '$host/timeshift/$user/$pass/$mins/$stamp/$id.ts';
  }

  final src = ch.catchupSource;
  if (src != null && src.isNotEmpty) {
    if (RegExp(r'^https?://', caseSensitive: false).hasMatch(src)) {
      return _fillTemplate(src, start, end, now, duration);
    }
    final sep = ch.url.contains('?') ? '&' : '?';
    final prefix = src.startsWith('?') || src.startsWith('&') ? '' : sep;
    return ch.url +
        prefix +
        _fillTemplate(
          src.replaceFirst(RegExp(r'^[?&]'), ''),
          start,
          end,
          now,
          duration,
        );
  }

  final sep = ch.url.contains('?') ? '&' : '?';
  return '${ch.url}${sep}utc=$start&lutc=$now';
}
