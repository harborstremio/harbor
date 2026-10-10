import { isCached } from "./cached";
import type { DebridSlug, RankedPicker, ScoredStream, Tier } from "./types";

const pri = (s: ScoredStream) => s.addonPriority ?? Number.MAX_SAFE_INTEGER;

const isTheater = (s: ScoredStream) =>
  s.source === "CAM" || s.source === "TS" || s.source === "HDTS" || s.source === "TC";

export function applyStreamPriority(
  picker: RankedPicker,
  active: boolean,
  activeDebrids: DebridSlug[],
): RankedPicker {
  if (!active) return picker;
  const all = picker.all.slice().sort((a, b) => pri(a) - pri(b));
  if (all.every((s, i) => s === picker.all[i])) return picker;
  return {
    primary: promote(picker.primary, all, activeDebrids),
    byTier: rebuildTiers(all, activeDebrids),
    all,
  };
}

function rebuildTiers(
  all: ScoredStream[],
  activeDebrids: DebridSlug[],
): Partial<Record<Tier, ScoredStream>> {
  const out: Partial<Record<Tier, ScoredStream>> = {};
  for (const s of all) {
    if (!out[s.tier] && isCached(s, activeDebrids)) out[s.tier] = s;
  }
  for (const s of all) {
    if (!out[s.tier]) out[s.tier] = s;
  }
  return out;
}

function promote(
  current: ScoredStream | null,
  all: ScoredStream[],
  activeDebrids: DebridSlug[],
): ScoredStream | null {
  if (!current) return null;
  const target = pri(current);
  const needCached = isCached(current, activeDebrids);
  for (const s of all) {
    if (pri(s) >= target) return current;
    if (isTheater(s)) continue;
    if (needCached && !isCached(s, activeDebrids)) continue;
    return s;
  }
  return current;
}
