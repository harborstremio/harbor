import '../library/playback_history.dart';
import 'scoring/scored_stream.dart';

/// Whether the scored stream [s] is the source recorded in [entry] — matched by
/// torrent info-hash first, then by an exact direct-url. Ports the web
/// `streamMatchesEntry`.
bool streamMatchesEntry(ScoredStream s, PlaybackEntry entry) {
  final ih = entry.infoHash?.toLowerCase();
  if (ih != null && ih.isNotEmpty && s.parsed.infoHash?.toLowerCase() == ih) {
    return true;
  }
  final u = entry.url;
  return u != null && u.isNotEmpty && s.parsed.url == u;
}

/// Whether [s] can play without a slow uncached resolve — cached on a debrid or
/// a direct url. Ports the web `isCached(s) || !!s.url`.
bool streamInstantPlayable(ScoredStream s) =>
    s.cached.values.any((c) => c) || (s.parsed.url?.isNotEmpty ?? false);

/// The pool stream matching [entry] that is instant-playable, or null — the
/// source to replay first when "remember last stream" is on. Never returns an
/// uncached match, so a remembered source can't jump ahead of the cached pick.
ScoredStream? rememberedMatch(List<ScoredStream> pool, PlaybackEntry? entry) {
  if (entry == null) return null;
  for (final s in pool) {
    if (streamMatchesEntry(s, entry) && streamInstantPlayable(s)) return s;
  }
  return null;
}

/// Whether [s] is the same *source profile* as [entry] — the looser identity
/// used to carry a source across episodes (a new episode has a different
/// info-hash/url): the same binge-group, else the same add-on + resolution +
/// source. Ports the web `streamMatchesSource`.
bool streamMatchesSource(ScoredStream s, PlaybackEntry entry) {
  final sBinge = s.parsed.stream.bingeGroup;
  final eBinge = entry.bingeGroup;
  if (eBinge != null &&
      eBinge.isNotEmpty &&
      sBinge != null &&
      sBinge.isNotEmpty) {
    return sBinge == eBinge;
  }
  final aid = entry.addonId;
  return aid != null &&
      aid.isNotEmpty &&
      s.parsed.stream.addonId == aid &&
      entry.resolution == s.parsed.resolution.name &&
      entry.source == s.parsed.source.name;
}

/// The pool stream whose source profile matches [entry] and is instant-playable,
/// or null — the source to carry to the next episode ("keep source").
ScoredStream? sourceMatch(List<ScoredStream> pool, PlaybackEntry? entry) {
  if (entry == null) return null;
  for (final s in pool) {
    if (streamMatchesSource(s, entry) && streamInstantPlayable(s)) return s;
  }
  return null;
}
