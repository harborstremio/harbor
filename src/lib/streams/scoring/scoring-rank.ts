import type { DebridSlug, RankedPicker, ScoredStream, Tier } from "../types";
import { isCached } from "../cached";

export function rankAndPick(
  scored: ScoredStream[],
  activeDebrids: DebridSlug[],
  preferAac = false,
  respectAddonOrder = false,
): RankedPicker {
  const pri = (s: ScoredStream) => s.addonPriority ?? Number.MAX_SAFE_INTEGER;
  const ret = (s: ScoredStream) => s.addonReturnIdx ?? Number.MAX_SAFE_INTEGER;
  const all = scored
    .slice()
    .sort((a, b) =>
      respectAddonOrder ? pri(a) - pri(b) || ret(a) - ret(b) || b.score - a.score : b.score - a.score,
    );
  const cachedFirst = all.slice().sort((a, b) => {
    const ac = isCached(a, activeDebrids) ? 1 : 0;
    const bc = isCached(b, activeDebrids) ? 1 : 0;
    return bc - ac;
  });

  const byTier: Partial<Record<Tier, ScoredStream>> = {};
  for (const s of cachedFirst) {
    if (!byTier[s.tier]) byTier[s.tier] = s;
  }

  let primary = all.find((s) => isCached(s, activeDebrids)) ?? null;
  if (preferAac && primary) {
    const aac = all.find((s) => isCached(s, activeDebrids) && s.audio?.codec === "AAC");
    if (aac) primary = aac;
  }

  return { primary, byTier, all };
}
