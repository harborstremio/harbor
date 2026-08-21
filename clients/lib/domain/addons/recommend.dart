import 'addon_name.dart';
import 'classify.dart';
import 'curated.dart';
import 'resolved_addon.dart';

/// Related and recommended addon scoring for the detail-view rails, ported 1:1
/// from `addons-store/recommend.ts`.

int _overlap(Iterable<Object?> a, Set<Object?> b) {
  var n = 0;
  for (final x in a) {
    if (b.contains(x)) n++;
  }
  return n;
}

double _similarity(ResolvedAddon target, ResolvedAddon cand) {
  var s = 0.0;
  if (categorizeAddon(cand) == categorizeAddon(target)) s += 50;
  s += _overlap(cand.curated?.tags ?? const [], {...?target.curated?.tags}) * 8;
  s +=
      _overlap(cand.curated?.rails ?? const [], {...?target.curated?.rails}) *
      6;
  s +=
      _overlap(cand.manifest?.types ?? const [], {...?target.manifest?.types}) *
      4;
  s +=
      _overlap(cand.manifest?.resources ?? const [], {
        ...?target.manifest?.resources,
      }) *
      3;
  s += (cand.curated?.recommended ?? 0) / 20;
  return s;
}

bool _eligible(ResolvedAddon target, ResolvedAddon cand, String selfId) {
  if (resolvedAddonId(cand) == selfId) return false;
  if (cand.manifest == null && cand.curated == null) return false;
  if (isAdultAddon(cand) != isAdultAddon(target)) return false;
  return true;
}

List<ResolvedAddon> _dedupeByName(List<ResolvedAddon> rs) {
  final seen = <String>{};
  final out = <ResolvedAddon>[];
  for (final r in rs) {
    final norm = normalizeAddonName(r.manifest?.name);
    final key = norm.isNotEmpty
        ? norm
        : (r.manifest?.id.isNotEmpty == true ? r.manifest!.id : r.transportUrl);
    if (!seen.add(key)) continue;
    out.add(r);
  }
  return out;
}

List<ResolvedAddon> _rankBySimilarity(
  ResolvedAddon target,
  Iterable<ResolvedAddon> candidates,
) {
  final scored = [
    for (final r in candidates) (r: r, score: _similarity(target, r)),
  ]..sort((a, b) => b.score.compareTo(a.score));
  return [for (final x in scored) x.r];
}

/// The related-addons rail: same-category candidates first (by similarity), then
/// other categories to fill the [limit]. Ported from `relatedAddons`.
List<ResolvedAddon> relatedAddons(
  ResolvedAddon target,
  List<ResolvedAddon> all, {
  int limit = 8,
}) {
  final selfId = resolvedAddonId(target);
  final targetNorm = normalizeAddonName(target.manifest?.name);
  final cat = categorizeAddon(target);
  final eligibleCandidates = all
      .where(
        (r) =>
            _eligible(target, r, selfId) &&
            (targetNorm.isEmpty ||
                normalizeAddonName(r.manifest?.name) != targetNorm),
      )
      .toList();

  final sameCat = _rankBySimilarity(
    target,
    eligibleCandidates.where((r) => categorizeAddon(r) == cat),
  );
  final sameCatDedup = _dedupeByName(sameCat);
  if (sameCatDedup.length >= limit) return sameCatDedup.sublist(0, limit);

  final otherCat = _rankBySimilarity(
    target,
    eligibleCandidates.where((r) => categorizeAddon(r) != cat),
  );
  final merged = _dedupeByName([...sameCatDedup, ...otherCat]);
  return merged.length > limit ? merged.sublist(0, limit) : merged;
}

/// The recommended-addons rail: excludes self, installed, and [exclude] ids,
/// scoring by curated rank plus taste (installed categories) and target-category
/// bonuses. Ported from `recommendedAddons`.
List<ResolvedAddon> recommendedAddons(
  ResolvedAddon target,
  List<ResolvedAddon> all,
  Set<String> installedIds,
  Set<String> exclude, {
  int limit = 8,
}) {
  final selfId = resolvedAddonId(target);
  final taste = <AddonCategory>{};
  for (final r in all) {
    if (installedIds.contains(resolvedAddonId(r))) {
      taste.add(categorizeAddon(r));
    }
  }
  final targetNorm = normalizeAddonName(target.manifest?.name);

  final candidates = all.where((r) {
    final id = resolvedAddonId(r);
    if (!_eligible(target, r, selfId) ||
        installedIds.contains(id) ||
        exclude.contains(id)) {
      return false;
    }
    if (targetNorm.isNotEmpty &&
        normalizeAddonName(r.manifest?.name) == targetNorm) {
      return false;
    }
    return true;
  });

  final scored = [
    for (final r in candidates)
      (
        r: r,
        score:
            (r.curated?.recommended ?? 0) +
            (r.curated != null ? 12 : 0) +
            (taste.contains(categorizeAddon(r)) ? 30 : 0) +
            (categorizeAddon(r) == categorizeAddon(target) ? 20 : 0),
      ),
  ]..sort((a, b) => b.score.compareTo(a.score));

  final ranked = _dedupeByName([for (final x in scored) x.r]);
  return ranked.length > limit ? ranked.sublist(0, limit) : ranked;
}
