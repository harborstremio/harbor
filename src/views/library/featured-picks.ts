import type { Meta } from "@/lib/cinemeta";

export const FEATURED_COUNT = 4;

/**
 * Session-stable random picks, keyed by tab. The first call for a tab shuffles;
 * later calls reuse the same ids, dropping any that have since disappeared and
 * topping back up. Survives tab switches and re-renders; resets on restart.
 *
 * Deliberately free of runtime imports so it can be covered by the `node --test`
 * harness, which does not resolve `@/` path aliases.
 */
const chosen = new Map<string, string[]>();

export function pickFeatured(metas: Meta[], key: string, count = FEATURED_COUNT): Meta[] {
  const byId = new Map<string, Meta>();
  for (const m of metas) if (m.id && !byId.has(m.id)) byId.set(m.id, m);
  if (byId.size === 0) {
    chosen.delete(key);
    return [];
  }

  const kept = (chosen.get(key) ?? []).filter((id) => byId.has(id));
  if (kept.length < count) {
    // Titles that already have artwork look right on first paint; Hero can
    // self-heal the rest, so they are a fallback rather than a filter.
    const taken = new Set(kept);
    const rest = Array.from(byId.values()).filter((m) => !taken.has(m.id));
    const withArt = shuffle(rest.filter((m) => !!m.background));
    const withoutArt = shuffle(rest.filter((m) => !m.background));
    for (const m of [...withArt, ...withoutArt]) {
      if (kept.length >= count) break;
      kept.push(m.id);
    }
  }

  const ids = kept.slice(0, count);
  chosen.set(key, ids);
  return ids.map((id) => byId.get(id)!).filter(Boolean);
}

/** Test seam: forget the session's picks. */
export function resetFeaturedPicks(): void {
  chosen.clear();
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
