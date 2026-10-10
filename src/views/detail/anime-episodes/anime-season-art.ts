import type { FranchiseEntry } from "@/lib/providers/anime-detail";

export type SeasonArt = { background?: string; logo?: string; description?: string };

const SIDE_FORMATS = new Set(["ova", "ona", "special", "music", "movie"]);
const DAY = 86_400_000;
const MATCH_WINDOW = 150 * DAY;

function toTime(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso.length === 4 ? `${iso}-06-30` : iso).getTime();
  return Number.isFinite(t) ? t : null;
}

export function mapSeasonToEntry(
  active: { from?: string; to?: string; year?: string } | undefined,
  franchise: FranchiseEntry[],
  anchorId: string,
): FranchiseEntry | null {
  if (!active || franchise.length < 2) return null;
  const seasonStart = toTime(active.from) ?? toTime(active.year);
  if (seasonStart == null) return null;

  let best: FranchiseEntry | null = null;
  let bestDelta = Infinity;
  for (const e of franchise) {
    if (e.isCurrent) continue;
    if (SIDE_FORMATS.has((e.subtype ?? "").toLowerCase())) continue;
    if (!e.meta.background) continue;
    const es = toTime(e.startDate) ?? (e.year ? toTime(String(e.year)) : null);
    if (es == null) continue;
    const delta = Math.abs(es - seasonStart);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = e;
    }
  }
  if (!best || bestDelta > MATCH_WINDOW) return null;
  if (best.meta.id === anchorId) return null;
  return best;
}
