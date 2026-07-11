import type { Meta } from "@/lib/cinemeta";
import { isCwDismissed } from "@/lib/cw-dismiss";
import { fetchAdjacentEpisodes } from "@/lib/series-episodes";
import { episodeFromVideoId, isAnimeCwItem, isCwMember, libraryMetaType, type LibraryItem } from "@/lib/stremio";

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

export type AnimeMode = "all" | "exclude" | "only";

export function isNextAired(isAnime: boolean, airDate: string | undefined): boolean {
  const t = airDate ? Date.parse(airDate) : NaN;
  if (isAnime) return Number.isFinite(t) && t <= Date.now();
  return !airDate || !Number.isFinite(t) || t <= Date.now();
}

function resurfaceAired(airDate: string | undefined): boolean {
  const t = airDate ? Date.parse(airDate) : NaN;
  return Number.isFinite(t) && t <= Date.now();
}

function currentEpisode(i: LibraryItem): { season: number; episode: number } | null {
  const season = i.state?.season;
  const episode = i.state?.episode;
  if (season && episode) return { season, episode };
  const vid = i.state?.video_id ?? "";
  if (ANIME_ID.test(i._id) && vid.split(":").length === 3) return null;
  return episodeFromVideoId(vid);
}

const RESURFACE_TTL = 6 * 3600 * 1000;
const RECENT_MS = 45 * 864e5;

type CacheVal = { next: { season: number; episode: number } | null; t: number };
const cache = new Map<string, CacheVal>();

export function clearResurfaceCache(): void {
  cache.clear();
}

export async function resurfaceCandidates(
  library: LibraryItem[],
  inCw: Set<string>,
  opts: { tmdbKey: string; animeMode: AnimeMode },
): Promise<Map<string, { season: number; episode: number }>> {
  const now = Date.now();
  const out = new Map<string, { season: number; episode: number }>();
  const candidates = library.filter((i) => {
    if (i.type !== "series" && !ANIME_ID.test(i._id)) return false;
    if (!i.state || (i.removed && !i.temp)) return false;
    if (inCw.has(i._id) || isCwMember(i) || isCwDismissed(i)) return false;
    const anime = isAnimeCwItem(i);
    if (opts.animeMode === "exclude" && anime) return false;
    if (opts.animeMode === "only" && !anime) return false;
    if ((i.state.flaggedWatched ?? 0) <= 0) return false;
    const lw = Date.parse(i.state.lastWatched ?? "");
    if (!Number.isFinite(lw) || now - lw > RECENT_MS) return false;
    return currentEpisode(i) != null;
  });
  for (const i of candidates) {
    const cur = currentEpisode(i)!;
    const key = `${i._id}:${cur.season}:${cur.episode}`;
    const cached = cache.get(key);
    let nx: { season: number; episode: number } | null;
    if (cached && now - cached.t < RESURFACE_TTL) {
      nx = cached.next;
    } else {
      const meta: Meta = {
        id: i._id,
        type: libraryMetaType(i.type),
        name: i.name,
        poster: i.poster,
        background: i.background,
      };
      nx = await fetchAdjacentEpisodes(meta, cur, { tmdbKey: opts.tmdbKey })
        .then((adj) =>
          adj.next && resurfaceAired(adj.next.airDate) ? { season: adj.next.season, episode: adj.next.episode } : null,
        )
        .catch(() => null);
      cache.set(key, { next: nx, t: now });
    }
    if (nx) out.set(i._id, nx);
  }
  return out;
}
