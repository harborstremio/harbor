import type { AniZipMapping } from "@/lib/providers/anizip";

/**
 * Episode coordinates as they appear on a PlayEpisode, regardless of which
 * metadata provider produced the episode list.
 */
export type AnimeEpisodeCoords = {
  season?: number | null;
  episode?: number | null;
  imdbSeason?: number | null;
  imdbEpisode?: number | null;
};

/**
 * Provider coordinate pairs to try when locating an episode inside an AniZip
 * mapping. The IMDb/TVDB-aligned pair (when the episode object carries one)
 * is tried before the raw provider pair.
 */
export function animeCoordPairs(
  episode: AnimeEpisodeCoords | null | undefined,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const push = (s: unknown, e: unknown) => {
    if (
      typeof s !== "number" ||
      typeof e !== "number" ||
      !Number.isFinite(s) ||
      !Number.isFinite(e) ||
      s < 1 ||
      e < 1
    ) {
      return;
    }
    if (!out.some(([os, oe]) => os === s && oe === e)) out.push([s, e]);
  };
  push(episode?.imdbSeason, episode?.imdbEpisode);
  push(episode?.season, episode?.episode);
  return out;
}

/**
 * Find the entry-relative episode number for the requested coordinates inside
 * an AniZip mapping. Mapping keys are entry-relative numbers, which is exactly
 * what a `kitsu:{id}:{n}` stream query needs:
 *
 * - Long-running anime (One Piece): one entry spans every provider season, so
 *   TMDB "S23E14" resolves through its seasonNumber/episodeNumber pair to key
 *   1169 — the true absolute episode.
 * - Seasonal anime (SAO II): one entry per cour, so the resolved number is the
 *   season-relative episode.
 *
 * Season guard: if the mapping knows about the requested provider season but
 * has no matching episode, or does not carry that season at all (the entry is
 * a sibling cour of a franchise sharing one IMDb/TMDB id), return null so the
 * caller falls back instead of querying a wrong episode.
 */
export function findAnimeEntryNumber(
  az: AniZipMapping | null | undefined,
  pairs: Array<[number, number]>,
): number | null {
  const entries = Object.entries(az?.episodes ?? {});
  if (entries.length === 0 || pairs.length === 0) return null;
  for (const [season, episodeNumber] of pairs) {
    let coversSeason = false;
    for (const [key, m] of entries) {
      if (m.seasonNumber !== season) continue;
      coversSeason = true;
      if (m.episodeNumber === episodeNumber) {
        const fromKey = Number(key);
        const n =
          Number.isFinite(fromKey) && fromKey > 0 ? fromKey : (m.absoluteEpisodeNumber ?? NaN);
        return Number.isFinite(n) && n > 0 ? n : null;
      }
    }
    // Known season + missing episode: never guess across entries or pairs.
    if (coversSeason) return null;
  }
  return null;
}

export interface EpisodeBearing {
  episode: number | null;
  seasonPack: boolean;
}

/**
 * Partition parsed streams around the requested entry-relative episode.
 * Only streams with a concrete mismatched episode token are dropped; packs,
 * batches, and titles without an episode token pass through untouched, since
 * they may legitimately contain the target episode. `valid` may carry both the
 * entry-relative number and a provider alias (split-franchise cours) so streams
 * in either numbering are kept.
 */
export function partitionByExactAnimeEpisode<T extends EpisodeBearing>(
  streams: T[],
  valid: Set<number>,
): { keep: T[]; drop: T[] } {
  const keep: T[] = [];
  const drop: T[] = [];
  for (const s of streams) {
    if (!s.seasonPack && s.episode != null && !valid.has(s.episode)) drop.push(s);
    else keep.push(s);
  }
  return { keep, drop };
}

export function animeAbsoluteFromScopedId(id: string | null | undefined): number | null {
  const m = /^(?:kitsu|mal):\d+:(\d+)$/.exec(id ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * Split-franchise handling (foreign-season hiding, solo entry grids) ships
 * scoped to specific shows until proven broader. 244 = Bleach (2004), whose
 * TVDB/TMDB entry folds Thousand-Year Blood War in as later seasons.
 */
export function isScopedSplitFranchiseRoot(rootKitsuId: number | null | undefined): boolean {
  return rootKitsuId === 244;
}

/**
 * One anime-lists claim: an AniDB entry occupying `season` of a shared
 * provider series, shifted by `offset` episodes within that season.
 * `season: "a"` marks absolute-order entries.
 */
export interface AnimeListWindow {
  anidbId: number;
  season: number | "a";
  offset: number;
}

/**
 * Distinct AniDB entries other than `excludeAnidbId` that claim the requested
 * provider season. Absolute ("a") windows are ignored: they describe whole-show
 * continuous entries, not siblings pinned to a specific season.
 */
export function selectSiblingWindows(
  windows: AnimeListWindow[] | undefined | null,
  season: number,
  excludeAnidbId?: number | null,
): number[] {
  if (!windows || windows.length === 0) return [];
  const out: number[] = [];
  for (const w of windows) {
    if (typeof w.season !== "number" || w.season !== season) continue;
    if (excludeAnidbId != null && w.anidbId === excludeAnidbId) continue;
    if (!out.includes(w.anidbId)) out.push(w.anidbId);
  }
  return out;
}
