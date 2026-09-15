import type { Meta } from "@/lib/cinemeta";
import { fetchEpisodeList } from "@/lib/series-episodes";
import type { PlayEpisode } from "@/lib/view";
import type { EpisodeCatalog } from "./normalize";

const catalogCache = new Map<string, EpisodeCatalog>();
const catalogClock = new Map<string, number>();
const CATALOG_TTL_MS = 10 * 60 * 1000;

/**
 * Builds the aired-episode catalog used to decide the next episode. Reuses the
 * existing series-episodes metadata pipeline (AniZip, anime-kitsu addon,
 * Cinemeta, TMDB) so the feature gets the same episode lists the rest of the
 * app uses, including split-cour mappings.
 */
export async function buildCatalogForCandidate(
  metaId: string,
  title: string,
  poster: string | undefined,
  tmdbKey: string,
): Promise<EpisodeCatalog | null> {
  const hit = catalogCache.get(metaId);
  const at = catalogClock.get(metaId) ?? 0;
  if (hit && Date.now() - at < CATALOG_TTL_MS) return hit;
  const meta: Meta = { id: metaId, type: "series", name: title, ...(poster ? { poster } : {}) };
  const eps = await fetchEpisodeList(meta, { tmdbKey }).catch(() => [] as PlayEpisode[]);
  if (!eps || eps.length === 0) return null;
  const episodes = new Set<string>();
  const airDates = new Map<string, number>();
  for (const e of eps) {
    if (typeof e.season !== "number" || typeof e.episode !== "number") continue;
    if (e.season < 1 || e.episode < 1) continue;
    const key = `${e.season}:${e.episode}`;
    episodes.add(key);
    if (e.airDate) {
      const t = Date.parse(e.airDate);
      if (Number.isFinite(t)) airDates.set(key, t);
    }
  }
  if (episodes.size === 0) return null;
  const out: EpisodeCatalog = { episodes, airDates, total: episodes.size };
  catalogCache.set(metaId, out);
  catalogClock.set(metaId, Date.now());
  return out;
}