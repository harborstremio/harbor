import type { KitsuEpisode } from "@/lib/providers/kitsu";

// Resolve which pool episode fills one TVDB ordering slot.
//
// Priority is tvdbId first, then the exact season:episode pair, then absolute
// number. The one exception: when the tvdbId candidate points at a
// different-numbered episode than the slot while another pool episode matches
// the slot's pair exactly, the pair wins. Third-party tvdbId mappings
// (AniZip) can go stale — e.g. Witch Hat Atelier (kitsu:46043), where Kitsu E2
// and E3 share one TVDB id and the rest shift by -1 — while the streaming
// provider pairs (anime-kitsu addon) stay authoritative for Kitsu numbering.
// Without this, the shifted episode steals the slot and the pair-correct
// episode falls through to Extras.
//
// `claimed` holds pool ids already placed so each episode fills at most one
// slot; when the first choice is claimed the other key is tried before
// giving up (which would synthesize a duplicate row and orphan a leftover).
export function resolveAnimeSlotMatch(
  slotSeason: number,
  slotEpisode: number,
  slotTvdbId: number,
  slotAbs: number | undefined,
  byTvdbId: Map<number, KitsuEpisode>,
  byPair: Map<string, KitsuEpisode>,
  byAbs: Map<number, KitsuEpisode>,
  claimed: Set<number>,
): KitsuEpisode | undefined {
  const pairKey = `${slotSeason}:${slotEpisode}`;
  const tvdbMatch = byTvdbId.get(slotTvdbId);
  const pairMatch = byPair.get(pairKey);
  if (tvdbMatch && pairMatch && tvdbMatch !== pairMatch) {
    const tvdbNum = tvdbMatch.imdbEpisode ?? tvdbMatch.number;
    const pairNum = pairMatch.imdbEpisode ?? pairMatch.number;
    if (pairNum === slotEpisode && tvdbNum !== slotEpisode) {
      if (!claimed.has(pairMatch.id)) return pairMatch;
      if (!claimed.has(tvdbMatch.id)) return tvdbMatch;
      return undefined;
    }
    if (!claimed.has(tvdbMatch.id)) return tvdbMatch;
    if (!claimed.has(pairMatch.id)) return pairMatch;
    return undefined;
  }
  const first = tvdbMatch ?? pairMatch;
  if (first && !claimed.has(first.id)) return first;
  const fallback = first === tvdbMatch ? pairMatch : tvdbMatch;
  if (fallback && !claimed.has(fallback.id)) return fallback;
  if (slotAbs != null) {
    const absMatch = byAbs.get(slotAbs);
    if (absMatch && !claimed.has(absMatch.id)) return absMatch;
  }
  return undefined;
}
