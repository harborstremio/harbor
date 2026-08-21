import 'm3u.dart';
import 'rtl.dart';
import 'xmltv.dart';

// Tokens ignored when disambiguating a channel by name. Ported from
// `iptv/epg-resolver.ts` `NOISE_WORDS`.
const Set<String> _noiseWords = {
  'hd',
  'fhd',
  'uhd',
  '4k',
  'sd',
  'raw',
  'alt',
  'backup',
  'channel',
  'channels',
  'network',
  'tv',
  'the',
  'and',
  'of',
  'for',
  'us',
  'usa',
  'uk',
  'ca',
  'mx',
  'br',
  'am',
  'fm',
};

final RegExp _nonAlnumSpace = RegExp(r'[^a-z0-9\s]');
final RegExp _spaces = RegExp(r'\s+');
final RegExp _digits = RegExp(r'^\d+$');
final RegExp _nonAlnum = RegExp(r'[^a-z0-9]');
final RegExp _tvgIdSeps = RegExp(r'[._\-:]+');
final RegExp _camel1 = RegExp(r'([a-z])([A-Z])');
final RegExp _camel2 = RegExp(r'([A-Z]+)([A-Z][a-z])');

List<String> _tokenize(String name) => name
    .toLowerCase()
    .replaceAll(_nonAlnumSpace, ' ')
    .split(_spaces)
    .where(
      (w) => (w.length >= 2 || _digits.hasMatch(w)) && !_noiseWords.contains(w),
    )
    .toList();

String _normalizeTvgId(String tvgId) {
  var s = tvgId.replaceAll(_tvgIdSeps, ' ');
  s = s.replaceAllMapped(_camel1, (m) => '${m[1]} ${m[2]}');
  s = s.replaceAllMapped(_camel2, (m) => '${m[1]} ${m[2]}');
  return s;
}

String _alnum(String s) => s.toLowerCase().replaceAll(_nonAlnum, '');

String _nameKey(String s) {
  if (hasArabic(s)) return normalizeArabic(s).replaceAll(_spaces, '');
  return s.toLowerCase().replaceAll(_nonAlnum, '');
}

// Per-EpgIndex cache of the name→tvgId lookup (Expando = the reference's
// WeakMap keyed by the index instance).
final Expando<Map<String, String>> _nameIndexCache = Expando();

Map<String, String> _nameIndexFor(EpgIndex epg) {
  final cached = _nameIndexCache[epg];
  if (cached != null) return cached;
  final map = <String, String>{};
  final meta = epg.channelMeta;
  if (meta != null) {
    for (final entry in meta.entries) {
      final name = entry.value.displayName;
      if (name == null || name.isEmpty) continue;
      final key = _nameKey(name);
      if (key.isNotEmpty && !map.containsKey(key)) map[key] = entry.key;
    }
  }
  for (final tvgId in epg.byChannel.keys) {
    final key = _nameKey(tvgId);
    if (key.isNotEmpty && !map.containsKey(key)) map[key] = tvgId;
  }
  _nameIndexCache[epg] = map;
  return map;
}

double _shiftHours(IptvChannel channel, double globalOffset) {
  final raw = channel.attrs['tvg-shift'];
  if (raw == null || raw.isEmpty) return globalOffset;
  final n = double.tryParse(raw);
  return (n != null && n.isFinite ? n : 0) + globalOffset;
}

List<EpgProgram> _applyShift(List<EpgProgram> programs, double hours) {
  if (hours == 0) return programs;
  final ms = (hours * 3600000).round();
  return [
    for (final p in programs)
      EpgProgram(
        channelTvgId: p.channelTvgId,
        title: p.title,
        description: p.description,
        startMs: p.startMs + ms,
        endMs: p.endMs + ms,
        category: p.category,
        iconUrl: p.iconUrl,
      ),
  ];
}

/// Resolves the EPG programmes for a channel, honouring a manual [override]
/// (channelId→tvgId), the tvg-id match, a name fallback, duplicate-tvg-id
/// disambiguation by name tokens, and a per-channel + global time shift. Ports
/// `epgProgramsForChannel` — the ambient EPG-override and offset reads become
/// the [override] and [offsetHours] parameters.
List<EpgProgram>? epgProgramsForChannel(
  IptvChannel channel,
  EpgIndex? epg,
  Map<String, int> tvgIdCounts, {
  String? override,
  double offsetHours = 0,
}) {
  if (epg == null) return null;
  final shift = _shiftHours(channel, offsetHours);
  if (override != null && override.isNotEmpty) {
    final ov = epg.byChannel[override];
    return ov != null ? _applyShift(ov, shift) : null;
  }
  final tvgId = channel.tvgId;
  if (tvgId == null || tvgId.isEmpty) return _nameFallback(channel, epg, shift);
  final programs = epg.byChannel[tvgId];
  if (programs == null || programs.isEmpty) {
    return _nameFallback(channel, epg, shift);
  }
  final count = tvgIdCounts[tvgId] ?? 0;
  if (count <= 1) return _applyShift(programs, shift);

  // Several channels share this tvg-id: only claim it if the channel name
  // corroborates the id's tokens.
  final idTokens = _tokenize(_normalizeTvgId(tvgId));
  if (idTokens.isEmpty) return null;
  final chTokens = _tokenize(channel.name).toSet();
  final chAlnum = _alnum(channel.name);
  for (final t in idTokens) {
    if (chTokens.contains(t)) continue;
    if (t.length >= 4 && chAlnum.contains(t)) continue;
    return null;
  }
  return _applyShift(programs, shift);
}

List<EpgProgram>? _nameFallback(
  IptvChannel channel,
  EpgIndex epg,
  double shift,
) {
  final key = _nameKey(channel.name);
  if (key.length < 3) return null;
  final tvgId = _nameIndexFor(epg)[key];
  if (tvgId == null) return null;
  final programs = epg.byChannel[tvgId];
  if (programs == null || programs.isEmpty) return null;
  return _applyShift(programs, shift);
}

/// Counts how many channels carry each tvg-id (to detect ambiguous ids). Ports
/// `computeTvgIdCounts`.
Map<String, int> computeTvgIdCounts(List<IptvChannel> channels) {
  final counts = <String, int>{};
  for (final ch in channels) {
    final id = ch.tvgId;
    if (id == null || id.isEmpty) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
