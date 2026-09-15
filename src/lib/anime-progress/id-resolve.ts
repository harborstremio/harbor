import { relatedLibraryIds } from "@/lib/providers/anime-mapping";
import { mappingStore } from "@/lib/providers/mapping-store";
import { canonicalAnimeKey, stremioCandidates } from "./normalize";
import type { AnimeProgressIds, NormalizedAnimeProgress } from "./types";

/**
 * Successful external→Stremio id mappings are cached with the existing
 * mapping-store pattern (same debounced localStorage write used by the anime
 * streaming lookups), so a resolved anime does not re-run ID lookups next boot.
 */
const MAP_KEY = "harbor.animecw.map.v1";
const MAP_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const store = mappingStore<{ ids: string[]; t: number; title?: string }>(MAP_KEY);

export type IdResolution =
  | { ok: true; candidates: string[] }
  | { ok: false; reason: "no-ids" | "unmapped" };

export function memoizeMapping(p: NormalizedAnimeProgress, candidates: string[]): void {
  if (!candidates || candidates.length === 0) return;
  store.set(canonicalAnimeKey(p.ids, p.titles, p.year), {
    ids: candidates,
    t: Date.now(),
    title: p.titles[0] ?? undefined,
  });
}

/**
 * Synchronous candidate lookup: shared ids on the normalized entry first, then
 * any previously cached mapping. Never picks randomly when only a title is
 * known — that returns an unresolved state instead.
 */
export function resolveCandidates(p: NormalizedAnimeProgress): IdResolution {
  const direct = stremioCandidates(p.ids);
  if (direct.length > 0) return { ok: true, candidates: direct };
  const key = canonicalAnimeKey(p.ids, p.titles, p.year);
  const hit = store.get(key);
  if (hit && Date.now() - hit.t < MAP_TTL_MS && hit.ids.length > 0) {
    return { ok: true, candidates: hit.ids };
  }
  return { ok: false, reason: key.startsWith("title:") ? "no-ids" : "unmapped" };
}

/**
 * Expands a known anime id into every shared id the project can map (AniZip /
 * relations.yuna.moe). Used to widen the candidate list when the primary id
 * does not resolve to an episode list.
 */
export async function expandMappedIds(p: NormalizedAnimeProgress): Promise<string[]> {
  const out = new Set<string>();
  const seed: string[] = [];
  if (p.ids.mal != null) seed.push(`mal:${p.ids.mal}`);
  if (p.ids.anilist != null) seed.push(`anilist:${p.ids.anilist}`);
  if (p.ids.kitsu != null) seed.push(`kitsu:${p.ids.kitsu}`);
  if (p.ids.anidb != null) seed.push(`anidb:${p.ids.anidb}`);
  if (p.ids.imdb && /^tt\d+$/.test(p.ids.imdb)) seed.push(p.ids.imdb);
  if (p.ids.tmdb != null) seed.push(`tmdb:tv:${p.ids.tmdb}`);
  for (const s of seed) out.add(s);
  for (const s of seed) {
    const related = await relatedLibraryIds(s).catch(() => [] as string[]);
    for (const r of related) out.add(r);
  }
  return [...out];
}

/** Direct id expansion without a normalized entry (test helper / utility). */
export async function expandIds(ids: AnimeProgressIds): Promise<string[]> {
  const dummy: NormalizedAnimeProgress = {
    key: "expand",
    source: "merged",
    kind: "inferred",
    status: "",
    watching: false,
    watchedEpisodes: null,
    watchedCount: 0,
    totalEpisodes: null,
    ids,
    titles: [],
    year: null,
    updatedAt: null,
  };
  return expandMappedIds(dummy);
}