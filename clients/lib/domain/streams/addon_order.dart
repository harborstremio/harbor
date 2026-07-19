import 'scoring/scored_stream.dart';

/// The largest exact integer (`Number.MAX_SAFE_INTEGER`), used as the "sorts
/// last" sentinel so streams missing an add-on priority or arrival index fall
/// to the end — matching the web `orderByAddonNative` tiebreaks exactly.
const int _big = 9007199254740991;

/// Orders [streams] by the add-on's own ordering rather than Harbor's score:
/// first by the add-on's installed priority, then by the order the source
/// arrived from that add-on, with the Harbor score as the final tiebreak.
///
/// Ports web `orderByAddonNative`. Applied to the Stremio (flat) list when the
/// `streamSort` setting is "addon" (the default) so the list mirrors what the
/// add-on returned instead of Harbor's ranking.
List<ScoredStream> orderByAddonNative(List<ScoredStream> streams) {
  final out = List<ScoredStream>.of(streams);
  out.sort((a, b) {
    final ap = a.parsed.stream.addonPriority ?? _big;
    final bp = b.parsed.stream.addonPriority ?? _big;
    if (ap != bp) return ap.compareTo(bp);
    final ai = a.addonReturnIdx ?? _big;
    final bi = b.addonReturnIdx ?? _big;
    if (ai != bi) return ai.compareTo(bi);
    return b.score.compareTo(a.score);
  });
  return out;
}
